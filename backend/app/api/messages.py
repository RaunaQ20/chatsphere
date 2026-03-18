from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID, uuid4
import aiofiles
import os

from app.db.database import get_db
from app.models.models import Message, ChatMember, MessageReaction, MessageShare, MessageType, User
from app.schemas.schemas import MessageCreate, MessageOut, MessageUpdate, PaginatedMessages
from app.core.deps import get_current_user
from app.core.config import settings
from app.services.websocket_manager import manager

router = APIRouter(prefix="/chats/{chat_id}/messages", tags=["Messages"])


@router.get("", response_model=PaginatedMessages)
async def get_messages(
    chat_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    before_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(db, chat_id, current_user.id)

    query = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reactions).selectinload(MessageReaction.user),
        )
        .order_by(Message.created_at.desc())
    )
    if before_id:
        # Load messages before a specific message (for infinite scroll)
        before_msg = await db.execute(select(Message).where(Message.id == before_id))
        before = before_msg.scalar_one_or_none()
        if before:
            query = query.where(Message.created_at < before.created_at)

    count_result = await db.execute(
        select(func.count(Message.id)).where(Message.chat_id == chat_id)
    )
    total = count_result.scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))

    return PaginatedMessages(
        items=[_format_message(m) for m in messages],
        total=total,
        page=page,
        per_page=per_page,
        has_more=total > page * per_page,
    )


@router.post("", response_model=MessageOut)
async def send_message(
    chat_id: UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(db, chat_id, current_user.id)

    if not data.content and data.message_type == MessageType.TEXT:
        raise HTTPException(status_code=400, detail="Message content required")

    msg = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=data.content,
        message_type=data.message_type,
        reply_to_id=data.reply_to_id,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Load sender for broadcast
    await db.refresh(current_user)
    msg_out = _format_message_with_user(msg, current_user)

    # Broadcast to all chat members via WebSocket
    await manager.broadcast_to_chat(str(chat_id), {
        "type": "new_message",
        "payload": msg_out,
    })

    return MessageOut(**msg_out)


@router.post("/upload", response_model=MessageOut)
async def upload_file(
    chat_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(db, chat_id, current_user.id)

    # Validate file size
    content = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large (max {settings.MAX_FILE_SIZE_MB}MB)")

    # Save file
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"{uuid4()}{ext}"
    upload_path = os.path.join(settings.UPLOAD_DIR, str(chat_id))
    os.makedirs(upload_path, exist_ok=True)
    filepath = os.path.join(upload_path, filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    file_url = f"/uploads/{chat_id}/{filename}"
    is_image = file.content_type and file.content_type.startswith("image/")
    msg_type = MessageType.IMAGE if is_image else MessageType.FILE

    msg = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message_type=msg_type,
        file_url=file_url,
        file_name=file.filename,
        file_size=len(content),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    msg_out = _format_message_with_user(msg, current_user)
    await manager.broadcast_to_chat(str(chat_id), {"type": "new_message", "payload": msg_out})

    return MessageOut(**msg_out)


@router.patch("/{message_id}", response_model=MessageOut)
async def edit_message(
    chat_id: UUID,
    message_id: UUID,
    data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await _get_message(db, message_id, chat_id)
    if str(msg.sender_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Can only edit your own messages")

    msg.content = data.content
    msg.is_edited = True
    await db.commit()
    await db.refresh(msg)

    await manager.broadcast_to_chat(str(chat_id), {
        "type": "message_edited",
        "payload": {"message_id": str(message_id), "content": data.content, "chat_id": str(chat_id)}
    })

    return _format_message(msg)


@router.delete("/{message_id}")
async def delete_message(
    chat_id: UUID,
    message_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await _get_message(db, message_id, chat_id)

    # Allow sender or admin to delete
    membership = await _assert_member(db, chat_id, current_user.id)
    from app.models.models import MemberRole
    if str(msg.sender_id) != str(current_user.id) and membership.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    msg.is_deleted = True
    msg.content = None
    await db.commit()

    await manager.broadcast_to_chat(str(chat_id), {
        "type": "message_deleted",
        "payload": {"message_id": str(message_id), "chat_id": str(chat_id)}
    })
    return {"message": "Deleted"}


@router.post("/{message_id}/react")
async def react_to_message(
    chat_id: UUID,
    message_id: UUID,
    emoji: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(db, chat_id, current_user.id)

    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        await db.delete(reaction)
        action = "removed"
    else:
        new_reaction = MessageReaction(
            message_id=message_id, user_id=current_user.id, emoji=emoji
        )
        db.add(new_reaction)
        action = "added"

    await db.commit()

    await manager.broadcast_to_chat(str(chat_id), {
        "type": "reaction_updated",
        "payload": {
            "message_id": str(message_id),
            "chat_id": str(chat_id),
            "emoji": emoji,
            "user_id": str(current_user.id),
            "action": action,
        }
    })
    return {"action": action}


@router.post("/{message_id}/share")
async def share_message(
    chat_id: UUID,
    message_id: UUID,
    target_chat_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(db, chat_id, current_user.id)
    msg = await _get_message(db, message_id, chat_id)

    share_link = str(uuid4())
    share = MessageShare(
        message_id=message_id,
        shared_by=current_user.id,
        shared_to_chat_id=target_chat_id,
        share_link=share_link,
    )
    db.add(share)

    # If sharing to another chat, forward the message
    if target_chat_id:
        await _assert_member(db, target_chat_id, current_user.id)
        forwarded = Message(
            chat_id=target_chat_id,
            sender_id=current_user.id,
            content=f"📨 Forwarded: {msg.content or '[attachment]'}",
            message_type=MessageType.TEXT,
        )
        db.add(forwarded)

    await db.commit()
    return {"share_link": share_link}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _assert_member(db, chat_id, user_id):
    result = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")
    return membership


async def _get_message(db, message_id, chat_id):
    result = await db.execute(
        select(Message)
        .where(Message.id == message_id, Message.chat_id == chat_id)
        .options(selectinload(Message.sender), selectinload(Message.reactions))
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


def _format_message(msg: Message) -> dict:
    reactions = []
    if hasattr(msg, 'reactions') and msg.reactions:
        emoji_counts = {}
        for r in msg.reactions:
            if r.emoji not in emoji_counts:
                emoji_counts[r.emoji] = {"emoji": r.emoji, "count": 0, "users": []}
            emoji_counts[r.emoji]["count"] += 1
            emoji_counts[r.emoji]["users"].append(str(r.user_id))
        reactions = list(emoji_counts.values())

    return {
        "id": str(msg.id),
        "chat_id": str(msg.chat_id),
        "sender": _format_sender(msg.sender) if msg.sender else None,
        "content": msg.content if not msg.is_deleted else None,
        "message_type": msg.message_type.value,
        "file_url": msg.file_url,
        "file_name": msg.file_name,
        "file_size": msg.file_size,
        "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
        "is_edited": msg.is_edited,
        "is_deleted": msg.is_deleted,
        "reactions": reactions,
        "created_at": msg.created_at.isoformat(),
        "updated_at": msg.updated_at.isoformat() if msg.updated_at else None,
    }


def _format_message_with_user(msg: Message, user: User) -> dict:
    return {
        "id": str(msg.id),
        "chat_id": str(msg.chat_id),
        "sender": _format_sender(user),
        "content": msg.content,
        "message_type": msg.message_type.value,
        "file_url": msg.file_url,
        "file_name": msg.file_name,
        "file_size": msg.file_size,
        "reply_to_id": str(msg.reply_to_id) if msg.reply_to_id else None,
        "is_edited": False,
        "is_deleted": False,
        "reactions": [],
        "created_at": msg.created_at.isoformat(),
        "updated_at": None,
    }


def _format_sender(user) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name or user.username,
        "avatar_url": user.avatar_url,
        "is_online": user.is_online,
        "email": user.email,
        "bio": user.bio,
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
        "subscription_plan": user.subscription_plan.value if user.subscription_plan else "free",
        "tenant_id": str(user.tenant_id),
        "created_at": user.created_at.isoformat(),
    }

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.models.models import Chat, ChatMember, User, Message, MemberRole, ChatType
from app.schemas.schemas import ChatCreate, ChatOut, ChatMemberOut
from app.core.deps import get_current_user
from app.services.websocket_manager import manager

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.get("", response_model=List[ChatOut])
async def list_my_chats(
    chat_type: Optional[ChatType] = None,
    topic: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all chats the current user is a member of"""
    query = (
        select(Chat)
        .join(ChatMember, and_(ChatMember.chat_id == Chat.id, ChatMember.user_id == current_user.id))
        .where(Chat.tenant_id == current_user.tenant_id, Chat.is_archived == False)
        .options(selectinload(Chat.members).selectinload(ChatMember.user))
    )
    if chat_type:
        query = query.where(Chat.chat_type == chat_type)
    if topic:
        query = query.where(Chat.topic.ilike(f"%{topic}%"))

    result = await db.execute(query)
    chats = result.scalars().all()

    chat_list = []
    for chat in chats:
        # Get last message
        last_msg_result = await db.execute(
            select(Message)
            .where(Message.chat_id == chat.id, Message.is_deleted == False)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()

        # Get member who is current user for read tracking
        membership = next((m for m in chat.members if m.user_id == current_user.id), None)

        unread = 0
        if last_msg and membership and membership.last_read_at:
            unread_result = await db.execute(
                select(func.count(Message.id)).where(
                    Message.chat_id == chat.id,
                    Message.created_at > membership.last_read_at,
                    Message.sender_id != current_user.id,
                    Message.is_deleted == False,
                )
            )
            unread = unread_result.scalar() or 0

        chat_out = ChatOut(
            id=chat.id,
            name=chat.name or _get_dm_name(chat.members, current_user.id),
            description=chat.description,
            chat_type=chat.chat_type,
            topic=chat.topic,
            avatar_url=chat.avatar_url,
            is_archived=chat.is_archived,
            created_at=chat.created_at,
            member_count=len(chat.members),
            last_message=_format_last_message(last_msg),
            unread_count=unread,
        )
        chat_list.append(chat_out)

    return chat_list


@router.post("", response_model=ChatOut)
async def create_chat(
    data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat (DM, group, or topic-based)"""
    # For DMs, check if one already exists
    if data.chat_type == ChatType.DIRECT and len(data.member_ids) == 1:
        other_id = data.member_ids[0]
        existing = await _find_dm(db, current_user.id, other_id, current_user.tenant_id)
        if existing:
            return ChatOut(
                id=existing.id, name=existing.name, description=existing.description,
                chat_type=existing.chat_type, topic=existing.topic, avatar_url=existing.avatar_url,
                is_archived=existing.is_archived, created_at=existing.created_at,
            )

    chat = Chat(
        tenant_id=current_user.tenant_id,
        name=data.name,
        description=data.description,
        chat_type=data.chat_type,
        topic=data.topic,
        created_by=current_user.id,
    )
    db.add(chat)
    await db.flush()

    # Add creator as owner
    members_to_notify = []
    owner_membership = ChatMember(chat_id=chat.id, user_id=current_user.id, role=MemberRole.OWNER)
    db.add(owner_membership)

    # Add other members
    for mid in data.member_ids:
        if mid != current_user.id:
            membership = ChatMember(chat_id=chat.id, user_id=mid, role=MemberRole.MEMBER)
            db.add(membership)
            members_to_notify.append(str(mid))
            # Join WS room
            manager.join_chat(str(mid), str(chat.id))

    manager.join_chat(str(current_user.id), str(chat.id))
    await db.commit()
    await db.refresh(chat)

    # Notify members
    for uid in members_to_notify:
        await manager.send_to_user(uid, {
            "type": "chat_created",
            "payload": {"chat_id": str(chat.id), "chat_type": data.chat_type.value}
        })

    return ChatOut(
        id=chat.id, name=chat.name, description=chat.description,
        chat_type=chat.chat_type, topic=chat.topic, avatar_url=chat.avatar_url,
        is_archived=chat.is_archived, created_at=chat.created_at, member_count=len(data.member_ids) + 1,
    )


@router.get("/{chat_id}/members", response_model=List[ChatMemberOut])
async def get_chat_members(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(db, chat_id, current_user.id)
    result = await db.execute(
        select(ChatMember)
        .where(ChatMember.chat_id == chat_id)
        .options(selectinload(ChatMember.user))
    )
    members = result.scalars().all()
    return members


@router.post("/{chat_id}/members/{user_id}")
async def add_member(
    chat_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _assert_member(db, chat_id, current_user.id)
    if membership.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can add members")

    existing = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already in chat")

    new_member = ChatMember(chat_id=chat_id, user_id=user_id, role=MemberRole.MEMBER)
    db.add(new_member)
    await db.commit()
    manager.join_chat(str(user_id), str(chat_id))
    return {"message": "Member added"}


@router.delete("/{chat_id}/members/{user_id}")
async def remove_member(
    chat_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await _assert_member(db, chat_id, current_user.id)
    if str(user_id) != str(current_user.id) and membership.role not in [MemberRole.OWNER, MemberRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    to_remove = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    member = to_remove.scalar_one_or_none()
    if member:
        await db.delete(member)
        await db.commit()
        manager.leave_chat(str(user_id), str(chat_id))
    return {"message": "Member removed"}


@router.patch("/{chat_id}/read")
async def mark_as_read(
    chat_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    membership = await _assert_member(db, chat_id, current_user.id)
    membership.last_read_at = datetime.utcnow()
    await db.commit()
    return {"message": "Marked as read"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _assert_member(db: AsyncSession, chat_id: UUID, user_id: UUID) -> ChatMember:
    result = await db.execute(
        select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this chat")
    return membership


async def _find_dm(db: AsyncSession, user1: UUID, user2: UUID, tenant_id: UUID):
    result = await db.execute(
        select(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .where(
            Chat.tenant_id == tenant_id,
            Chat.chat_type == ChatType.DIRECT,
            ChatMember.user_id == user1,
        )
    )
    user1_chats = {c.id for c in result.scalars().all()}

    result2 = await db.execute(
        select(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .where(
            Chat.chat_type == ChatType.DIRECT,
            ChatMember.user_id == user2,
            Chat.id.in_(user1_chats),
        )
    )
    return result2.scalar_one_or_none()


def _get_dm_name(members, current_user_id):
    other = next((m.user for m in members if str(m.user_id) != str(current_user_id)), None)
    return other.display_name or other.username if other else "Unknown"


def _format_last_message(msg: Optional[Message]) -> Optional[dict]:
    if not msg:
        return None
    return {
        "id": str(msg.id),
        "content": msg.content if not msg.is_deleted else "Message deleted",
        "message_type": msg.message_type.value,
        "created_at": msg.created_at.isoformat(),
        "sender_id": str(msg.sender_id) if msg.sender_id else None,
    }

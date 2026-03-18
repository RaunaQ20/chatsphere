import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.db.database import get_db, AsyncSessionLocal
from app.models.models import User, ChatMember
from app.core.security import decode_token
from app.services.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    # Authenticate
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    if not user_id or not tenant_id:
        await websocket.close(code=4001)
        return

    # Load user and their chat memberships
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=4003)
            return

        # Load chat memberships so we can subscribe to rooms
        memberships = await db.execute(
            select(ChatMember).where(ChatMember.user_id == UUID(user_id))
        )
        for m in memberships.scalars().all():
            manager.join_chat(user_id, str(m.chat_id))

        # Mark user online
        user.is_online = True
        await db.commit()

    await manager.connect(websocket, user_id, tenant_id)

    # Notify others that user is online
    await manager.broadcast_to_tenant(tenant_id, {
        "type": "user_online",
        "payload": {"user_id": user_id}
    }, exclude_user=user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                event_type = data.get("type")
                payload_data = data.get("payload", {})

                if event_type == "typing":
                    chat_id = payload_data.get("chat_id")
                    is_typing = payload_data.get("is_typing", False)
                    if chat_id:
                        manager.set_typing(chat_id, user_id, is_typing)
                        await manager.broadcast_to_chat(chat_id, {
                            "type": "typing_indicator",
                            "payload": {
                                "chat_id": chat_id,
                                "user_id": user_id,
                                "is_typing": is_typing,
                            }
                        }, exclude_user=user_id)

                elif event_type == "join_chat":
                    chat_id = payload_data.get("chat_id")
                    if chat_id:
                        manager.join_chat(user_id, chat_id)

                elif event_type == "leave_chat":
                    chat_id = payload_data.get("chat_id")
                    if chat_id:
                        manager.leave_chat(user_id, chat_id)

                elif event_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

        # Mark user offline
        async with AsyncSessionLocal() as db:
            from datetime import datetime
            result = await db.execute(select(User).where(User.id == UUID(user_id)))
            user = result.scalar_one_or_none()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                await db.commit()

        await manager.broadcast_to_tenant(tenant_id, {
            "type": "user_offline",
            "payload": {"user_id": user_id}
        })

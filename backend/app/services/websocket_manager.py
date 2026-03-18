import json
import asyncio
from typing import Dict, Set, Optional
from uuid import UUID
from fastapi import WebSocket
from datetime import datetime


class ConnectionManager:
    def __init__(self):
        # user_id -> set of WebSocket connections (multiple tabs/devices)
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        # chat_id -> set of user_ids
        self.chat_members: Dict[str, Set[str]] = {}
        # user_id -> tenant_id
        self.user_tenant: Dict[str, str] = {}
        # typing: chat_id -> set of user_ids typing
        self.typing_users: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, tenant_id: str):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        self.user_tenant[user_id] = tenant_id

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                self.user_tenant.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

    def join_chat(self, user_id: str, chat_id: str):
        if chat_id not in self.chat_members:
            self.chat_members[chat_id] = set()
        self.chat_members[chat_id].add(user_id)

    def leave_chat(self, user_id: str, chat_id: str):
        if chat_id in self.chat_members:
            self.chat_members[chat_id].discard(user_id)

    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.user_connections:
            message = json.dumps(data, default=str)
            dead = set()
            for ws in self.user_connections[user_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.user_connections[user_id].discard(ws)

    async def broadcast_to_chat(self, chat_id: str, data: dict, exclude_user: Optional[str] = None):
        if chat_id not in self.chat_members:
            return
        for user_id in self.chat_members[chat_id]:
            if exclude_user and user_id == exclude_user:
                continue
            await self.send_to_user(user_id, data)

    async def broadcast_to_tenant(self, tenant_id: str, data: dict, exclude_user: Optional[str] = None):
        for user_id, tid in self.user_tenant.items():
            if tid == tenant_id and user_id != exclude_user:
                await self.send_to_user(user_id, data)

    def set_typing(self, chat_id: str, user_id: str, is_typing: bool):
        if chat_id not in self.typing_users:
            self.typing_users[chat_id] = set()
        if is_typing:
            self.typing_users[chat_id].add(user_id)
        else:
            self.typing_users[chat_id].discard(user_id)

    def get_typing_users(self, chat_id: str) -> list:
        return list(self.typing_users.get(chat_id, set()))

    def get_online_users(self, tenant_id: str) -> list:
        return [uid for uid, tid in self.user_tenant.items() if tid == tenant_id]


manager = ConnectionManager()

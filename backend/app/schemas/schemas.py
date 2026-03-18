from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from app.models.models import SubscriptionPlan, ChatType, MemberRole, MessageType


# ─── Tenant ───────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r'^[a-z0-9-]+$')
    domain: Optional[str] = None


class TenantOut(BaseModel):
    id: UUID
    name: str
    slug: str
    domain: Optional[str]
    logo_url: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Auth / User ──────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)
    display_name: Optional[str] = None
    tenant_slug: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str


class UserOut(BaseModel):
    id: UUID
    email: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    is_online: bool
    last_seen: Optional[datetime]
    subscription_plan: SubscriptionPlan
    tenant_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatCreate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    chat_type: ChatType = ChatType.DIRECT
    topic: Optional[str] = None
    member_ids: List[UUID] = []


class ChatOut(BaseModel):
    id: UUID
    name: Optional[str]
    description: Optional[str]
    chat_type: ChatType
    topic: Optional[str]
    avatar_url: Optional[str]
    is_archived: bool
    created_at: datetime
    member_count: Optional[int] = None
    last_message: Optional[dict] = None
    unread_count: Optional[int] = 0

    class Config:
        from_attributes = True


class ChatMemberOut(BaseModel):
    id: UUID
    user: UserOut
    role: MemberRole
    joined_at: datetime
    is_muted: bool

    class Config:
        from_attributes = True


# ─── Message ──────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: Optional[str] = None
    message_type: MessageType = MessageType.TEXT
    reply_to_id: Optional[UUID] = None


class MessageOut(BaseModel):
    id: UUID
    chat_id: UUID
    sender: Optional[UserOut]
    content: Optional[str]
    message_type: MessageType
    file_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    reply_to_id: Optional[UUID]
    is_edited: bool
    is_deleted: bool
    reactions: List[dict] = []
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1)


# ─── Subscription ─────────────────────────────────────────────────────────────

class SubscriptionCreate(BaseModel):
    plan: SubscriptionPlan
    payment_method_id: Optional[str] = None


class SubscriptionOut(BaseModel):
    plan: SubscriptionPlan
    is_active: bool
    current_period_end: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Websocket Events ─────────────────────────────────────────────────────────

class WSEvent(BaseModel):
    type: str
    payload: Any


class TypingIndicator(BaseModel):
    chat_id: UUID
    is_typing: bool


# ─── Pagination ───────────────────────────────────────────────────────────────

class PaginatedMessages(BaseModel):
    items: List[MessageOut]
    total: int
    page: int
    per_page: int
    has_more: bool

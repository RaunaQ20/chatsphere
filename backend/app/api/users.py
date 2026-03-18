from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID, uuid4
import os
import aiofiles

from app.db.database import get_db
from app.models.models import User, UserSubscription, SubscriptionPlan
from app.schemas.schemas import UserOut, UserUpdate, SubscriptionOut
from app.core.deps import get_current_user
from app.core.config import settings
from app.services.websocket_manager import manager

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.bio is not None:
        current_user.bio = data.bio
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(status_code=413, detail="Avatar must be under 2MB")

    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid4()}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, "avatars")
    os.makedirs(path, exist_ok=True)

    async with aiofiles.open(os.path.join(path, filename), "wb") as f:
        await f.write(content)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    await db.commit()

    return {"avatar_url": current_user.avatar_url}


@router.get("", response_model=List[UserOut])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users in the same tenant"""
    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id, User.is_active == True)
    )
    users = result.scalars().all()

    # Update is_online from WS manager
    for u in users:
        u.is_online = manager.is_online(str(u.id))

    return users


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_online = manager.is_online(str(user.id))
    return user


# ─── Subscription ─────────────────────────────────────────────────────────────

sub_router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@sub_router.get("/plans")
async def get_plans():
    return {
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price": 0,
                "features": ["5 users", "10 chats", "1GB storage", "Basic features"],
                "limits": {"max_users": 5, "max_chats": 10, "file_size_mb": 5},
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 9.99,
                "features": ["50 users", "Unlimited chats", "10GB storage", "All features", "Priority support"],
                "limits": {"max_users": 50, "max_chats": -1, "file_size_mb": 50},
            },
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price": 49.99,
                "features": ["Unlimited users", "Unlimited chats", "100GB storage", "Custom domain", "SLA"],
                "limits": {"max_users": -1, "max_chats": -1, "file_size_mb": 500},
            },
        ]
    }


@sub_router.get("/me", response_model=SubscriptionOut)
async def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return SubscriptionOut(plan=SubscriptionPlan.FREE, is_active=True, current_period_end=None)
    return sub


@sub_router.post("/upgrade")
async def upgrade_subscription(
    plan: SubscriptionPlan,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upgrade subscription plan (Stripe integration point)"""
    # In production, create Stripe checkout session here
    result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if sub:
        sub.plan = plan
    else:
        sub = UserSubscription(user_id=current_user.id, plan=plan, is_active=True)
        db.add(sub)

    current_user.subscription_plan = plan
    await db.commit()

    return {"message": f"Upgraded to {plan.value}", "plan": plan.value}

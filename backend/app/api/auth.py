from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from uuid import UUID
from app.db.database import get_db
from app.models.models import User, Tenant, RefreshToken, TenantSubscription
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse, RefreshTokenRequest, UserOut, TenantCreate, TenantOut
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register-tenant", response_model=TenantOut)
async def register_tenant(data: TenantCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.slug == data.slug))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    tenant = Tenant(name=data.name, slug=data.slug, domain=data.domain)
    db.add(tenant)
    await db.flush()
    db.add(TenantSubscription(tenant_id=tenant.id))
    await db.commit()
    await db.refresh(tenant)
    return tenant

@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.slug == data.tenant_slug, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    result2 = await db.execute(select(User).where(User.tenant_id == tenant.id, User.email == data.email))
    if result2.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(tenant_id=tenant.id, email=data.email, username=data.username, hashed_password=get_password_hash(data.password), display_name=data.display_name or data.username, is_verified=True)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    tokens = {"access_token": create_access_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)}), "refresh_token": create_refresh_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)})}
    db.add(RefreshToken(user_id=user.id, token=tokens["refresh_token"], expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)))
    await db.commit()
    return TokenResponse(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"], user=UserOut.model_validate(user))

@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.slug == data.tenant_slug, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Organization not found")
    result2 = await db.execute(select(User).where(User.tenant_id == tenant.id, User.email == data.email))
    user = result2.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.is_online = True
    await db.commit()
    await db.refresh(user)
    tokens = {"access_token": create_access_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)}), "refresh_token": create_refresh_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)})}
    db.add(RefreshToken(user_id=user.id, token=tokens["refresh_token"], expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)))
    await db.commit()
    return TokenResponse(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"], user=UserOut.model_validate(user))

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == data.refresh_token, RefreshToken.is_revoked == False))
    stored = result.scalar_one_or_none()
    if not stored or stored.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Token expired")
    result2 = await db.execute(select(User).where(User.id == stored.user_id))
    user = result2.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    stored.is_revoked = True
    await db.flush()
    tokens = {"access_token": create_access_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)}), "refresh_token": create_refresh_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)})}
    db.add(RefreshToken(user_id=user.id, token=tokens["refresh_token"], expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)))
    await db.commit()
    return TokenResponse(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"], user=UserOut.model_validate(user))

@router.post("/logout")
async def logout(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token == data.refresh_token))
    token = result.scalar_one_or_none()
    if token:
        token.is_revoked = True
        await db.commit()
    return {"message": "Logged out"}

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.db.database import engine, Base
from app.api import auth, chats, messages, users, websocket

# Import models so they are registered with Base
from app.models import models  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create upload directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "avatars"), exist_ok=True)

    # Create all tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    # Cleanup
    await engine.dispose()


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ChatSphere API",
    description="Real-time multi-tenant chat application",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(chats.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(users.sub_router, prefix="/api/v1")
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {"message": "ChatSphere API", "version": "1.0.0", "status": "healthy"}


@app.get("/health")
async def health():
    return {"status": "ok"}

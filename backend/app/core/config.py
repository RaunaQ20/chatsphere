from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    APP_NAME: str = "ChatSphere"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://chatuser:chatpass@localhost:5432/chatdb"
    SYNC_DATABASE_URL: str = "postgresql://chatuser:chatpass@localhost:5432/chatdb"

    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""

    MAX_FILE_SIZE_MB: int = 10
    UPLOAD_DIR: str = "uploads"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

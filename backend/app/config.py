"""Application configuration via Pydantic Settings."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "De novo 双靶点抑制剂设计平台"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://reinvent:reinvent_dev@localhost:5432/reinvent_platform"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Security
    SECRET_KEY: str = "change-me-in-production-use-a-random-string"

    # Docker
    REINVENT4_IMAGE: str = "crpi-y5oaftfoxdmhqic8.cn-hangzhou.personal.cr.aliyuncs.com/zldeng27/reinvent4_tools:1.0.0"

    # File Storage
    DATA_DIR: str = "/data"

    # GPU
    GPU_ENABLED: bool = True
    GPU_LOCK_TIMEOUT: int = 7200  # 2h max wait in queue
    GPU_LOCK_TTL: int = 86400     # 24h max lock lifetime

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

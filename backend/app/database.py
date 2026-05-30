"""SQLAlchemy async engine and session management (lazy init)."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


_async_engine = None
_AsyncSessionLocal = None
_sync_engine = None
SyncSessionLocal = None


def _get_async_engine():
    global _async_engine
    if _async_engine is None:
        # Handle SQLite special case (no pool settings)
        if settings.DATABASE_URL.startswith("sqlite"):
            _async_engine = create_async_engine(
                settings.DATABASE_URL,
                echo=settings.ENVIRONMENT == "development",
            )
        else:
            _async_engine = create_async_engine(
                settings.DATABASE_URL,
                pool_size=20,
                max_overflow=10,
                echo=settings.ENVIRONMENT == "development",
            )
    return _async_engine


def _get_async_sessionmaker():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            _get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


def _get_sync_sessionmaker():
    global SyncSessionLocal
    if SyncSessionLocal is None:
        # Handle SQLite
        if settings.DATABASE_URL.startswith("sqlite"):
            sync_url = settings.DATABASE_URL.replace("+aiosqlite", "")
            sync_engine = create_engine(sync_url)
        else:
            sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
            sync_engine = create_engine(sync_url)
        SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)
    return SyncSessionLocal


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    sessionmaker_ = _get_async_sessionmaker()
    async with sessionmaker_() as session:
        try:
            yield session
        finally:
            await session.close()


def get_sync_db():
    """Synchronous session factory for Celery workers."""
    sm = _get_sync_sessionmaker()
    return sm()


# Helper for init_db.py
def _get_engine():
    return _get_async_engine()

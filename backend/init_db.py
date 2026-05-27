"""Database initialization script - creates all tables."""

import asyncio
from app.database import _get_engine, Base
from app.models import *  # noqa: F401,F403


async def init_db():
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("All tables created successfully.")


if __name__ == "__main__":
    asyncio.run(init_db())

"""API dependencies - session token extraction."""

import uuid
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.session import Session


async def get_session_token(
    x_session_token: str = Header(default="", alias="X-Session-Token"),
) -> str:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Missing X-Session-Token header")
    return x_session_token


async def get_or_create_session(
    token: str = Depends(get_session_token),
    db: AsyncSession = Depends(get_db),
) -> Session:
    result = await db.execute(
        select(Session).where(Session.token == token)
    )
    session = result.scalar_one_or_none()
    if session is None:
        session = Session(token=token)
        db.add(session)
        await db.commit()
        await db.refresh(session)
    return session

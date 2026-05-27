"""Session management endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.schemas.session import SessionCreate, SessionResponse

router = APIRouter()


@router.post("", response_model=SessionResponse)
async def create_session(
    data: SessionCreate | None = None,
    db: AsyncSession = Depends(get_db),
):
    session = Session()
    if data and data.label:
        session.label = data.label
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

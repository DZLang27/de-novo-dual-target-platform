"""Session model - identifies a user workspace without login."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True, default=lambda: uuid.uuid4().hex
    )
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    targets = relationship("Target", back_populates="session", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="session", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="session", cascade="all, delete-orphan")

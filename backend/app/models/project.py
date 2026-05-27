"""Project model - groups targets and tasks."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Float, Integer, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session = relationship("Session", back_populates="projects")
    project_targets = relationship("ProjectTarget", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")


class ProjectTarget(Base):
    __tablename__ = "project_targets"
    __table_args__ = (
        UniqueConstraint("project_id", "target_id", name="uq_project_target"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("targets.id", ondelete="RESTRICT"), nullable=False
    )
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    center_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    center_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    center_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    size_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    size_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    size_z: Mapped[float | None] = mapped_column(Float, nullable=True)
    exhaustiveness: Mapped[int | None] = mapped_column(Integer, nullable=True)

    project = relationship("Project", back_populates="project_targets")
    target = relationship("Target", back_populates="project_targets")

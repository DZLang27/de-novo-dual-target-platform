"""Target model - uploaded PDBQT receptor files."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Float, Integer, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    protein_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pdbqt_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    pdbqt_file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    center_x: Mapped[float] = mapped_column(Float, nullable=False)
    center_y: Mapped[float] = mapped_column(Float, nullable=False)
    center_z: Mapped[float] = mapped_column(Float, nullable=False)
    size_x: Mapped[float] = mapped_column(Float, nullable=False)
    size_y: Mapped[float] = mapped_column(Float, nullable=False)
    size_z: Mapped[float] = mapped_column(Float, nullable=False)
    exhaustiveness: Mapped[int] = mapped_column(Integer, default=16)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session = relationship("Session", back_populates="targets")
    project_targets = relationship("ProjectTarget", back_populates="target", cascade="all, delete-orphan")
    task_targets = relationship("TaskTarget", back_populates="target", cascade="all, delete-orphan")
    docking_poses = relationship("DockingPose", back_populates="target", cascade="all, delete-orphan")

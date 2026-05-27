"""Molecule and DockingPose models - generated molecules and their 3D poses."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, Text, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Molecule(Base):
    __tablename__ = "molecules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    smiles: Mapped[str] = mapped_column(Text, nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    qed_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    sa_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    mol_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    logp: Mapped[float | None] = mapped_column(Float, nullable=True)
    component_scores: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    sdf_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    task = relationship("Task", back_populates="molecules")
    poses = relationship("DockingPose", back_populates="molecule", cascade="all, delete-orphan")


class DockingPose(Base):
    __tablename__ = "docking_poses"
    __table_args__ = (
        UniqueConstraint("molecule_id", "target_id", "rank", name="uq_pose"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    molecule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("molecules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("targets.id", ondelete="RESTRICT"), nullable=False
    )
    rank: Mapped[int] = mapped_column(Integer, default=1)
    docking_score: Mapped[float] = mapped_column(Float, nullable=False)
    sdf_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)

    molecule = relationship("Molecule", back_populates="poses")
    target = relationship("Target", back_populates="docking_poses")

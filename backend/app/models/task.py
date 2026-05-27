"""Task model - a single REINVENT4 RL run."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    String, Integer, Float, Text, Boolean, ForeignKey, DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )

    # Display number (per-project sequential)
    task_number: Mapped[int] = mapped_column(Integer, default=0)

    # Status
    status: Mapped[str] = mapped_column(
        String(30), default="pending",
    )  # pending → queued → running → completed / failed / cancelled

    # REINVENT parameters snapshot
    mode: Mapped[str] = mapped_column(String(30), default="reinvent")
    prior_file: Mapped[str] = mapped_column(String(500), default="priors/reinvent.prior")
    agent_file: Mapped[str] = mapped_column(String(500), default="priors/reinvent.prior")
    batch_size: Mapped[int] = mapped_column(Integer, default=128)
    sigma: Mapped[int] = mapped_column(Integer, default=128)
    learning_rate: Mapped[float] = mapped_column(Float, default=0.0001)
    aggregation: Mapped[str] = mapped_column(String(50), default="geometric_mean")
    max_steps: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    device: Mapped[str] = mapped_column(String(20), default="cpu")
    diversity_filter_type: Mapped[str | None] = mapped_column(String(50), default="IdenticalMurckoScaffold")

    # Generated configs
    toml_config: Mapped[str] = mapped_column(Text, nullable=False)
    dockstream_configs: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Execution tracking
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    container_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Progress
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    best_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_molecules: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session = relationship("Session", back_populates="tasks")
    project = relationship("Project", back_populates="tasks")
    task_targets = relationship("TaskTarget", back_populates="task", cascade="all, delete-orphan")
    molecules = relationship("Molecule", back_populates="task", cascade="all, delete-orphan")


class TaskTarget(Base):
    __tablename__ = "task_targets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("targets.id", ondelete="RESTRICT"), nullable=False
    )
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    center_x: Mapped[float] = mapped_column(Float, nullable=False)
    center_y: Mapped[float] = mapped_column(Float, nullable=False)
    center_z: Mapped[float] = mapped_column(Float, nullable=False)
    size_x: Mapped[float] = mapped_column(Float, nullable=False)
    size_y: Mapped[float] = mapped_column(Float, nullable=False)
    size_z: Mapped[float] = mapped_column(Float, nullable=False)
    exhaustiveness: Mapped[int] = mapped_column(Integer, default=16)

    task = relationship("Task", back_populates="task_targets")
    target = relationship("Target", back_populates="task_targets")

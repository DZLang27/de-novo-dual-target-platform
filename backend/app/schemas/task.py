"""Task schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TransformSpec(BaseModel):
    type: str = "reverse_sigmoid"
    high: float | None = None
    low: float | None = None
    k: float | None = None
    coef_div: float | None = None
    coef_si: float | None = None
    coef_se: float | None = None
    slope: float | None = None
    intercept: float | None = None


class ScoringComponentSpec(BaseModel):
    type: str
    name: str
    weight: float = Field(default=1.0, gt=0)
    transform: TransformSpec | None = None
    params: dict | None = None


class TargetOverride(BaseModel):
    weight: float | None = Field(default=None, gt=0)
    center_x: float | None = None
    center_y: float | None = None
    center_z: float | None = None
    size_x: float | None = Field(default=None, gt=0)
    size_y: float | None = Field(default=None, gt=0)
    size_z: float | None = Field(default=None, gt=0)
    exhaustiveness: int | None = Field(default=None, ge=1, le=128)


class TaskSubmitRequest(BaseModel):
    project_id: str  # Changed from UUID for SQLite compatibility
    mode: str = Field(default="reinvent", pattern="^(reinvent|libinvent|linkinvent)$")
    max_steps: int = Field(default=200, ge=1, le=500)
    batch_size: int = Field(default=128, ge=16, le=512)
    sigma: int = Field(default=128, ge=1, le=1000)
    learning_rate: float = Field(default=0.0001, ge=1e-6, le=0.01)
    aggregation: str = Field(default="geometric_mean", pattern="^(geometric_mean|arithmetic_mean)$")
    device: str = Field(default="cpu", pattern="^(cpu|cuda)$")
    docking_backend: str = Field(default="vina", pattern="^(vina|vina_gpu)$")
    target_overrides: dict[str, TargetOverride] = Field(default_factory=dict)
    extra_components: list[ScoringComponentSpec] = Field(default_factory=list)


class TaskResponse(BaseModel):
    id: str
    project_id: str
    task_number: int = 0
    status: str
    mode: str
    batch_size: int
    max_steps: int
    current_step: int
    best_score: float | None
    total_molecules: int
    progress_pct: float = 0.0
    queued_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    toml_config: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskListItem(BaseModel):
    id: str
    project_id: str
    task_number: int = 0
    status: str
    mode: str
    max_steps: int
    current_step: int
    best_score: float | None
    total_molecules: int
    progress_pct: float = 0.0
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskListPage(BaseModel):
    items: list[TaskListItem]
    total: int
    page: int
    page_size: int


class TaskQueueStatus(BaseModel):
    queue_length: int
    gpu_available: bool
    current_task_id: str | None = None

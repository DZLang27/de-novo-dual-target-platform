"""Project schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None


class ProjectTargetLink(BaseModel):
    target_id: UUID
    weight: float = Field(default=1.0, gt=0)
    center_x: float | None = None
    center_y: float | None = None
    center_z: float | None = None
    size_x: float | None = Field(default=None, gt=0)
    size_y: float | None = Field(default=None, gt=0)
    size_z: float | None = Field(default=None, gt=0)
    exhaustiveness: int | None = Field(default=None, ge=1, le=128)


class ProjectTargetResponse(BaseModel):
    id: UUID
    target_id: UUID
    target_name: str
    weight: float
    center_x: float | None
    center_y: float | None
    center_z: float | None
    size_x: float | None
    size_y: float | None
    size_z: float | None
    exhaustiveness: int | None

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    targets: list[ProjectTargetResponse] = []

    model_config = {"from_attributes": True}


class ProjectListItem(BaseModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    task_count: int = 0

    model_config = {"from_attributes": True}

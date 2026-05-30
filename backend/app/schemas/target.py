"""Target schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TargetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    protein_name: str | None = Field(default=None, max_length=200)
    center_x: float
    center_y: float
    center_z: float
    size_x: float = Field(gt=0)
    size_y: float = Field(gt=0)
    size_z: float = Field(gt=0)
    exhaustiveness: int = Field(default=16, ge=1, le=128)


class TargetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    protein_name: str | None = Field(default=None, max_length=200)
    center_x: float | None = None
    center_y: float | None = None
    center_z: float | None = None
    size_x: float | None = Field(default=None, gt=0)
    size_y: float | None = Field(default=None, gt=0)
    size_z: float | None = Field(default=None, gt=0)
    exhaustiveness: int | None = Field(default=None, ge=1, le=128)


class TargetResponse(BaseModel):
    id: str
    name: str
    protein_name: str | None
    pdbqt_filename: str
    pdbqt_file_size: int | None
    center_x: float
    center_y: float
    center_z: float
    size_x: float
    size_y: float
    size_z: float
    exhaustiveness: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TargetListItem(BaseModel):
    id: str
    name: str
    protein_name: str | None
    pdbqt_filename: str
    pdbqt_file_size: int | None
    center_x: float
    center_y: float
    center_z: float
    size_x: float
    size_y: float
    size_z: float
    exhaustiveness: int
    created_at: datetime

    model_config = {"from_attributes": True}

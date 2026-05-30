"""Molecule schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MoleculeListParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)
    sort_by: str = Field(default="total_score", pattern="^(total_score|qed_score|sa_score|mol_weight|logp)$")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")
    min_score: float | None = None
    max_score: float | None = None
    step_min: int | None = None
    step_max: int | None = None
    search_smiles: str | None = Field(default=None, max_length=500)


class MoleculeListItem(BaseModel):
    id: str
    task_id: str
    smiles: str
    step_number: int
    total_score: float
    qed_score: float | None
    sa_score: float | None
    sdf_index: int | None = None
    mol_weight: float | None
    logp: float | None
    component_scores: dict | None = None

    model_config = {"from_attributes": True}


class DockingPoseResponse(BaseModel):
    id: str
    target_id: str
    target_name: str | None = None
    rank: int
    docking_score: float

    model_config = {"from_attributes": True}


class MoleculeResponse(MoleculeListItem):
    created_at: datetime

    model_config = {"from_attributes": True}


class MoleculeDetailResponse(MoleculeResponse):
    poses: list[DockingPoseResponse] = []
    target_ids: list[str] = []
    target_names: list[str] = []

    model_config = {"from_attributes": True}


class MoleculeListPage(BaseModel):
    items: list[MoleculeListItem]
    total: int
    page: int
    page_size: int
    total_pages: int

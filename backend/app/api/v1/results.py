"""Results endpoints - molecule listing, detail, and export."""

import io
import csv
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.session import Session
from app.models.task import Task, TaskTarget
from app.models.molecule import Molecule, DockingPose
from app.schemas.molecule import (
    MoleculeListItem, MoleculeDetailResponse, MoleculeResponse,
    DockingPoseResponse, MoleculeListPage, MoleculeListParams,
)
from app.api.deps import get_or_create_session

router = APIRouter()


def _molecule_to_item(m: Molecule) -> MoleculeListItem:
    return MoleculeListItem(
        id=m.id, task_id=m.task_id, smiles=m.smiles, step_number=m.step_number,
        total_score=m.total_score, qed_score=m.qed_score,
        sa_score=m.sa_score, sdf_index=m.sdf_index,
        mol_weight=m.mol_weight, logp=m.logp,
        component_scores=m.component_scores,
    )


@router.get("/tasks/{task_id}/molecules", response_model=MoleculeListPage)
async def list_molecules(
    task_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort_by: str = Query(default="total_score"),
    sort_order: str = Query(default="desc"),
    min_score: float | None = Query(None),
    max_score: float | None = Query(None),
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    # Verify task ownership
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Build query
    query = select(Molecule).where(Molecule.task_id == task_id)

    if min_score is not None:
        query = query.where(Molecule.total_score >= min_score)
    if max_score is not None:
        query = query.where(Molecule.total_score <= max_score)

    sort_col = getattr(Molecule, sort_by, Molecule.total_score)
    if sort_order == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    # Count
    count_query = select(func.count(Molecule.id)).where(Molecule.task_id == task_id)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    molecules = result.scalars().all()

    return MoleculeListPage(
        items=[_molecule_to_item(m) for m in molecules],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/molecules/{molecule_id}", response_model=MoleculeDetailResponse)
async def get_molecule(
    molecule_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Molecule)
        .where(Molecule.id == molecule_id)
        .options(
            selectinload(Molecule.poses).selectinload(DockingPose.target),
            selectinload(Molecule.task).selectinload(Task.task_targets).selectinload(TaskTarget.target),
        )
    )
    molecule = result.scalar_one_or_none()
    if not molecule:
        raise HTTPException(status_code=404, detail="Molecule not found")

    # Verify task ownership
    if molecule.task.session_id != session.id:
        raise HTTPException(status_code=404, detail="Molecule not found")

    poses = []
    for pose in molecule.poses:
        poses.append(DockingPoseResponse(
            id=pose.id,
            target_id=pose.target_id,
            target_name=pose.target.name if pose.target else None,
            rank=pose.rank,
            docking_score=pose.docking_score,
        ))

    # Get task target IDs and names
    target_ids: list[str] = []
    target_names: list[str] = []
    if hasattr(molecule.task, 'task_targets'):
        for tt in molecule.task.task_targets:
            target_ids.append(str(tt.target_id))
            target_names.append(tt.target.name if tt.target else str(tt.target_id)[:8])

    return MoleculeDetailResponse(
        id=molecule.id, task_id=molecule.task_id, smiles=molecule.smiles,
        step_number=molecule.step_number, total_score=molecule.total_score,
        qed_score=molecule.qed_score, sa_score=molecule.sa_score,
        sdf_index=molecule.sdf_index,
        mol_weight=molecule.mol_weight, logp=molecule.logp,
        component_scores=molecule.component_scores,
        created_at=molecule.created_at, poses=poses,
        target_ids=target_ids, target_names=target_names,
    )


@router.get("/molecules/{molecule_id}/poses", response_model=list[DockingPoseResponse])
async def get_molecule_poses(
    molecule_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Molecule)
        .where(Molecule.id == molecule_id)
        .options(selectinload(Molecule.task))
    )
    molecule = result.scalar_one_or_none()
    if not molecule or molecule.task.session_id != session.id:
        raise HTTPException(status_code=404, detail="Molecule not found")

    poses_result = await db.execute(
        select(DockingPose)
        .where(DockingPose.molecule_id == molecule_id)
        .options(selectinload(DockingPose.target))
        .order_by(DockingPose.rank)
    )
    poses = poses_result.scalars().all()

    return [
        DockingPoseResponse(
            id=p.id, target_id=p.target_id,
            target_name=p.target.name if p.target else None,
            rank=p.rank, docking_score=p.docking_score,
        )
        for p in poses
    ]


@router.get("/tasks/{task_id}/export/csv")
async def export_csv(
    task_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found")

    molecules_result = await db.execute(
        select(Molecule)
        .where(Molecule.task_id == task_id)
        .order_by(desc(Molecule.total_score))
    )
    molecules = molecules_result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "smiles", "step_number", "total_score",
        "qed_score", "sa_score", "mol_weight", "logp",
    ])
    for m in molecules:
        writer.writerow([
            str(m.id), m.smiles, m.step_number, m.total_score,
            m.qed_score, m.sa_score, m.mol_weight, m.logp,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=task_{task_id}_results.csv"},
    )

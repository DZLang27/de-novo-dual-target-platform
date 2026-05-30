"""Results endpoints - molecule listing, detail, export, and statistics."""

import io
import csv
from uuid import UUID
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
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
from app.config import settings

router = APIRouter()


class TaskComparison(BaseModel):
    """Comparison data for multiple tasks."""
    tasks: list[dict]  # [{task_id, task_number, status, total_molecules, best_score, avg_score}]


class ScoreStatistics(BaseModel):
    """Score statistics for a task."""
    task_id: str
    total_molecules: int
    score_by_step: list[dict]  # [{step, max_score, avg_score, min_score, count}]
    component_stats: dict  # {component_name: {min, max, avg}}
    score_distribution: list[dict]  # [{range, count}]


@router.get("/tasks/comparison", response_model=TaskComparison)
async def compare_tasks(
    task_ids: str = Query(..., description="Comma-separated task IDs"),
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    """Compare statistics across multiple tasks."""
    ids = [UUID(tid.strip()) for tid in task_ids.split(",") if tid.strip()]
    
    if not ids:
        return TaskComparison(tasks=[])
    
    # Get tasks
    task_result = await db.execute(
        select(Task).where(
            Task.id.in_(ids),
            Task.session_id == session.id
        )
    )
    tasks = task_result.scalars().all()
    
    result = []
    for task in tasks:
        # Get molecule stats for each task
        stats_result = await db.execute(
            select(
                func.count(Molecule.id).label("total"),
                func.max(Molecule.total_score).label("best"),
                func.avg(Molecule.total_score).label("avg"),
            ).where(Molecule.task_id == task.id)
        )
        stats = stats_result.one()
        
        result.append({
            "task_id": str(task.id),
            "task_number": task.task_number,
            "status": task.status,
            "total_molecules": stats.total or 0,
            "best_score": float(stats.best) if stats.best else None,
            "avg_score": float(stats.avg) if stats.avg else None,
            "max_steps": task.max_steps,
            "current_step": task.current_step,
        })
    
    return TaskComparison(tasks=result)


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
    task_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    sort_by: str = Query(default="total_score"),
    sort_order: str = Query(default="desc"),
    min_score: float | None = Query(None),
    max_score: float | None = Query(None),
    search_smiles: str | None = Query(None, description="Search SMILES substring"),
    step_min: int | None = Query(None, description="Minimum step number"),
    step_max: int | None = Query(None, description="Maximum step number"),
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    """List molecules with advanced filtering and search.
    
    Sort by component scores: use sort_by=component:ComponentName
    e.g. sort_by=component:Docking_EGFR to sort by docking score.
    """
    from sqlalchemy import text

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
    
    # SMILES substring search
    if search_smiles:
        query = query.where(Molecule.smiles.ilike(f"%{search_smiles}%"))
    
    # Step range filter
    if step_min is not None:
        query = query.where(Molecule.step_number >= step_min)
    if step_max is not None:
        query = query.where(Molecule.step_number <= step_max)

    # Sort: support component scores via "component:ComponentName" syntax
    if sort_by.startswith("component:"):
        from sqlalchemy import literal_column
        component_name = sort_by.split(":", 1)[1]
        # Use JSON extract for SQLite - use literal_column for raw SQL expression
        sort_expr = func.json_extract(Molecule.component_scores, f'$.{component_name}')
        if sort_order == "asc":
            query = query.order_by(sort_expr.asc().nullslast())
        else:
            query = query.order_by(sort_expr.desc().nullsfirst())
    else:
        sort_col = getattr(Molecule, sort_by, Molecule.total_score)
        if sort_order == "asc":
            query = query.order_by(asc(sort_col))
        else:
            query = query.order_by(desc(sort_col))

    # Count
    count_query = select(func.count(Molecule.id)).where(Molecule.task_id == task_id)
    if min_score is not None:
        count_query = count_query.where(Molecule.total_score >= min_score)
    if max_score is not None:
        count_query = count_query.where(Molecule.total_score <= max_score)
    if search_smiles:
        count_query = count_query.where(Molecule.smiles.ilike(f"%{search_smiles}%"))
    if step_min is not None:
        count_query = count_query.where(Molecule.step_number >= step_min)
    if step_max is not None:
        count_query = count_query.where(Molecule.step_number <= step_max)
    
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
    molecule_id: str,
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
    molecule_id: str,
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
    task_id: str,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    """Export task results as CSV. 
    
    Uses REINVENT4's original run_*.csv files which contain all columns
    including component scores, raw scores, etc.
    """
    from pathlib import Path
    import glob

    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    if not task_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found")

    # Find REINVENT4 run CSV files
    result_dir = Path(settings.DATA_DIR) / "results" / task_id
    csv_files = sorted(result_dir.glob("run_*.csv"))
    
    if not csv_files:
        # Fallback: generate from database
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
    
    # Concatenate all run_*.csv files
    combined = io.StringIO()
    first_file = True
    
    for csv_file in csv_files:
        with open(csv_file, "r", encoding="utf-8") as f:
            content = f.read()
            if first_file:
                combined.write(content)
                first_file = False
            else:
                # Skip header line for subsequent files
                lines = content.split("\n", 1)
                if len(lines) > 1:
                    combined.write(lines[1])
    
    combined.seek(0)
    content = combined.getvalue()
    
    # Add UTF-8 BOM header for Excel compatibility
    bom = '\ufeff'
    return StreamingResponse(
        iter([bom + content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=task_{task_id}_results.csv"},
    )


@router.get("/tasks/{task_id}/statistics", response_model=ScoreStatistics)
async def get_task_statistics(
    task_id: str,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    """Get score statistics for a task, including learning curve data."""
    # Verify task ownership
    task_result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get all molecules for this task
    molecules_result = await db.execute(
        select(Molecule).where(Molecule.task_id == task_id)
    )
    molecules = molecules_result.scalars().all()
    
    if not molecules:
        return ScoreStatistics(
            task_id=str(task_id),
            total_molecules=0,
            score_by_step=[],
            component_stats={},
            score_distribution=[],
        )

    # Calculate score by step (learning curve)
    step_data = defaultdict(list)
    for mol in molecules:
        step_data[mol.step_number].append(mol.total_score)

    score_by_step = []
    for step in sorted(step_data.keys()):
        scores = step_data[step]
        score_by_step.append({
            "step": step,
            "max_score": max(scores),
            "avg_score": sum(scores) / len(scores),
            "min_score": min(scores),
            "count": len(scores),
        })

    # Calculate component statistics
    component_stats = defaultdict(lambda: {"min": float("inf"), "max": float("-inf"), "scores": []})
    for mol in molecules:
        if mol.component_scores:
            for comp_name, comp_score in mol.component_scores.items():
                if isinstance(comp_score, (int, float)):
                    component_stats[comp_name]["scores"].append(comp_score)
                    component_stats[comp_name]["min"] = min(component_stats[comp_name]["min"], comp_score)
                    component_stats[comp_name]["max"] = max(component_stats[comp_name]["max"], comp_score)

    # Finalize component stats
    final_component_stats = {}
    for comp_name, data in component_stats.items():
        scores = data["scores"]
        if scores:
            final_component_stats[comp_name] = {
                "min": data["min"],
                "max": data["max"],
                "avg": sum(scores) / len(scores),
            }

    # Calculate score distribution (histogram)
    all_scores = [mol.total_score for mol in molecules]
    min_score = min(all_scores)
    max_score = max(all_scores)
    
    # Create 10 bins
    num_bins = 10
    bin_width = (max_score - min_score) / num_bins if max_score > min_score else 0.1
    bins = [min_score + i * bin_width for i in range(num_bins + 1)]
    bin_counts = [0] * num_bins
    
    for score in all_scores:
        bin_idx = min(int((score - min_score) / bin_width), num_bins - 1) if bin_width > 0 else 0
        bin_counts[bin_idx] += 1

    score_distribution = []
    for i in range(num_bins):
        score_distribution.append({
            "range": f"{bins[i]:.3f}-{bins[i+1]:.3f}",
            "count": bin_counts[i],
        })

    return ScoreStatistics(
        task_id=str(task_id),
        total_molecules=len(molecules),
        score_by_step=score_by_step,
        component_stats=final_component_stats,
        score_distribution=score_distribution,
    )

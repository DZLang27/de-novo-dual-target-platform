"""Task submission, status, and WebSocket endpoints."""

import json
from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.session import Session
from app.models.project import Project, ProjectTarget
from app.models.target import Target
from app.models.task import Task, TaskTarget
from app.schemas.task import (
    TaskSubmitRequest, TaskResponse, TaskListItem, TaskListPage, TaskQueueStatus,
)
from app.schemas.molecule import MoleculeListItem, MoleculeListPage, MoleculeListParams
from app.models.molecule import Molecule
from app.api.deps import get_or_create_session
from app.services.toml_generator import TOMLGenerator
from app.services.dockstream_config import generate_target_config

router = APIRouter()


def _build_task_response(task: Task) -> TaskResponse:
    progress = 0.0
    if task.max_steps > 0:
        progress = round(task.current_step / task.max_steps * 100, 1)
    return TaskResponse(
        id=task.id, project_id=task.project_id, status=task.status,
        mode=task.mode, batch_size=task.batch_size, max_steps=task.max_steps,
        current_step=task.current_step, best_score=task.best_score,
        total_molecules=task.total_molecules, progress_pct=progress,
        queued_at=task.queued_at, started_at=task.started_at,
        completed_at=task.completed_at, error_message=task.error_message,
        toml_config=task.toml_config, created_at=task.created_at,
    )


@router.get("", response_model=TaskListPage)
async def list_tasks(
    project_id: str | None = Query(None),
    status: str | None = Query(None),
    page: int = 1,
    page_size: int = 20,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Task).where(Task.session_id == session.id)
    if project_id:
        base_query = base_query.where(Task.project_id == project_id)
    if status:
        base_query = base_query.where(Task.status == status)

    count_result = await db.execute(
        select(func.count(Task.id)).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    query = base_query.order_by(Task.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    tasks = result.scalars().all()

    items = []
    for task in tasks:
        progress = 0.0
        if task.max_steps > 0:
            progress = round(task.current_step / task.max_steps * 100, 1)
        items.append(TaskListItem(
            id=task.id, project_id=task.project_id, task_number=task.task_number,
            status=task.status, mode=task.mode, max_steps=task.max_steps,
            current_step=task.current_step, best_score=task.best_score,
            total_molecules=task.total_molecules, progress_pct=progress,
            created_at=task.created_at,
        ))
    return TaskListPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/queue-status", response_model=TaskQueueStatus)
async def get_queue_status(
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    running_result = await db.execute(
        select(Task).where(Task.status == "running").limit(1)
    )
    current_task = running_result.scalar_one_or_none()

    queued_result = await db.execute(
        select(func.count(Task.id)).where(Task.status.in_(["pending", "queued"]))
    )
    queue_length = queued_result.scalar() or 0

    return TaskQueueStatus(
        queue_length=queue_length,
        gpu_available=current_task is None,
        current_task_id=current_task.id if current_task else None,
    )


@router.post("", response_model=TaskResponse, status_code=201)
async def submit_task(
    data: TaskSubmitRequest,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    # Validate project ownership
    result = await db.execute(
        select(Project)
        .where(Project.id == data.project_id, Project.session_id == session.id)
        .options(selectinload(Project.project_targets).selectinload(ProjectTarget.target))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if len(project.project_targets) == 0:
        raise HTTPException(status_code=400, detail="Project has no targets linked")

    # Build target DTOs with overrides
    target_dtos = []
    dockstream_configs = {}

    for i, pt in enumerate(project.project_targets):
        override = None
        if str(pt.target_id) in data.target_overrides:
            override = data.target_overrides[str(pt.target_id)]

        config_path = f"/data/config/dockstream_{pt.target.name}.json"
        dockstream_json = generate_target_config(pt.target, override, mount_prefix="/data/targets", docking_backend=data.docking_backend, target_index=i)
        dockstream_configs[pt.target.name] = {
            "path": config_path,
            "content": dockstream_json,
        }

        target_dtos.append({
            "target": pt.target,
            "override": override,
            "config_path": config_path,
        })

    # Generate TOML
    generator = TOMLGenerator(data, target_dtos)
    toml_config = generator.generate()

    # Auto-assign task number per project
    count_result = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == data.project_id)
    )
    task_number = (count_result.scalar() or 0) + 1

    # Create task record
    task = Task(
        task_number=task_number,
        session_id=session.id,
        project_id=data.project_id,
        mode=data.mode,
        prior_file=TOMLGenerator.MODE_CONFIGS[data.mode]["prior_file"],
        agent_file=TOMLGenerator.MODE_CONFIGS[data.mode]["agent_file"],
        batch_size=data.batch_size,
        sigma=data.sigma,
        learning_rate=data.learning_rate,
        aggregation=data.aggregation,
        max_steps=data.max_steps,
        device=data.device,
        toml_config=toml_config,
        dockstream_configs=json.dumps({k: v["content"] for k, v in dockstream_configs.items()}),
        status="pending",
    )
    db.add(task)
    await db.commit()

    # Create task_target associations
    for pt in project.project_targets:
        override = data.target_overrides.get(str(pt.target_id))
        task_target = TaskTarget(
            task_id=task.id,
            target_id=pt.target_id,
            weight=override.weight if override and override.weight else pt.weight,
            center_x=override.center_x if override and override.center_x else (pt.center_x or pt.target.center_x),
            center_y=override.center_y if override and override.center_y else (pt.center_y or pt.target.center_y),
            center_z=override.center_z if override and override.center_z else (pt.center_z or pt.target.center_z),
            size_x=override.size_x if override and override.size_x else (pt.size_x or pt.target.size_x),
            size_y=override.size_y if override and override.size_y else (pt.size_y or pt.target.size_y),
            size_z=override.size_z if override and override.size_z else (pt.size_z or pt.target.size_z),
            exhaustiveness=override.exhaustiveness if override and override.exhaustiveness else (pt.exhaustiveness or pt.target.exhaustiveness),
        )
        db.add(task_target)

    await db.commit()
    await db.refresh(task)

    from app.workers.tasks import run_reinvent_task
    result = run_reinvent_task.apply_async(args=[str(task.id)], queue="gpu")
    task.celery_task_id = result.id
    task.status = "queued"
    task.queued_at = datetime.now(timezone.utc)
    await db.commit()

    return _build_task_response(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _build_task_response(task)


@router.post("/{task_id}/cancel", response_model=TaskResponse)
async def cancel_task(
    task_id: str,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status not in ("pending", "queued", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel task in status: {task.status}")

    if task.celery_task_id:
        from app.workers.celery_app import celery_app
        celery_app.control.revoke(task.celery_task_id, terminate=True)
    task.status = "cancelled"
    task.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _build_task_response(task)


@router.get("/{task_id}/log")
async def get_task_log(
    task_id: str,
    tail: int = Query(default=100, ge=1, le=1000),
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.session_id == session.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task_id": str(task_id), "log": task.error_message or "", "status": task.status}


@router.websocket("/ws/tasks/{task_id}")
async def task_websocket(
    websocket: WebSocket,
    task_id: str,
    token: str = Query(...),
):
    from app.websocket.progress import progress_manager

    await progress_manager.connect(str(task_id), websocket)
    try:
        await progress_manager.listen_and_broadcast(str(task_id))
    except WebSocketDisconnect:
        await progress_manager.disconnect(str(task_id), websocket)
    except Exception:
        await progress_manager.disconnect(str(task_id), websocket)

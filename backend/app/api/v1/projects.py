"""Project management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.session import Session
from app.models.project import Project, ProjectTarget
from app.models.target import Target
from app.models.task import Task
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem,
    ProjectTargetLink, ProjectTargetResponse,
)
from app.api.deps import get_or_create_session

router = APIRouter()


@router.get("", response_model=list[ProjectListItem])
async def list_projects(
    page: int = 1,
    page_size: int = 20,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Project)
        .where(Project.session_id == session.id)
        .order_by(Project.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    projects = result.scalars().all()

    items = []
    for p in projects:
        count_result = await db.execute(
            select(func.count(Task.id)).where(Task.project_id == p.id)
        )
        task_count = count_result.scalar() or 0
        items.append(ProjectListItem(
            id=p.id, name=p.name, description=p.description,
            created_at=p.created_at, task_count=task_count,
        ))
    return items


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        session_id=session.id,
        name=data.name,
        description=data.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        created_at=project.created_at, targets=[],
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.session_id == session.id)
        .options(selectinload(Project.project_targets).selectinload(ProjectTarget.target))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    targets = []
    for pt in project.project_targets:
        targets.append(ProjectTargetResponse(
            id=pt.id, target_id=pt.target_id, target_name=pt.target.name,
            weight=pt.weight, center_x=pt.center_x, center_y=pt.center_y,
            center_z=pt.center_z, size_x=pt.size_x, size_y=pt.size_y,
            size_z=pt.size_z, exhaustiveness=pt.exhaustiveness,
        ))

    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        created_at=project.created_at, targets=targets,
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id, Project.session_id == session.id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        created_at=project.created_at, targets=[],
    )


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(
            Project.id == project_id, Project.session_id == session.id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/targets", response_model=ProjectResponse, status_code=201)
async def link_target(
    project_id: UUID,
    data: ProjectTargetLink,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.session_id == session.id)
        .options(selectinload(Project.project_targets).selectinload(ProjectTarget.target))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    target_result = await db.execute(
        select(Target).where(Target.id == data.target_id, Target.session_id == session.id)
    )
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    existing = await db.execute(
        select(ProjectTarget).where(
            ProjectTarget.project_id == project_id,
            ProjectTarget.target_id == data.target_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Target already linked to project")

    pt = ProjectTarget(
        project_id=project_id,
        target_id=data.target_id,
        weight=data.weight,
        center_x=data.center_x,
        center_y=data.center_y,
        center_z=data.center_z,
        size_x=data.size_x,
        size_y=data.size_y,
        size_z=data.size_z,
        exhaustiveness=data.exhaustiveness,
    )
    db.add(pt)
    await db.commit()
    await db.refresh(project)

    targets = []
    for pt_item in project.project_targets + [pt]:
        t = pt_item.target if pt_item.target else target
        targets.append(ProjectTargetResponse(
            id=pt_item.id, target_id=pt_item.target_id, target_name=t.name,
            weight=pt_item.weight, center_x=pt_item.center_x, center_y=pt_item.center_y,
            center_z=pt_item.center_z, size_x=pt_item.size_x, size_y=pt_item.size_y,
            size_z=pt_item.size_z, exhaustiveness=pt_item.exhaustiveness,
        ))

    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        created_at=project.created_at, targets=targets,
    )


@router.delete("/{project_id}/targets/{target_id}", status_code=204)
async def unlink_target(
    project_id: UUID,
    target_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectTarget).where(
            ProjectTarget.project_id == project_id,
            ProjectTarget.target_id == target_id,
        )
    )
    pt = result.scalar_one_or_none()
    if not pt:
        raise HTTPException(status_code=404, detail="Target not linked to project")

    await db.delete(pt)
    await db.commit()

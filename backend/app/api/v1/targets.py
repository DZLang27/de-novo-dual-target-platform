"""Target protein management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.models.target import Target
from app.schemas.target import TargetCreate, TargetUpdate, TargetResponse, TargetListItem
from app.api.deps import get_or_create_session
from app.services.file_storage import save_target_file, get_target_path, delete_target_file

router = APIRouter()


@router.get("", response_model=list[TargetListItem])
async def list_targets(
    page: int = 1,
    page_size: int = 20,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Target)
        .where(Target.session_id == session.id)
        .order_by(Target.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return result.scalars().all()


@router.post("", response_model=TargetResponse, status_code=201)
async def create_target(
    name: str = Form(...),
    protein_name: str | None = Form(None),
    center_x: float = Form(...),
    center_y: float = Form(...),
    center_z: float = Form(...),
    size_x: float = Form(...),
    size_y: float = Form(...),
    size_z: float = Form(...),
    exhaustiveness: int = Form(16),
    file: UploadFile = File(...),
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    stored_name, original_name, file_size = await save_target_file(file)

    target = Target(
        session_id=session.id,
        name=name,
        protein_name=protein_name,
        pdbqt_filename=stored_name,
        pdbqt_file_size=file_size,
        center_x=center_x,
        center_y=center_y,
        center_z=center_z,
        size_x=size_x,
        size_y=size_y,
        size_z=size_z,
        exhaustiveness=exhaustiveness,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(
    target_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Target).where(
            Target.id == target_id,
            Target.session_id == session.id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return target


@router.patch("/{target_id}", response_model=TargetResponse)
async def update_target(
    target_id: UUID,
    data: TargetUpdate,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Target).where(
            Target.id == target_id,
            Target.session_id == session.id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(target, key, value)

    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/{target_id}", status_code=204)
async def delete_target(
    target_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Target).where(
            Target.id == target_id,
            Target.session_id == session.id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    delete_target_file(target.pdbqt_filename)
    await db.delete(target)
    await db.commit()


@router.get("/{target_id}/download")
async def download_target(
    target_id: UUID,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Target).where(
            Target.id == target_id,
            Target.session_id == session.id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    file_path = get_target_path(target.pdbqt_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=target.pdbqt_filename,
    )

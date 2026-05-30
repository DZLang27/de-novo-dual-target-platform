"""Target protein management endpoints."""

import os
import shutil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.session import Session
from app.models.target import Target
from app.schemas.target import TargetCreate, TargetUpdate, TargetResponse, TargetListItem
from app.api.deps import get_or_create_session
from app.services.file_storage import save_target_file, get_target_path, delete_target_file

router = APIRouter()


class ProteinPreparationRequest(BaseModel):
    """Request model for protein preparation."""
    remove_heterogens: bool = True
    fix_missing_heavy_atoms: bool = True
    fix_missing_hydrogens: bool = True
    pH: float = 7.4


class ProteinPreparationResponse(BaseModel):
    """Response model for protein preparation."""
    success: bool
    input_filename: str
    output_filename: str | None = None
    stats: dict | None = None
    error: str | None = None


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
    target_id: str,  # Changed from UUID to str for SQLite compatibility
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
    target_id: str,  # Changed from UUID to str for SQLite compatibility
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
    target_id: str,  # Changed from UUID to str for SQLite compatibility
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
    target_id: str,  # Changed from UUID to str for SQLite compatibility
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


@router.post("/prepare", response_model=ProteinPreparationResponse)
async def prepare_protein_endpoint(
    file: UploadFile = File(...),
    remove_heterogens: bool = Form(True),
    fix_missing_heavy_atoms: bool = Form(True),
    fix_missing_hydrogens: bool = Form(True),
    pH: float = Form(7.4),
    session: Session = Depends(get_or_create_session),
):
    """
    Prepare a protein structure for docking.
    
    Upload a PDB file and get back a prepared PDBQT file with:
    - Fixed missing residues/atoms
    - Added hydrogen atoms
    - Gasteiger partial charges
    - Suggested binding box parameters
    """
    import tempfile
    import os
    
    # Save uploaded file temporarily
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdb", delete=False) as tmp:
        tmp.write(content)
        tmp_pdb_path = tmp.name
    
    try:
        from app.services.protein_preparation import (
            prepare_protein,
            ProteinPreparationConfig
        )
        
        config = ProteinPreparationConfig(
            remove_heterogens=remove_heterogens,
            fix_missing_heavy_atoms=fix_missing_heavy_atoms,
            fix_missing_hydrogens=fix_missing_hydrogens,
            pH=pH,
            output_format="pdbqt"
        )
        
        # Prepare protein
        output_dir = tempfile.mkdtemp()
        result = prepare_protein(tmp_pdb_path, output_dir, config)
        
        if not result.success:
            return ProteinPreparationResponse(
                success=False,
                input_filename=file.filename or "unknown",
                error=result.error
            )
        
        # Save the prepared file
        prepared_filename = f"prepared_{file.filename or 'protein'}"
        if not prepared_filename.endswith(".pdbqt"):
            prepared_filename = prepared_filename.rsplit(".", 1)[0] + ".pdbqt"
        
        # Copy output to target storage
        from app.services.file_storage import TARGETS_DIR
        final_path = TARGETS_DIR / prepared_filename
        
        import shutil
        shutil.copy2(result.output_path, final_path)
        
        return ProteinPreparationResponse(
            success=True,
            input_filename=file.filename or "unknown",
            output_filename=prepared_filename,
            stats=result.stats
        )
        
    except Exception as e:
        return ProteinPreparationResponse(
            success=False,
            input_filename=file.filename or "unknown",
            error=str(e)
        )
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_pdb_path):
            os.unlink(tmp_pdb_path)


class PDBDownloadRequest(BaseModel):
    """Request model for PDB ID download."""
    pdb_id: str
    name: str | None = None  # Optional name for the target
    remove_heterogens: bool = True
    fix_missing_heavy_atoms: bool = True
    fix_missing_hydrogens: bool = True
    standardize: bool = True
    pH: float = 7.4


@router.post("/prepare-from-pdb", response_model=TargetResponse)
async def prepare_from_pdb_id(
    data: PDBDownloadRequest,
    session: Session = Depends(get_or_create_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Download PDB from RCSB by PDB ID, prepare for docking, and add to target library.

    Automatically:
    1. Downloads PDB file from https://files.rcsb.org
    2. Fixes missing residues/atoms using DockStream's PDBPreparator
    3. Converts to PDBQT format using DockStream's AutodockVinaTargetPreparator
    4. Saves to target library with suggested box parameters
    """
    import tempfile
    import os
    import httpx

    pdb_id = data.pdb_id.strip().upper()
    if len(pdb_id) != 4:
        raise HTTPException(status_code=400, detail="PDB ID 必须是 4 个字符")

    # Use PDB ID as target name if not provided
    target_name = data.name or pdb_id

    pdb_url = f"https://files.rcsb.org/download/{pdb_id}.pdb"

    try:
        # Step 1: Download PDB file
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(pdb_url)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"无法下载 PDB 文件 (HTTP {response.status_code})，请检查 PDB ID 是否正确"
                )

        # Step 2: Prepare protein
        from app.services.protein_preparation import (
            prepare_protein,
            ProteinPreparationConfig
        )

        config = ProteinPreparationConfig(
            standardize=data.standardize,
            remove_heterogens=data.remove_heterogens,
            fix_missing_heavy_atoms=data.fix_missing_heavy_atoms,
            fix_missing_hydrogens=data.fix_missing_hydrogens,
            pH=data.pH,
            output_format="pdbqt"
        )

        # Create temp directory for processing
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save downloaded PDB
            input_pdb_path = os.path.join(tmp_dir, f"{pdb_id}.pdb")
            with open(input_pdb_path, "wb") as f:
                f.write(response.content)

            # Prepare protein
            output_dir = os.path.join(tmp_dir, "output")
            result = prepare_protein(input_pdb_path, output_dir, config)

            if not result.success:
                raise HTTPException(status_code=500, detail=result.error)

            # Step 3: Save to target library
            from app.services.file_storage import TARGETS_DIR, save_target_file
            import uuid

            # Generate unique filename
            stored_name = f"{pdb_id}_{uuid.uuid4().hex[:8]}.pdbqt"
            final_path = TARGETS_DIR / stored_name

            # Copy output file
            output_file = os.path.join(output_dir, result.output_filename)
            shutil.copy2(output_file, final_path)

            # Get file size
            file_size = os.path.getsize(final_path)

            # Step 4: Create Target record in database
            target = Target(
                session_id=session.id,
                name=target_name,
                protein_name=pdb_id,
                pdbqt_filename=stored_name,
                pdbqt_file_size=file_size,
                center_x=result.stats.get("center_x", 0) if result.stats else 0,
                center_y=result.stats.get("center_y", 0) if result.stats else 0,
                center_z=result.stats.get("center_z", 0) if result.stats else 0,
                size_x=result.stats.get("size_x", 20) if result.stats else 20,
                size_y=result.stats.get("size_y", 20) if result.stats else 20,
                size_z=result.stats.get("size_z", 20) if result.stats else 20,
                exhaustiveness=16,
            )
            db.add(target)
            await db.commit()
            await db.refresh(target)

            return target

    except HTTPException:
        raise
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"网络请求失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

"""File serving endpoints - SDF poses, PDB targets. Public read access."""

from uuid import UUID
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.file_storage import get_target_path, RESULTS_DIR, TARGETS_DIR

router = APIRouter()


@router.get("/sdf/{task_id}")
async def get_pose_sdf(
    task_id: UUID,
    step: int = 0,
    smiles: str | None = None,
    target: str | None = None,
    conformer: int | None = 0,
):
    """Serve SDF poses.
    - step: RL step number (0-indexed)
    - smiles: match ligand by canonical SMILES
    - target: target index suffix for per-target SDF files
    - conformer: 0=best only, None=all conformers
    """
    target_suffix = f"_{target}" if target else ""
    sdf_path = RESULTS_DIR / str(task_id) / f"{step}poses{target_suffix}.sdf"
    if not sdf_path.exists():
        sdf_path = RESULTS_DIR / str(task_id) / f"{step}poses.sdf"
    if not sdf_path.exists():
        alt_path = RESULTS_DIR / str(task_id) / "poses.sdf"
        if alt_path.exists():
            sdf_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="SDF file not found")

    if smiles is not None:
        from rdkit import Chem
        import csv, tempfile, os
        # Step 1: find ligand_number from scores CSV
        scores_path = sdf_path.with_suffix(".csv")
        if not scores_path.exists():
            scores_path = sdf_path.parent / f"{sdf_path.stem[:-1] if sdf_path.stem.endswith('_') else sdf_path.stem}.csv"
        if not scores_path.exists():
            # Try scores_t0, scores_t1 pattern
            stem = sdf_path.stem.replace("poses", "scores")
            scores_path = sdf_path.parent / f"{stem}.csv"
        target_idx = None
        if scores_path.exists():
            with open(scores_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("smiles", "").strip() == smiles.strip():
                        target_idx = int(row.get("ligand_number", -1))
                        break
        if target_idx is None:
            raise HTTPException(status_code=404, detail="SMILES not found in scores")

        # Step 2: extract conformers by ligand_number from SDF
        supplier = Chem.SDMolSupplier(str(sdf_path), removeHs=False)
        mols = []
        for mol in supplier:
            if mol is None:
                continue
            name = mol.GetProp("_Name") if mol.HasProp("_Name") else ""
            ligand_num = name.split(":")[0] if ":" in name else name
            try:
                if int(ligand_num) == target_idx:
                    mols.append(mol)
            except ValueError:
                continue
        if not mols:
            raise HTTPException(status_code=404, detail=f"No poses matching SMILES in SDF")

        if conformer is not None:
            mols = mols[:1]

        tmp = tempfile.NamedTemporaryFile(suffix=".sdf", delete=False)
        writer = Chem.SDWriter(tmp.name)
        for m in mols:
            writer.write(m)
        writer.close()
        return FileResponse(tmp.name, media_type="chemical/x-mdl-sdfile",
                           background=lambda: os.unlink(tmp.name))

    return FileResponse(sdf_path, media_type="chemical/x-mdl-sdfile")


@router.get("/pdb/{target_id}")
async def get_target_pdb(
    target_id: UUID,
):
    # Find the PDBQT file by target_id — get filename from DB via raw connection
    from app.database import get_sync_db
    from app.models.target import Target
    from sqlalchemy import select as sa_select

    db = get_sync_db()
    try:
        target = db.execute(
            sa_select(Target).where(Target.id == target_id)
        ).scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Target not found")

        pdbqt_path = get_target_path(target.pdbqt_filename)
        if not pdbqt_path.exists():
            raise HTTPException(status_code=404, detail="PDBQT file not found on disk")
    finally:
        db.close()

    return FileResponse(
        pdbqt_path,
        media_type="chemical/x-pdb",
    )

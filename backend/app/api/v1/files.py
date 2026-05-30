"""File serving endpoints - SDF poses, PDB targets, 2D structure images. Public read access."""

from uuid import UUID
from pathlib import Path
from io import BytesIO

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from app.services.file_storage import get_target_path, RESULTS_DIR, TARGETS_DIR

router = APIRouter()


@router.get("/2d/{smiles_hash}")
async def get_molecule_2d(
    smiles_hash: str,
    width: int = Query(300, ge=100, le=800),
    height: int = Query(200, ge=100, le=600),
):
    """Generate 2D structure image from SMILES (base64 encoded in query or filename convention).
    
    For simplicity, we accept SMILES as a query parameter and generate SVG/PNG on the fly.
    This endpoint caches nothing - frontend should cache the response.
    """
    # This endpoint is not used directly; see the SMILES-based endpoint below
    raise HTTPException(status_code=404, detail="Use /files/2d-image endpoint")


@router.get("/2d-image")
async def get_molecule_2d_image(
    smiles: str = Query(..., description="SMILES string"),
    width: int = Query(300, ge=100, le=800),
    height: int = Query(200, ge=100, le=600),
):
    """Generate 2D molecular structure image from SMILES as SVG."""
    from rdkit import Chem
    from rdkit.Chem import Draw, AllChem
    from io import BytesIO

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES string")

    AllChem.Compute2DCoords(mol)
    drawer = Draw.MolDraw2DSVG(width, height)
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()

    svg_data = drawer.GetDrawingText()
    return StreamingResponse(
        BytesIO(svg_data.encode("utf-8")),
        media_type="image/svg+xml",
    )


@router.get("/sdf/{task_id}")
async def get_pose_sdf(
    task_id: str,
    step: int = 0,
    smiles: str | None = None,
    target: str | None = None,
    conformer: int | None = 0,
):
    """Serve SDF poses.
    - step: RL step number (0-indexed)
    - smiles: match ligand by canonical SMILES
    - target: target index suffix (e.g. "t0", "t1")
    - conformer: 0=best only, None=all conformers
    """
    result_dir = RESULTS_DIR / str(task_id)
    
    # Try different SDF file patterns
    sdf_path = None
    
    # Pattern 1: {step}poses_{target}.sdf (with target suffix)
    if target:
        sdf_path = result_dir / f"{step}poses_{target}.sdf"
        if sdf_path.exists():
            pass  # found
        else:
            sdf_path = None
    
    # Pattern 2: {step}poses_t0.sdf (default to first target)
    if sdf_path is None:
        sdf_path = result_dir / f"{step}poses_t0.sdf"
        if sdf_path.exists():
            pass
        else:
            sdf_path = None
    
    # Pattern 3: {step}poses.sdf
    if sdf_path is None:
        sdf_path = result_dir / f"{step}poses.sdf"
        if sdf_path.exists():
            pass
        else:
            sdf_path = None
    
    # Pattern 4: poses.sdf
    if sdf_path is None:
        sdf_path = result_dir / "poses.sdf"
        if sdf_path.exists():
            pass
        else:
            raise HTTPException(status_code=404, detail=f"SDF file not found in {result_dir}")

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
    target_id: str,
    remove_ligand: bool = Query(default=False, description="Remove reference ligand"),
):
    """Return target protein as pure PDB format.
    
    - remove_ligand: if True, remove HETATM ligands (keep only ATOM and water)
    """
    from app.database import get_sync_db
    from app.models.target import Target
    from sqlalchemy import select as sa_select
    import tempfile, os

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

    # Water residue names to keep
    water_names = {'HOH', 'WAT', 'H2O', 'OH2', 'TIP', 'TIP3', 'TIP4', 'DOD'}

    # Convert PDBQT to pure PDB
    with open(pdbqt_path, 'r') as f:
        lines = f.readlines()

    pdb_lines = []
    for line in lines:
        if line.startswith('ATOM'):
            pdb_lines.append(line[:80].rstrip() + '\n')
        elif line.startswith('HETATM'):
            if not remove_ligand:
                # Keep all HETATM
                pdb_lines.append(line[:80].rstrip() + '\n')
            else:
                # Only keep water molecules
                res_name = line[17:20].strip() if len(line) > 20 else ''
                if res_name in water_names:
                    pdb_lines.append(line[:80].rstrip() + '\n')
        elif line.startswith(('TER', 'END')):
            pdb_lines.append(line[:80].rstrip() + '\n')

    # Write to temp file and return
    tmp = tempfile.NamedTemporaryFile(suffix='.pdb', delete=False, mode='w')
    tmp.writelines(pdb_lines)
    tmp.close()

    return FileResponse(
        tmp.name,
        media_type="chemical/x-pdb",
        background=lambda: os.unlink(tmp.name),
    )

"""Protein preparation service - using DockStream's PDBPreparator and AutodockVinaTargetPreparator."""

import os
import sys
import uuid
import shutil
import tempfile
import subprocess
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

# Add DockStream to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "DockStream"))


class ProteinPreparationConfig(BaseModel):
    """Configuration for protein preparation."""
    standardize: bool = True
    remove_heterogens: bool = True
    fix_missing_heavy_atoms: bool = True
    fix_missing_hydrogens: bool = True
    add_water_box: bool = False
    pH: float = 7.4
    output_format: str = "pdbqt"


class ProteinPreparationResult(BaseModel):
    """Result of protein preparation."""
    success: bool
    input_filename: str
    output_filename: Optional[str] = None
    fixed_pdb_filename: Optional[str] = None
    stats: Optional[dict] = None
    error: Optional[str] = None


def _get_fixer_config(config: ProteinPreparationConfig) -> dict:
    """Convert config to DockStream's fixer configuration format."""
    return {
        "target_preparation": {
            "input_path": "dummy.pdb",
            "fixer": {
                "enabled": True,
                "standardize": config.standardize,
                "remove_heterogens": config.remove_heterogens,
                "fix_missing_heavy_atoms": config.fix_missing_heavy_atoms,
                "fix_missing_hydrogens": config.fix_missing_hydrogens,
                "fix_missing_loops": False,
                "add_water_box": config.add_water_box,
            },
            "runs": [{
                "backend": "AutoDockVina",
                "parameters": {
                    "pH": config.pH,
                },
                "output": {
                    "receptor_path": "receptor.pdbqt"
                }
            }]
        }
    }


def _fix_pdb_with_dockstream(input_pdb: str, output_pdb: str, config: ProteinPreparationConfig) -> bool:
    """Fix PDB using DockStream's PDBPreparator."""
    try:
        from dockstream.core.pdb_preparator import PDBPreparator
        from dockstream.containers.target_preparation_container import TargetPreparationContainer

        # Create configuration container
        fixer_config = _get_fixer_config(config)
        container = TargetPreparationContainer(conf=fixer_config, validation=False)

        # Create preparator and fix PDB
        preparator = PDBPreparator(conf=container)
        preparator.fix_pdb(input_pdb_file=input_pdb, output_pdb_file=output_pdb)

        return os.path.exists(output_pdb)
    except Exception as e:
        print(f"DockStream PDBFixer failed: {e}")
        return False


def _convert_pdb_to_pdbqt_with_dockstream(
    fixed_pdb: str,
    output_pdbqt: str,
    config: ProteinPreparationConfig
) -> bool:
    """Convert PDB to PDBQT using DockStream's AutodockVinaTargetPreparator."""
    try:
        from rdkit import Chem
        from dockstream.core.AutodockVina.AutodockVina_target_preparator import AutodockVinaTargetPreparator
        from dockstream.containers.target_preparation_container import TargetPreparationContainer

        # Create configuration container
        fixer_config = _get_fixer_config(config)
        fixer_config["target_preparation"]["runs"][0]["output"]["receptor_path"] = output_pdbqt
        container = TargetPreparationContainer(conf=fixer_config, validation=False)

        # Load PDB with RDKit
        mol = Chem.MolFromPDBFile(fixed_pdb, sanitize=False)
        if mol is None:
            print("RDKit failed to load PDB file")
            return False

        # Create preparator
        preparator = AutodockVinaTargetPreparator(conf=container, target=mol)

        # Export as PDBQT
        preparator._export_as_pdb2pdbqt(output_pdbqt)

        return os.path.exists(output_pdbqt)
    except Exception as e:
        print(f"DockStream PDBQT conversion failed: {e}")
        return False


def _convert_pdb_to_pdbqt_with_obabel(
    input_pdb: str,
    output_pdbqt: str,
    pH: float = 7.4
) -> bool:
    """Fallback: Convert PDB to PDBQT using OpenBabel directly."""
    try:
        cmd = [
            "obabel",
            input_pdb,
            "-opdbqt",
            "-O", output_pdbqt,
            "-xr",
            "-p", str(pH),
            "--partialcharge", "gasteiger"
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.returncode == 0 and os.path.exists(output_pdbqt)
    except FileNotFoundError:
        print("OpenBabel not found")
        return False
    except subprocess.TimeoutExpired:
        print("OpenBabel timeout")
        return False


def _clean_pdbqt_file(pdbqt_path: str):
    """Clean PDBQT file to only keep lines Vina can parse.

    Only keeps ATOM, HETATM, TER lines.
    Strips Windows carriage returns (\\r) and trailing spaces.
    """
    valid_prefixes = ('ATOM', 'HETATM', 'TER')
    cleaned_lines = []

    with open(pdbqt_path, 'r') as f:
        for line in f:
            line = line.rstrip('\r\n').rstrip()
            if line.startswith(valid_prefixes):
                cleaned_lines.append(line + '\n')

    # Add TER at end if missing
    if cleaned_lines and not cleaned_lines[-1].startswith('TER'):
        cleaned_lines.append('TER\n')

    with open(pdbqt_path, 'w', newline='') as f:
        f.writelines(cleaned_lines)


def _calculate_protein_stats(pdb_path: str) -> dict:
    """
    Calculate protein statistics and extract docking box from ligand.

    Following DockStream's _extract_box() approach:
    - Box center = mean of ligand coordinates
    - Box size = (max - min) + 5 Angstrom per axis

    The box is calculated from HETATM records (ligands) in the PDB file.
    If no ligand is found, uses protein center with default box size (25Å).
    """
    try:
        from rdkit import Chem

        # Water residue names to exclude
        WATER_NAMES = {"WAT", "HOH", "H2O", "OH2", "TIP", "TIP3", "TIP4", "DOD"}

        # Parse PDB file to extract ligand atoms (HETATM, excluding water)
        ligand_coords = []
        protein_coords = []

        with open(pdb_path, 'r') as f:
            for line in f:
                if line.startswith("HETATM"):
                    residue_name = line[17:20].strip()
                    # Skip water molecules
                    if residue_name in WATER_NAMES:
                        continue
                    # Extract coordinates (columns 31-38, 39-46, 47-54)
                    try:
                        x = float(line[30:38].strip())
                        y = float(line[38:46].strip())
                        z = float(line[46:54].strip())
                        ligand_coords.append((x, y, z))
                    except (ValueError, IndexError):
                        continue
                elif line.startswith("ATOM"):
                    # Extract protein coordinates for fallback
                    try:
                        x = float(line[30:38].strip())
                        y = float(line[38:46].strip())
                        z = float(line[46:54].strip())
                        protein_coords.append((x, y, z))
                    except (ValueError, IndexError):
                        continue

        # Calculate box based on ligand coordinates (DockStream approach)
        if ligand_coords:
            x_coords = [c[0] for c in ligand_coords]
            y_coords = [c[1] for c in ligand_coords]
            z_coords = [c[2] for c in ligand_coords]

            # Center = mean of ligand coordinates
            center_x = sum(x_coords) / len(x_coords)
            center_y = sum(y_coords) / len(y_coords)
            center_z = sum(z_coords) / len(z_coords)

            # Size = (max - min) + 5  (DockStream convention)
            size_x = (max(x_coords) - min(x_coords)) + 5
            size_y = (max(y_coords) - min(y_coords)) + 5
            size_z = (max(z_coords) - min(z_coords)) + 5

            source = "ligand"
        elif protein_coords:
            # Fallback: use protein center with default box size
            x_coords = [c[0] for c in protein_coords]
            y_coords = [c[1] for c in protein_coords]
            z_coords = [c[2] for c in protein_coords]

            center_x = (min(x_coords) + max(x_coords)) / 2
            center_y = (min(y_coords) + max(y_coords)) / 2
            center_z = (min(z_coords) + max(z_coords)) / 2

            # Default box size (25Å cube)
            size_x = size_y = size_z = 25.0

            source = "protein_center"
        else:
            center_x = center_y = center_z = 0
            size_x = size_y = size_z = 25.0
            source = "default"

        # Count atoms and residues
        mol = Chem.MolFromPDBFile(pdb_path, removeHs=False)
        num_atoms = mol.GetNumAtoms() if mol else 0
        num_residues = 0
        if mol:
            num_residues = len(set(
                atom.GetPDBResidueInfo().GetResidueName()
                for atom in mol.GetAtoms()
                if atom.GetPDBResidueInfo() is not None
            ))

        return {
            "num_atoms": num_atoms,
            "num_residues": num_residues,
            "center_x": round(center_x, 3),
            "center_y": round(center_y, 3),
            "center_z": round(center_z, 3),
            "size_x": round(size_x, 3),
            "size_y": round(size_y, 3),
            "size_z": round(size_z, 3),
            "box_source": source,  # "ligand" or "protein_center"
            "num_ligand_atoms": len(ligand_coords),
        }
    except Exception as e:
        print(f"Stats calculation failed: {e}")
        return {}


def prepare_protein(
    input_pdb_path: str,
    output_dir: str,
    config: Optional[ProteinPreparationConfig] = None,
) -> ProteinPreparationResult:
    """
    Prepare a protein structure for docking using DockStream.

    Steps:
    1. Fix PDB structure using DockStream's PDBPreparator (wraps PDBFixer)
    2. Convert PDB to PDBQT using DockStream's AutodockVinaTargetPreparator
    3. Calculate protein statistics and suggest docking box parameters

    Args:
        input_pdb_path: Path to input PDB file
        output_dir: Directory to save output files
        config: Preparation configuration

    Returns:
        ProteinPreparationResult with output paths and status
    """
    if config is None:
        config = ProteinPreparationConfig()

    input_path = Path(input_pdb_path)
    if not input_path.exists():
        return ProteinPreparationResult(
            success=False,
            input_filename=str(input_pdb_path),
            error=f"Input file not found: {input_pdb_path}"
        )

    os.makedirs(output_dir, exist_ok=True)
    input_filename = input_path.name

    try:
        # Step 1: Fix PDB using DockStream
        fixed_pdb_path = os.path.join(output_dir, f"fixed_{input_filename}")
        fix_success = _fix_pdb_with_dockstream(str(input_path), fixed_pdb_path, config)

        if not fix_success:
            # Fallback: use original PDB
            fixed_pdb_path = str(input_path)
            fixed_pdb_filename = input_filename
        else:
            fixed_pdb_filename = f"fixed_{input_filename}"

        # Step 2: Convert to PDBQT
        output_pdbqt = os.path.join(output_dir, "receptor.pdbqt")

        # Try DockStream first
        convert_success = _convert_pdb_to_pdbqt_with_dockstream(fixed_pdb_path, output_pdbqt, config)

        if not convert_success:
            # Fallback: use OpenBabel directly
            convert_success = _convert_pdb_to_pdbqt_with_obabel(fixed_pdb_path, output_pdbqt, config.pH)

        if not convert_success:
            # Last resort: copy fixed PDB as output
            output_pdbqt = os.path.join(output_dir, "receptor.pdb")
            shutil.copy2(fixed_pdb_path, output_pdbqt)

        # Step 2.5: Clean PDBQT file (remove HEADER/REMARK/etc that Vina can't parse)
        if output_pdbqt.endswith('.pdbqt'):
            _clean_pdbqt_file(output_pdbqt)

        # Step 3: Calculate statistics
        stats = _calculate_protein_stats(fixed_pdb_path)

        return ProteinPreparationResult(
            success=True,
            input_filename=input_filename,
            output_filename=os.path.basename(output_pdbqt),
            fixed_pdb_filename=fixed_pdb_filename,
            stats=stats,
        )

    except Exception as e:
        return ProteinPreparationResult(
            success=False,
            input_filename=input_filename,
            error=str(e)
        )


async def download_pdb_from_rcsb(pdb_id: str, output_dir: str) -> Optional[str]:
    """
    Download PDB file from RCSB PDB database.

    Args:
        pdb_id: 4-character PDB ID
        output_dir: Directory to save the file

    Returns:
        Path to downloaded PDB file, or None if failed
    """
    import httpx

    pdb_id = pdb_id.strip().upper()
    if len(pdb_id) != 4:
        return None

    pdb_url = f"https://files.rcsb.org/download/{pdb_id}.pdb"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(pdb_url)
            if response.status_code != 200:
                return None

            # Save PDB file
            pdb_path = os.path.join(output_dir, f"{pdb_id}.pdb")
            with open(pdb_path, "wb") as f:
                f.write(response.content)

            return pdb_path
    except Exception as e:
        print(f"Download failed: {e}")
        return None

"""File storage service - handles PDBQT uploads and result file management."""

import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException

from app.config import settings


UPLOAD_DIR = Path(settings.DATA_DIR)
TARGETS_DIR = UPLOAD_DIR / "targets"
RESULTS_DIR = UPLOAD_DIR / "results"
TASKS_DIR = UPLOAD_DIR / "tasks"

ALLOWED_EXTENSIONS = {".pdbqt", ".pdb"}


def ensure_dirs():
    for d in [TARGETS_DIR, RESULTS_DIR, TASKS_DIR]:
        d.mkdir(parents=True, exist_ok=True)


ensure_dirs()


def validate_pdbqt(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


async def save_target_file(file: UploadFile) -> tuple[str, str, int]:
    """Save uploaded PDBQT file. Returns (stored_filename, original_filename, file_size)."""
    if not validate_pdbqt(file.filename or ""):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = TARGETS_DIR / unique_name

    content = await file.read()
    file_size = len(content)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    return unique_name, file.filename or "unknown.pdbqt", file_size


def get_target_path(filename: str) -> Path:
    return TARGETS_DIR / filename


def get_task_config_dir(task_id: str) -> Path:
    d = TASKS_DIR / task_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_task_result_dir(task_id: str) -> Path:
    d = RESULTS_DIR / task_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_pose_path(task_id: str, filename: str) -> Path:
    return RESULTS_DIR / task_id / filename


def delete_target_file(filename: str):
    path = TARGETS_DIR / filename
    if path.exists():
        path.unlink()

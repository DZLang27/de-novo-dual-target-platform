"""Celery task for running REINVENT4 containers."""

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import docker
import redis as redis_lib
from celery import Task
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.workers.celery_app import celery_app
from app.workers.gpu_lock import GPULock
from app.database import get_sync_db
from app.models.task import Task as TaskModel
from app.services.file_storage import (
    get_task_config_dir, get_task_result_dir, TARGETS_DIR,
)

r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)


class ReinventTask(Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        gpu_lock = GPULock(task_id)
        gpu_lock.release()

        db = get_sync_db()
        try:
            task = db.query(TaskModel).filter(TaskModel.id == args[0]).first()
            if task:
                task.status = "failed"
                task.error_message = str(exc)
                task.completed_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()

        r.publish(f"task:{args[0]}:progress", json.dumps({
            "type": "error",
            "message": str(exc),
        }))

    def on_success(self, retval, task_id, args, kwargs):
        gpu_lock = GPULock(task_id)
        gpu_lock.release()


@celery_app.task(
    bind=True,
    base=ReinventTask,
    max_retries=0,
    acks_late=True,
    time_limit=90000,
    soft_time_limit=86400,
)
def run_reinvent_task(self, task_id: str):
    gpu_lock = GPULock(task_id)
    if not gpu_lock.acquire(timeout=settings.GPU_LOCK_TIMEOUT):
        raise Exception(f"GPU lock timeout for task {task_id}")

    db = get_sync_db()
    task = None
    container = None

    try:
        task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
        if not task:
            raise Exception(f"Task {task_id} not found")

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        db.commit()

        # Prepare directories
        config_dir = get_task_config_dir(task_id)
        result_dir = get_task_result_dir(task_id)

        # Write TOML config
        with open(config_dir / "config.toml", "w", encoding="utf-8") as f:
            f.write(task.toml_config)

        # Write DockStream configs
        if task.dockstream_configs:
            ds_configs = json.loads(task.dockstream_configs)
            for target_name, ds_json in ds_configs.items():
                ds_path = config_dir / f"dockstream_{target_name}.json"
                with open(ds_path, "w", encoding="utf-8") as f:
                    f.write(ds_json if isinstance(ds_json, str) else json.dumps(ds_json))

        # Run REINVENT4 container (detach=True for Container object, no auto-remove)
        client = docker.from_env()
        container = client.containers.run(
            image=settings.REINVENT4_IMAGE,
            command=[
                "run_reinvent", "reinvent",
                "/data/config/config.toml",
            ],
            volumes={
                str(config_dir): {"bind": "/data/config", "mode": "rw"},
                str(TARGETS_DIR): {"bind": "/data/targets", "mode": "ro"},
                str(result_dir): {"bind": "/output", "mode": "rw"},
            },
            device_requests=None,
            detach=True,
            remove=False,
        )

        task.container_id = container.id
        db.commit()

        # Wait for container to exit, publish logs, then clean up
        result = container.wait()
        exit_code = result["StatusCode"]
        r.publish(f"task:{task_id}:log", container.logs().decode("utf-8", errors="replace"))
        container.remove()

        if exit_code != 0:
            raise Exception(f"REINVENT4 container exited with code {exit_code}")

        # Parse results
        parse_and_store_results(task_id, str(result_dir), db)

        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        db.commit()

        r.publish(f"task:{task_id}:progress", json.dumps({
            "type": "completed",
            "total_molecules": task.total_molecules,
            "message": "Task completed successfully",
        }))

    except Exception as e:
        if task:
            task.status = "failed"
            task.error_message = str(e)
            task.completed_at = datetime.now(timezone.utc)
            db.commit()

        r.publish(f"task:{task_id}:progress", json.dumps({
            "type": "error",
            "message": str(e),
        }))
        raise
    finally:
        gpu_lock.release()
        db.close()


def parse_and_store_results(task_id: str, result_dir: str, db: DBSession):
    """Parse REINVENT4 output CSV and DockStream SDF files into DB.

    REINVENT4 outputs run_*.csv with columns:
      Agent, Prior, Target, Score, SMILES, SMILES_state, Scaffold,
      <component1>, <component1> (raw), <component2>, <component2> (raw), ..., step
    The Score column is the total aggregated score.
    """
    import csv
    from app.models.molecule import Molecule

    csv_files = sorted(Path(result_dir).glob("run_*.csv"))
    if not csv_files:
        return

    molecules_to_insert = []
    best_score = None
    max_step = 0
    step_index: dict[int, int] = {}

    for csv_path in csv_files:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                smiles = row.get("SMILES", "").strip()
                if not smiles or smiles == ".":
                    continue

                total_score = float(row.get("Score", 0))
                # CSV step is 1-indexed, SDF files are 0-indexed
                step_number = int(float(row.get("step", 0))) - 1

                # Extract component scores: columns not in the fixed set
                fixed_cols = {"Agent", "Prior", "Target", "Score", "SMILES",
                              "SMILES_state", "Scaffold", "step"}
                component_scores = {}
                for key, val in row.items():
                    key_stripped = key.strip()
                    if key_stripped not in fixed_cols and key_stripped.endswith(" (raw)"):
                        # Store raw score, strip the "(raw)" suffix
                        raw_name = key_stripped.replace(" (raw)", "")
                        try:
                            component_scores[raw_name] = float(val)
                        except (ValueError, TypeError):
                            pass

                if step_number not in step_index:
                    step_index[step_number] = 0
                mol_sdf_idx = step_index[step_number]
                step_index[step_number] += 1

                molecules_to_insert.append({
                    "task_id": task_id,
                    "smiles": smiles,
                    "step_number": step_number,
                    "total_score": total_score,
                    "component_scores": component_scores,
                    "sdf_index": mol_sdf_idx,
                })

                if best_score is None or total_score > best_score:
                    best_score = total_score
                if step_number > max_step:
                    max_step = step_number

    # Batch insert
    if molecules_to_insert:
        db.execute(Molecule.__table__.insert(), molecules_to_insert)

    # Update task summary
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if task:
        task.total_molecules = len(molecules_to_insert)
        task.best_score = best_score
        task.current_step = max_step
        db.commit()

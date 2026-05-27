"""API v1 router - aggregates all endpoint modules."""

from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.api.v1.session import router as session_router
from app.api.v1.targets import router as targets_router
from app.api.v1.projects import router as projects_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.results import router as results_router
from app.api.v1.files import router as files_router

api_router = APIRouter()

api_router.include_router(session_router, prefix="/session", tags=["session"])
api_router.include_router(targets_router, prefix="/targets", tags=["targets"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
api_router.include_router(tasks_router, prefix="/tasks", tags=["tasks"])
api_router.include_router(results_router, tags=["results"])
api_router.include_router(files_router, prefix="/files", tags=["files"])


@api_router.websocket("/ws/tasks/{task_id}")
async def task_ws(
    websocket: WebSocket,
    task_id: UUID,
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

import logging

from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse
from backend.schemas import YoutubeRequest, TaskResponse
from pathlib import Path
from backend.redis_queue.tasks import enqueue_video, get_job_status

router = APIRouter(prefix="/process", tags=["Summaries"])
logger = logging.getLogger(__name__)

@router.post("/", response_model=TaskResponse)
async def process_video_route(data: YoutubeRequest):
    job_id = enqueue_video(data.url)
    logger.info("Created task id=%s", job_id)
    return {"task_id": job_id, "status": "queued"}

@router.get("/{task_id}")
async def get_task_file(task_id: str):
    status = get_job_status(task_id)
    logger.info("GET task id=%s status=%s", task_id, status)
    if status["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Task not found")

    if status["status"] == "failed":
        return {"task_id": task_id, "status": "failed", "error": status.get("result")}

    if status["status"] != "done":
        response = {"task_id": task_id}
        response.update(status)
        return response

    result_path = status.get("result")
    if not result_path:
        raise HTTPException(status_code=500, detail="Task finished but result path is missing")

    summary_file = Path(result_path)
    if not summary_file.is_absolute():
        summary_file = (Path.cwd() / summary_file).resolve()

    if not summary_file.exists():
        raise HTTPException(status_code=404, detail="File not found")

    logger.info("Serving file for task id=%s path=%s", task_id, summary_file)

    return FileResponse(
        path=str(summary_file),
        filename=summary_file.name,
        media_type="text/plain"
    )

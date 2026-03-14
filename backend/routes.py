from fastapi import APIRouter
from fastapi.exceptions import HTTPException
from fastapi.responses import FileResponse
from backend.schemas import YoutubeRequest, TaskResponse
from pathlib import Path
from backend.redis_queue.tasks import enqueue_video, get_job_status

router = APIRouter(prefix="/process", tags=["Summaries"])

@router.post("/", response_model=TaskResponse)
async def process_video_route(data: YoutubeRequest):
    job_id = enqueue_video(data.url)
    return {"task_id": job_id, "status": "queued"}

@router.get("/{task_id}")
async def get_task_file(task_id: str):
    status = get_job_status(task_id)
    summary_file = Path(f"./results/{task_id}.txt")

    if status["status"] != "done":
        return {"task_id": task_id, "status": status["status"]}

    if not summary_file.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(summary_file),
        filename=summary_file.name,
        media_type="text/plain"
    )

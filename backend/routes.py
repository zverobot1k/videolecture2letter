from fastapi import APIRouter
from backend.schemas import YoutubeRequest, TaskResponse
from backend.redis_queue.tasks import enqueue_video, get_job_status

router = APIRouter(prefix="/process", tags=["Summaries"])

@router.post("/", response_model=TaskResponse)
async def process_video_route(data: YoutubeRequest):
    job_id = enqueue_video(data.url)
    return {"task_id": job_id, "status": "queued"}

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    status = get_job_status(task_id)
    return {"task_id": task_id, "status": status["status"], "responce": {summary_file}}

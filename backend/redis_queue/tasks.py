import logging

from rq import Queue

from backend.redis_queue.redis_connection import redis_conn
from backend.services.summarizer import process_video

q = Queue(connection=redis_conn)
logger = logging.getLogger(__name__)

def enqueue_video(url: str, prompt: str, user_id: int, summary_id: int, size: str, token_cost: int):
    job = q.enqueue(
        process_video,
        url,
        prompt,
        user_id,
        summary_id,
        size,
        token_cost,
        job_timeout=3600,
    )
    job.meta["user_id"] = user_id
    job.meta["summary_id"] = summary_id
    job.meta["size"] = size
    job.meta["token_cost"] = token_cost
    job.save_meta()
    logger.info("Enqueued job id=%s queue=%s url=%s", job.id, q.name, url)
    return job.id

def get_job_status(job_id: str):
    job = q.fetch_job(job_id)
    if not job:
        logger.warning("Job not found id=%s", job_id)
        return {"status": "not_found"}

    current_status = job.get_status(refresh=True)
    stage = job.meta.get("stage")
    logger.info("Job status id=%s status=%s", job_id, current_status)

    if current_status == "finished":
        return {"status": "done", "stage": stage or "done", "result": job.result}
    if current_status == "queued":
        position = q.get_job_position(job)
        return {"status": "queued", "stage": stage or "queued", "position": position}
    if current_status == "started":
        return {"status": "started", "stage": stage or "extract_audio"}
    if current_status in {"stopped", "canceled", "cancelled"}:
        return {"status": "failed", "stage": stage or "failed", "result": "cancelled"}
    if current_status == "failed":
        return {"status": "failed", "stage": stage or "failed", "result": str(job.exc_info)}
    return {"status": current_status or "unknown", "stage": stage or "unknown"}


def cancel_job(job_id: str):
    job = q.fetch_job(job_id)
    if not job:
        return {"status": "not_found", "cancelled": False}

    current_status = job.get_status(refresh=True)
    if current_status in {"finished", "failed", "stopped", "canceled", "cancelled"}:
        return {"status": current_status, "cancelled": False}

    if current_status == "started":
        return {"status": "started", "cancelled": False, "detail": "cannot_cancel_started"}

    job.cancel()
    return {"status": current_status, "cancelled": True, "detail": "cancelled"}
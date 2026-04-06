import logging

from rq import Queue
from backend.redis_queue.redis_connection import redis_conn
from backend.services.summarizer import process_video

q = Queue(connection=redis_conn)
logger = logging.getLogger(__name__)

def enqueue_video(url: str, prompt: str):
    job = q.enqueue(process_video, url, prompt, job_timeout=3600)
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
    if current_status == "failed":
        return {"status": "failed", "stage": stage or "failed", "result": str(job.exc_info)}
    return {"status": current_status or "unknown", "stage": stage or "unknown"}
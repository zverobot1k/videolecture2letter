from rq import Queue
from backend.redis_queue.redis_connection import redis_conn
from backend.services.summarizer import process_video

q = Queue(connection=redis_conn)

def enqueue_video(url: str):
    job = q.enqueue(process_video, url, job_timeout=3600)
    return job.id

def get_job_status(job_id: str):
    job = q.fetch_job(job_id)
    if not job:
        return "not found"
    if job.is_finished:
        return {"status": "done", "result": job.result}
    elif job.is_queued:
        return {"status": "queued"}
    elif job.is_started:
        return {"status": "started"}
    elif job.is_failed:
        return {"status": "failed", "result": str(job.exc_info)}
    return {"status": "unknown"}
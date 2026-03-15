import logging
import sys

import torch
from rq import Queue, SimpleWorker
from backend.redis_queue.redis_connection import redis_conn
from backend.services.summarizer import process_video  # твоя функция

# Ограничиваем потоки для macOS
torch.set_num_threads(1)

listen = ["default"]

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    logger = logging.getLogger(__name__)
    logger.info("Worker python executable: %s", sys.executable)

    redis_conn.ping()
    logger.info("Redis connection OK")

    queues = [Queue(name, connection=redis_conn) for name in listen]
    logger.info("Worker listening queues=%s", [queue.name for queue in queues])

    worker = SimpleWorker(queues)
    worker.work(logging_level="INFO")
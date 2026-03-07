import torch
from rq import Worker, Queue
from backend.redis_queue.redis_connection import redis_conn
from backend.services.summarizer import process_video  # твоя функция

# Ограничиваем потоки для macOS
torch.set_num_threads(1)

listen = ["default"]

if __name__ == "__main__":
    queues = [Queue(name, connection=redis_conn) for name in listen]
    worker = Worker(queues)
    worker.work()
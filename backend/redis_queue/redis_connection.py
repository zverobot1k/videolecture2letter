import os

from redis import Redis

redis_host = os.getenv("REDIS_HOST", "localhost")
redis_port = int(os.getenv("REDIS_PORT", "6379"))

redis_conn = Redis(host=redis_host, port=redis_port)

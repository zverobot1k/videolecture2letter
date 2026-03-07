from redis import Redis

redis_conn = Redis(host="localhost", port=6379)
print(redis_conn.ping())
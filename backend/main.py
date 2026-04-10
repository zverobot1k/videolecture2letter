import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.database import init_db
from backend.routes import router

logger = logging.getLogger(__name__)
app = FastAPI(title="Video Summarizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(router)


@app.on_event("startup")
async def startup_log_runtime():
    init_db()
    logger.info("API python executable: %s", sys.executable)
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import router

logger = logging.getLogger(__name__)
app = FastAPI(title="Video Summarizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.on_event("startup")
async def startup_log_runtime():
    logger.info("API python executable: %s", sys.executable)
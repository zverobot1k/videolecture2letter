from fastapi import FastAPI
from backend.routes import router

app = FastAPI(title="Video Summarizer API")
app.include_router(router)
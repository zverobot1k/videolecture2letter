
from fastapi import APIRouter
from backend.app.schemas.summary_schema import YoutubeRequest

router = APIRouter(prefix="/process", tags=["Summaries"])


# @router.post("/")
# async def create_summary(data: YoutubeRequest):
#     result = await process_summary(data.url)
#     return {"summary": result}


@router.post("/process")
async def process_video(data: YoutubeRequest):
    return {
        "status": "ok",
        "message": f"Видео {data.url} получено "
    }
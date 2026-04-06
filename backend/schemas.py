from pydantic import BaseModel

class YoutubeRequest(BaseModel):
    url: str
    prompt: str

class TaskResponse(BaseModel):
    task_id: str
    status: str
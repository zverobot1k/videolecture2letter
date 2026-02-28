from pydantic import BaseModel

class YoutubeRequest(BaseModel):
    url: str
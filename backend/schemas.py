from datetime import datetime
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
}

class YoutubeRequest(BaseModel):
    url: str
    prompt: str
    size: str = Field(default="medium")

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, value: str) -> str:
        parsed = urlparse(value.strip())
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("Ссылка должна начинаться с http:// или https://")

        host = (parsed.netloc or "").lower()
        if host.startswith("www.") and host not in YOUTUBE_HOSTS:
            host = host[4:]

        if host not in YOUTUBE_HOSTS:
            raise ValueError("Разрешены только ссылки YouTube")

        return value.strip()

class TaskResponse(BaseModel):
    task_id: str
    status: str
    summary_id: int | None = None
    balance_tokens: int | None = None


class TaskCancelResponse(BaseModel):
    task_id: str
    status: str
    detail: str
    balance_tokens: int | None = None


class AuthRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPayload(BaseModel):
    sub: str | None = None
    email: str | None = None
    type: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    balance_tokens: int
    is_admin: bool
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SummaryResponse(BaseModel):
    id: int
    task_id: str | None
    source_url: str
    prompt: str
    size: str
    token_cost: int
    status: str
    file_path: str | None
    error: str | None
    created_at: datetime
    updated_at: datetime


class SummaryListResponse(BaseModel):
    summaries: list[SummaryResponse]


class AdminSearchResponse(BaseModel):
    user: UserResponse


class AdminBalanceUpdateRequest(BaseModel):
    balance_tokens: int


class AdminBalanceUpdateResponse(BaseModel):
    user: UserResponse
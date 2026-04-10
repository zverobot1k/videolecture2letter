from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_refresh_user,
    hash_password,
    require_admin,
    verify_password,
)
from backend.redis_queue.tasks import enqueue_video
from backend.schemas import (
    AdminBalanceUpdateRequest,
    AdminBalanceUpdateResponse,
    AdminSearchResponse,
    AuthRequest,
    AuthResponse,
    RefreshRequest,
    RefreshResponse,
    SummaryListResponse,
    SummaryResponse,
    TaskCancelResponse,
    TaskResponse,
    UserResponse,
    YoutubeRequest,
)
from database.database import SessionLocal, get_db
from database.models import Summary, SummaryStatus, User
from backend.redis_queue.tasks import cancel_job, get_job_status


router = APIRouter(tags=["API"])
logger = logging.getLogger(__name__)

SUMMARY_COSTS = {
    "short": 10,
    "medium": 50,
    "detailed": 100,
}
DEFAULT_TOKEN_BALANCE = int(os.getenv("DEFAULT_TOKEN_BALANCE", "100"))


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        balance_tokens=user.balance_tokens,
        is_admin=user.id == int(os.getenv("ADMIN_USER_ID", "2")),
        created_at=user.created_at,
    )


def serialize_summary(summary: Summary) -> SummaryResponse:
    return SummaryResponse(
        id=summary.id,
        task_id=summary.task_id,
        source_url=summary.source_url,
        prompt=summary.prompt,
        size=summary.size,
        token_cost=summary.token_cost,
        status=summary.status.value if hasattr(summary.status, "value") else str(summary.status),
        file_path=summary.file_path,
        error=summary.error,
        created_at=summary.created_at,
        updated_at=summary.updated_at,
    )


def get_cost_for_size(size: str) -> int:
    normalized = size.lower().strip()
    if normalized not in SUMMARY_COSTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестный размер конспекта")
    return SUMMARY_COSTS[normalized]


def get_summary_or_404(db: Session, task_id: str, user: User) -> Summary:
    summary = db.scalar(select(Summary).where(Summary.task_id == task_id))
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    if summary.user_id != user.id and user.id != int(os.getenv("ADMIN_USER_ID", "2")):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    return summary


def set_summary_task_id(summary_id: int, task_id: str) -> None:
    db = SessionLocal()
    try:
        summary = db.get(Summary, summary_id)
        if summary:
            summary.task_id = task_id
            db.commit()
    finally:
        db.close()


def refund_user_and_mark_failed(summary_id: int, reason: str) -> None:
    db = SessionLocal()
    try:
        summary = db.get(Summary, summary_id)
        if not summary:
            return
        user = db.get(User, summary.user_id)
        if user:
            user.balance_tokens += summary.token_cost
        summary.status = SummaryStatus.failed
        summary.error = reason
        db.commit()
    finally:
        db.close()


def mark_failed_with_optional_refund(db: Session, summary: Summary, reason: str, with_refund: bool) -> int | None:
    user = db.get(User, summary.user_id)
    if with_refund and user:
        user.balance_tokens += summary.token_cost
    summary.status = SummaryStatus.failed
    summary.error = reason
    db.commit()
    if user:
        db.refresh(user)
        return user.balance_tokens
    return None


def release_stale_active_summaries(db: Session, user_id: int) -> None:
    active_summaries = db.scalars(
        select(Summary).where(
            Summary.user_id == user_id,
            Summary.status.in_([SummaryStatus.queued, SummaryStatus.processing]),
        )
    ).all()

    for summary in active_summaries:
        if not summary.task_id:
            mark_failed_with_optional_refund(db, summary, "Задача повреждена и была остановлена", with_refund=True)
            continue

        rq_state = get_job_status(summary.task_id)
        rq_status = rq_state.get("status")
        if rq_status == "done":
            summary.status = SummaryStatus.done
            db.commit()
            continue
        if rq_status in {"failed", "not_found"}:
            # If RQ does not have an active job anymore, unblock the user and return spent tokens.
            mark_failed_with_optional_refund(db, summary, "Задача остановлена: job недоступен в очереди", with_refund=True)



@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AuthRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Пользователь с такой почтой уже существует")

    user = User(email=email, password_hash=hash_password(payload.password), balance_tokens=DEFAULT_TOKEN_BALANCE)
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=serialize_user(user),
    )


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: AuthRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверная почта или пароль")

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=serialize_user(user),
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    user = get_refresh_user(payload.refresh_token, db)
    return RefreshResponse(access_token=create_access_token(user))


@router.get("/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.post("/process", response_model=TaskResponse)
def process_video_route(
    payload: YoutubeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    size = payload.size.lower().strip()
    token_cost = get_cost_for_size(size)

    user = db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")

    release_stale_active_summaries(db, user.id)

    active_summary = db.scalar(
        select(Summary).where(
            Summary.user_id == user.id,
            Summary.status.in_([SummaryStatus.queued, SummaryStatus.processing]),
        )
    )
    if active_summary:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="У вас уже есть активная задача. Дождитесь завершения текущей обработки.",
        )

    if user.balance_tokens < token_cost:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно токенов")

    summary = Summary(
        user_id=user.id,
        source_url=payload.url,
        prompt=payload.prompt,
        size=size,
        token_cost=token_cost,
        status=SummaryStatus.queued,
    )
    user.balance_tokens -= token_cost
    db.add(summary)
    db.commit()
    db.refresh(summary)

    try:
        job_id = enqueue_video(payload.url, payload.prompt, user.id, summary.id, size, token_cost)
    except Exception as exc:
        logger.exception("Failed to enqueue summary job: %s", exc)
        refund_user_and_mark_failed(summary.id, str(exc))
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Не удалось поставить задачу в очередь")

    set_summary_task_id(summary.id, job_id)
    refreshed_user = db.get(User, user.id)
    return TaskResponse(
        task_id=job_id,
        status="queued",
        summary_id=summary.id,
        balance_tokens=refreshed_user.balance_tokens if refreshed_user else None,
    )


@router.delete("/process/{task_id}", response_model=TaskCancelResponse)
def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    summary = get_summary_or_404(db, task_id, current_user)
    summary_status = summary.status.value if hasattr(summary.status, "value") else str(summary.status)

    if summary_status in {SummaryStatus.done.value, SummaryStatus.failed.value}:
        user = db.get(User, current_user.id)
        return TaskCancelResponse(
            task_id=task_id,
            status=summary_status,
            detail="Задача уже завершена",
            balance_tokens=user.balance_tokens if user else None,
        )

    if summary_status == SummaryStatus.processing.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отмена доступна только пока задача в очереди. Сейчас задача уже обрабатывается.",
        )

    if summary_status != SummaryStatus.queued.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отмена недоступна для текущего статуса задачи.",
        )

    cancel_result = None
    if summary.task_id:
        cancel_result = cancel_job(summary.task_id)

    if cancel_result and cancel_result.get("status") == "started":
        summary.status = SummaryStatus.processing
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отмена доступна только пока задача в очереди. Сейчас задача уже обрабатывается.",
        )

    balance_tokens = mark_failed_with_optional_refund(
        db,
        summary,
        "Задача отменена пользователем",
        with_refund=True,
    )

    detail = "Задача отменена"

    return TaskCancelResponse(
        task_id=task_id,
        status="failed",
        detail=detail,
        balance_tokens=balance_tokens,
    )


@router.get("/process/history", response_model=SummaryListResponse)
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    summaries = db.scalars(
        select(Summary)
        .where(Summary.user_id == current_user.id)
        .order_by(Summary.created_at.desc())
    ).all()
    return SummaryListResponse(summaries=[serialize_summary(summary) for summary in summaries])


@router.get("/process/{task_id}")
def get_task_file(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    summary = get_summary_or_404(db, task_id, current_user)

    status_value = summary.status.value if hasattr(summary.status, "value") else str(summary.status)
    if status_value == SummaryStatus.failed.value:
        return {"task_id": task_id, "status": "failed", "error": summary.error}

    if status_value != SummaryStatus.done.value:
        return {
            "task_id": task_id,
            "status": status_value,
            "stage": status_value,
        }

    if not summary.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    summary_file = Path(summary.file_path)
    if not summary_file.is_absolute():
        summary_file = (Path.cwd() / summary_file).resolve()

    if not summary_file.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    return FileResponse(
        path=str(summary_file),
        filename=summary_file.name,
        media_type="text/plain",
    )


@router.get("/admin/users/by-email/{email}", response_model=AdminSearchResponse)
def admin_find_user_by_email(
    email: str,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return AdminSearchResponse(user=serialize_user(user))


@router.patch("/admin/users/by-email/{email}/balance", response_model=AdminBalanceUpdateResponse)
def admin_update_balance_by_email(
    email: str,
    payload: AdminBalanceUpdateRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.balance_tokens = payload.balance_tokens
    db.commit()
    db.refresh(user)
    return AdminBalanceUpdateResponse(user=serialize_user(user))
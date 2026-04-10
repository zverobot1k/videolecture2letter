import logging
import os
import re
from functools import lru_cache
from pathlib import Path

import whisper
import yt_dlp
import torch
from rq import get_current_job
from ollama import chat, list as list_models, pull as pull_model

from database.database import SessionLocal
from database.models import Summary, SummaryStatus, User

torch.set_num_threads(1)
logger = logging.getLogger(__name__)

OLLAMA_MODEL = os.getenv("OLLAMA_SUMMARY_MODEL", "gemma3")
FALLBACK_MODEL = os.getenv("OLLAMA_FALLBACK_MODEL", "gemma3:1b")
MAX_VIDEO_DURATION_SECONDS = 2 * 60 * 60

DEFAULT_PROMPT = """Сделай подробный конспект видео.

Требования:
- Конспект должен быть максимально подробным и раскрывать тему полно.
- Пиши простым и понятным языком.
- Используй только обычный текст (TXT), без Markdown-разметки.
- Не используй звёздочки, списки с символами (*, -, и т.д.), HTML-теги.
- Разрешены только абзацы и нумерованные разделы (1., 2., 3.).
- Убери любые повторы и дублирование информации.
- Не добавляй оценку конспекта или комментарии о его качестве.
- Не пиши вступления вроде "Отлично!" или "Вот конспект".
- Сразу начинай с содержания.

Структура:
Название
Основная идея
1. ...
2. ...
3. ...
"""


def build_safe_stem(title: str, video_id: str | None) -> str:
    raw_title = (title or "video").strip()
    # Убираем символы, которые могут быть интерпретированы как путь или спец-символы ОС.
    sanitized = re.sub(r"[\\/:*?\"<>|\x00-\x1f]+", "_", raw_title)
    sanitized = re.sub(r"\s+", " ", sanitized).strip(" ._")
    if not sanitized:
        sanitized = "video"

    safe_video_id = re.sub(r"[^A-Za-z0-9_-]+", "", (video_id or ""))
    if safe_video_id:
        return f"{sanitized}_{safe_video_id}"
    return sanitized


class VideoTooLongError(Exception):
    pass


def fetch_video_metadata(url: str) -> dict:
    info_opts = {
        'quiet': True,
        'skip_download': True,
    }
    with yt_dlp.YoutubeDL(info_opts) as ydl:
        return ydl.extract_info(url, download=False)


def validate_video_duration_or_raise(info_dict: dict) -> None:
    if info_dict.get('is_live') or info_dict.get('was_live'):
        raise VideoTooLongError("Нельзя обработать live-трансляцию")

    duration = info_dict.get('duration')
    if not isinstance(duration, (int, float)):
        raise VideoTooLongError("Не удалось определить длительность видео")

    if isinstance(duration, (int, float)) and duration > MAX_VIDEO_DURATION_SECONDS:
        raise VideoTooLongError("Слишком длинный видеоролик: длительность больше 2 часов")


#Получение mp3
def download_mp3(url, output_folder="downloads"):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    info_dict = fetch_video_metadata(url)

    title = info_dict.get('title', 'audio')
    video_id = info_dict.get('id')
    safe_stem = build_safe_stem(title, video_id)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_folder, f'{safe_stem}.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(url, download=True)
        file_path = os.path.join(output_folder, f"{safe_stem}.mp3")
        print(file_path)
        return file_path

#Транскрибация
def transcribe_audio(file_path):
    devicewhisper = "cpu"
    print(f"Использую: {devicewhisper}")

    model = whisper.load_model("small").to(devicewhisper)
    result = model.transcribe(file_path)

    transcript_path = file_path.rsplit(".", 1)[0] + ".txt"
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(result["text"])

    print(f"Транскрибация сохранена в: {transcript_path}")
    return transcript_path


@lru_cache(maxsize=None)
def ensure_model_available(model_name: str):
    try:
        available = list_models().get("models", [])
    except Exception as exc:
        logger.warning("Не удалось получить список моделей Ollama: %s", exc)
        available = []

    for meta in available:
        if model_name in (meta.get("model"), meta.get("name")):
            return

    logger.info("Модель %s не найдена на Ollama, запускаю загрузку", model_name)
    try:
        pull_response = pull_model(model=model_name)
        if isinstance(pull_response, dict):
            return
        if hasattr(pull_response, "__iter__"):
            for _ in pull_response:
                continue
    except Exception as exc:  
        logger.error("Ошибка загрузки модели %s: %s", model_name, exc)
        raise


def split_text(text, max_tokens=2000):
    words = text.split()
    chunks = []
    current_chunk = []
    token_count = 0

    for word in words:
        token_count += 1.3
        current_chunk.append(word)
        if token_count >= max_tokens:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            token_count = 0

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def create_summary(transcript_path, prompt):
    with open(transcript_path, "r", encoding="utf-8") as f:
        text = f.read()

    primary_model = OLLAMA_MODEL
    fallback_model = FALLBACK_MODEL
    ensure_model_available(primary_model)
    chunks = split_text(text, max_tokens=2000)
    summaries = []

    for i, chunk in enumerate(chunks, 1):
        print(f"Создаю конспект для чанка {i}/{len(chunks)}...")
        try:
            response = chat(
                model=primary_model,
                messages=[
                    {"role": "system", "content": prompt or DEFAULT_PROMPT},
                    {"role": "user", "content": chunk}
                ]
            )
        except Exception as exc:
            msg = str(exc)
            is_killed_runner = "llama runner process has terminated: signal: killed" in msg
            if (not is_killed_runner) or primary_model == fallback_model:
                raise

            logger.warning(
                "Модель %s упала из-за нехватки памяти, переключаюсь на %s",
                primary_model,
                fallback_model,
            )
            ensure_model_available(fallback_model)
            primary_model = fallback_model
            response = chat(
                model=primary_model,
                messages=[
                    {"role": "system", "content": prompt or DEFAULT_PROMPT},
                    {"role": "user", "content": chunk}
                ]
            )
        summaries.append(response["message"]["content"])

    summary_text = "\n\n".join(summaries)
    summary_path = transcript_path.rsplit(".", 1)[0] + "_summary.txt"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(summary_text)

    print(f"Конспект сохранён в: {summary_path}")
    return str(Path(summary_path).resolve())




def update_summary_record(summary_id: int, **fields):
    db = SessionLocal()
    try:
        summary = db.get(Summary, summary_id)
        if not summary:
            return
        for field_name, field_value in fields.items():
            setattr(summary, field_name, field_value)
        db.commit()
    finally:
        db.close()


def refund_summary_tokens(summary_id: int) -> int | None:
    db = SessionLocal()
    try:
        summary = db.get(Summary, summary_id)
        if not summary:
            return None

        user = db.get(User, summary.user_id)
        if not user:
            return None

        user.balance_tokens += summary.token_cost
        db.commit()
        db.refresh(user)
        return user.balance_tokens
    finally:
        db.close()


def process_video(url, prompt, user_id, summary_id, size, token_cost):
    job = get_current_job()

    def set_stage(stage: str):
        if not job:
            return
        job.meta["stage"] = stage
        job.save_meta()
        update_summary_record(summary_id, status=SummaryStatus.processing)

    try:
        update_summary_record(summary_id, status=SummaryStatus.processing, error=None)

        set_stage("validate")
        metadata = fetch_video_metadata(url)
        validate_video_duration_or_raise(metadata)

        set_stage("extract_audio")
        mp3_file = download_mp3(url)

        set_stage("transcribe")
        transcript_file = transcribe_audio(mp3_file)

        set_stage("summarize")
        summary_file = create_summary(transcript_file, prompt)

        set_stage("done")
        update_summary_record(
            summary_id,
            status=SummaryStatus.done,
            file_path=summary_file,
            error=None,
        )
        return summary_file
    except VideoTooLongError as exc:
        refund_summary_tokens(summary_id)
        update_summary_record(summary_id, status=SummaryStatus.failed, error=str(exc))
        raise
    except Exception as exc:
        update_summary_record(summary_id, status=SummaryStatus.failed, error=str(exc))
        raise
# if __name__ == "__main__":
#     video_url = input("Сслыка: ").strip()

#     if not video_url:
#         print("Нету ссылки!")
#     else:
#         print("Скачиваю mp3...")
#         mp3_file = download_mp3(video_url)
#         print(f"Файл скачан: {mp3_file}")

#         print("Транскрибирую аудио...")
#         transcript_file = transcribe_audio(mp3_file)
#         print("Готово")

#         print("Создаю конспект...")
#         summary_file = create_summary(transcript_file)

#         print(f"Готово, транскрипт доступен здесь: {summary_file}")
import os
import whisper
import yt_dlp
import torch
from ollama import chat

#Получение mp3
def download_mp3(url, output_folder="downloads"):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_folder}/%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
        title = info_dict.get('title', 'audio')
        file_path = os.path.join(output_folder, f"{title}.mp3")
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


def create_summary(transcript_path):
    with open(transcript_path, "r", encoding="utf-8") as f:
        text = f.read()

    chunks = split_text(text, max_tokens=2000)
    summaries = []

    for i, chunk in enumerate(chunks, 1):
        print(f"Создаю конспект для чанка {i}/{len(chunks)}...")
        response = chat(
            model="gemma3",
            messages=[
                {"role": "system", "content": "Ты — ассистент, который делает краткие и структурированные конспекты текста."},
                {"role": "user", "content": chunk}
            ]
        )
        summaries.append(response["message"]["content"])

    summary_text = "\n\n".join(summaries)
    summary_path = transcript_path.rsplit(".", 1)[0] + "_summary.txt"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(summary_text)

    print(f"Конспект сохранён в: {summary_path}")
    return summary_path


if __name__ == "__main__":
    video_url = input("Сслыка: ").strip()

    if not video_url:
        print("Нету ссылки!")
    else:
        print("Скачиваю mp3...")
        mp3_file = download_mp3(video_url)
        print(f"Файл скачан: {mp3_file}")

        print("Транскрибирую аудио...")
        transcript_file = transcribe_audio(mp3_file)
        print("Готово")

        print("Создаю конспект...")
        summary_file = create_summary(transcript_file)

        print(f"Готово, транскрипт доступен здесь: {summary_file}")
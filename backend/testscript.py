import os
import whisper
import yt_dlp
import torch

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
        return file_path

#Транскрибация
def transcribe_audio(file_path):
    device = "cpu"
    print(f"Использую: {device}")

    model = whisper.load_model("tiny").to(device)
    result = model.transcribe(file_path)

    transcript_path = file_path.rsplit(".", 1)[0] + ".txt"
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(result["text"])

    print(f"Транскрибация сохранена в: {transcript_path}")

if __name__ == "__main__":
    video_url = input("Сслыка: ").strip()

    if not video_url:
        print("Нету ссылки!")
    else:
        print("Скачиваю mp3...")
        mp3_file = download_mp3(video_url)
        print(f"Файл скачан: {mp3_file}")

        print("Транскрибирую аудио...")
        transcribe_audio(mp3_file)
        print("Готово")
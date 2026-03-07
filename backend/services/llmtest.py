from ollama import chat
import time

def split_text(text, max_words=1200):
    words = text.split()
    chunks = []

    for i in range(0, len(words), max_words):
        chunk = " ".join(words[i:i + max_words])
        chunks.append(chunk)

    return chunks


def summarize_chunk(chunk, index, total):
    print(f"Обрабатываю чанк {index}/{total}...")

    response = chat(
        model="gemma3",
        messages=[
            {
                "role": "system",
                "content": "Ты делаешь краткий, структурированный конспект текста. Выделяй основные мысли и убирай воду."
            },
            {
                "role": "user",
                "content": chunk
            }
        ]
    )

    return response["message"]["content"]


def create_summary(transcript_path):
    with open(transcript_path, "r", encoding="utf-8") as f:
        text = f.read()

    chunks = split_text(text, max_words=1200)
    partial_summaries = []

    for i, chunk in enumerate(chunks, 1):
        summary = summarize_chunk(chunk, i, len(chunks))
        partial_summaries.append(summary)

        time.sleep(1)  # маленькая пауза, чтобы не нагружать M2

    print("Делаю финальное сжатие...")

    combined_summary = "\n\n".join(partial_summaries)

    final_response = chat(
        model="gemma3",
        messages=[
            {
                "role": "system",
                "content": "Ты объединяешь несколько конспектов в один итоговый структурированный конспект."
            },
            {
                "role": "user",
                "content": combined_summary
            }
        ]
    )

    final_summary = final_response["message"]["content"]

    summary_path = transcript_path.replace(".txt", "_summary.txt")

    with open(summary_path, "w", encoding="utf-8") as f:
        f.write(final_summary)

    print(f"Конспект сохранён: {summary_path}")

    return summary_path


create_summary("/Users/maksimblohin/PycharmProjects/softwarePR/test.txt")
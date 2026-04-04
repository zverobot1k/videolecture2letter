import "./App.css";
import { useEffect, useState } from "react";
import { api } from "../api/api_client.js";

const PROCESS_API_BASE = "http://localhost:8000/process";

function extractFileName(contentDispositionHeader) {
    if (!contentDispositionHeader) {
        return "summary.txt";
    }

    const match = contentDispositionHeader.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : "summary.txt";
}

async function fetchTaskState(taskId) {
    const response = await fetch(`${PROCESS_API_BASE}/${taskId}`);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        const data = await response.json();
        return { kind: "json", data };
    }

    const blob = await response.blob();
    const filename = extractFileName(response.headers.get("content-disposition"));
    return { kind: "file", blob, filename };
}

function App() {
    const [videoURL, setVideoURL] = useState("");
    const [isCreated, setIsCreated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [taskId, setTaskId] = useState(null);
    const [taskStatus, setTaskStatus] = useState(null);
    const [error, setError] = useState(null);
    const [downloadReady, setDownloadReady] = useState(false);
    const [size, setSize] = useState('medium'); // short, medium, detailed

    useEffect(() => {
        if (!taskId || downloadReady || taskStatus === "failed") {
            return undefined;
        }

        let cancelled = false;

        const poll = async () => {
            try {
                const state = await fetchTaskState(taskId);
                if (cancelled) {
                    return;
                }

                if (state.kind === "json") {
                    const nextStatus = state.data.status || "unknown";
                    setTaskStatus(nextStatus);
                    if (nextStatus === "failed") {
                        setError(state.data.error || "Задача завершилась с ошибкой");
                    }
                    return;
                }

                setTaskStatus("done");
                setDownloadReady(true);
                setError(null);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Не удалось получить статус задачи");
                }
            }
        };

        poll();
        const intervalId = setInterval(poll, 5000);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [taskId, downloadReady, taskStatus]);

    const handleCreateSummary = async () => {
        if (!videoURL) {
            alert("Вставьте ссылку на видео!");
            return;
        }

        setLoading(true);
        setError(null);
        setDownloadReady(false);
        setTaskStatus(null);
        setTaskId(null);

        try {
            const data = await api.handleVideo(videoURL);
            setTaskId(data.task_id);
            setTaskStatus(data.status || "queued");
            setIsCreated(true);
        } catch (err) {
            setError(err.message);
            console.error("[ERROR]: ", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!taskId) {
            return;
        }

        setError(null);

        try {
            const state = await fetchTaskState(taskId);
            if (state.kind === "json") {
                const nextStatus = state.data.status || "unknown";
                setTaskStatus(nextStatus);
                if (nextStatus === "failed") {
                    setError(state.data.error || "Задача завершилась с ошибкой");
                }
                return;
            }

            setTaskStatus("done");
            setDownloadReady(true);

            const url = window.URL.createObjectURL(state.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = state.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message || "Не удалось скачать файл");
        }
    };

    const handleStatus = () => {
        switch(taskStatus){
            case null:
                return "Ожидание ссылки...";
            case("queued"):
                return "В очереди...";
            case("failed"):
                return "Ошибка!";
            case("done"):
                return "Готово!";
            default:
                console.log(`Неизвестное состояние: ${taskStatus}`);
                return "Неизвестное состояние...";
        }
    };

    const handleSize = (size) => {
        setSize(size);
    };
    return (
        <div className="screen">
            <div className="card">
                <h1>Создание конспекта</h1>

                <h3 className="subtitle">Вставьте ссылку</h3>

                <input
                    type="text"
                    placeholder="Ссылка на лекцию"
                    value={videoURL}    
                    onChange={(e) => setVideoURL(e.target.value)}
                    disabled={loading}
                />

                <div className="size-buttons">
                    <button className="size-button" onClick={() => handleSize('short')} style={{backgroundColor: size === 'short' ? '#1c4269' : '#5b7fa6'}}>Краткий</button>
                    <button className="size-button" onClick={() => handleSize('medium')} style={{backgroundColor: size === 'medium' ? '#1c4269' : '#5b7fa6'}}>Сжатый</button>
                    <button className="size-button" onClick={() => handleSize('detailed')} style={{backgroundColor: size === 'detailed' ? '#1c4269' : '#5b7fa6'}} >Крупный</button>
                </div>

                <button
                    className="create-button"
                    onClick={() => handleCreateSummary()}
                    disabled={loading}
                >
                    {loading ? "Обработка видео..." : "Сделать конспект"}
                </button>

                {error && (
                    <div className="error">
                        <p style={{ color: 'red' }}>Ошибка: {error}</p>
                    </div>
                )}

                {isCreated && (
                    <div className="result">
                        <div>
                            <p className="success">{isCreated ? "Конспект успешно создан!" : "В процессе обработки..."}</p>
                            <p className="title">Статус: {handleStatus()}</p>
                            {taskId && (
                                <p className="task-id" style={{ fontSize: "12px", color: "#666" }}>
                                    Task ID: {taskId}
                                </p>
                            )}
                        </div>

                        {downloadReady ? (<button className="download-button" onClick={handleDownload} disabled={!taskId || loading}>Скачать файл</button>) : ""}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;

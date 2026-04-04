import "./App.css";
import { useEffect, useState } from "react";
import { api } from "../api/api_client.js";

const PROCESS_API_BASE = "http://localhost:8000/process";
const TASK_STORAGE_KEY = "softwarepr_active_task";

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

function getStatusLabel(status) {
    const normalized = status || "queued";
    const labels = {
        queued: "В очереди",
        started: "В обработке",
        done: "Готово",
        finished: "Готово",
        failed: "Ошибка",
        not_found: "Задача не найдена",
        unknown: "Неизвестно",
    };

    return labels[normalized] || `Неизвестный статус: ${normalized}`;
}

function getNextPollDelay() {
    return 5000 + Math.floor(Math.random() * 5001);
}

const TODO_STEPS = [
    { key: "extract_audio", title: "Извлекаю аудио" },
    { key: "transcribe", title: "Транскрибирую" },
    { key: "summarize", title: "Создаю конспект" },
];

function getActiveStage({ taskStatus, taskStage, downloadReady }) {
    if (downloadReady || taskStatus === "done") {
        return "done";
    }

    if (taskStatus === "queued") {
        return "queued";
    }

    if (taskStatus === "failed") {
        return taskStage || "failed";
    }

    return taskStage || "extract_audio";
}

function getStepState(stepKey, activeStage, hasFailed) {
    const order = ["extract_audio", "transcribe", "summarize"];
    const stepIndex = order.indexOf(stepKey);
    const activeIndex = order.indexOf(activeStage);

    if (activeStage === "queued") {
        return "pending";
    }

    if (activeStage === "done") {
        return "done";
    }

    if (stepIndex < activeIndex) {
        return "done";
    }

    if (stepIndex === activeIndex) {
        return hasFailed ? "error" : "active";
    }

    return "pending";
}

function isTerminalStatus(status) {
    return status === "done" || status === "failed" || status === "not_found";
}

function loadSavedTask() {
    try {
        const raw = localStorage.getItem(TASK_STORAGE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.taskId) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
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
    const [statusMessage, setStatusMessage] = useState("Ожидание запуска");
    const [taskStage, setTaskStage] = useState("queued");

    const hasActiveTask = Boolean(taskId) && !isTerminalStatus(taskStatus);

    useEffect(() => {
        const saved = loadSavedTask();
        if (!saved) {
            return;
        }

        setTaskId(saved.taskId);
        setTaskStatus(saved.taskStatus || "queued");
        setTaskStage(saved.taskStage || "queued");
        setStatusMessage(saved.statusMessage || getStatusLabel(saved.taskStatus || "queued"));
        setDownloadReady(Boolean(saved.downloadReady));
        setIsCreated(true);
    }, []);

    useEffect(() => {
        if (!taskId) {
            localStorage.removeItem(TASK_STORAGE_KEY);
            return;
        }

        const payload = {
            taskId,
            taskStatus: taskStatus || "queued",
            taskStage,
            statusMessage,
            downloadReady,
        };
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(payload));
    }, [taskId, taskStatus, taskStage, statusMessage, downloadReady]);

    useEffect(() => {
        if (!taskId || downloadReady || taskStatus === "failed" || taskStatus === "not_found") {
            return undefined;
        }

        let cancelled = false;
        let timeoutId = null;

        const poll = async () => {
            try {
                const state = await fetchTaskState(taskId);
                if (cancelled) {
                    return;
                }

                if (state.kind === "json") {
                    const nextStatus = state.data.status || "unknown";
                    const nextStage = state.data.stage || "queued";
                    setTaskStatus(nextStatus);
                    setTaskStage(nextStage);
                    setStatusMessage(getStatusLabel(nextStatus));
                    if (nextStatus === "failed") {
                        setError(state.data.error || "Задача завершилась с ошибкой");
                        return;
                    }
                    if (nextStatus === "not_found") {
                        setError("Задача не найдена. Запустите новую.");
                        return;
                    }
                    timeoutId = setTimeout(poll, getNextPollDelay());
                    return;
                }

                setTaskStatus("done");
                setTaskStage("done");
                setDownloadReady(true);
                setStatusMessage("Готово к скачиванию");
                setError(null);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Не удалось получить статус задачи");
                    timeoutId = setTimeout(poll, getNextPollDelay());
                }
            }
        };

        poll();

        return () => {
            cancelled = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [taskId, downloadReady, taskStatus]);

    const handleCreateSummary = async () => {
        if (hasActiveTask) {
            setError("У вас уже есть активная задача. Дождитесь завершения текущей обработки.");
            return;
        }

        if (!videoURL) {
            alert("Вставьте ссылку на видео!");
            return;
        }

        setLoading(true);
        setError(null);
        setDownloadReady(false);
        setTaskStatus(null);
        setTaskStage("queued");
        setTaskId(null);
        setStatusMessage("Создаём задачу...");
        setIsCreated(false);

        try {
            const data = await api.handleVideo(videoURL);
            setTaskId(data.task_id);
            setTaskStatus(data.status || "queued");
            setTaskStage(data.stage || "queued");
            setStatusMessage(getStatusLabel(data.status || "queued"));
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
                const nextStage = state.data.stage || "queued";
                setTaskStatus(nextStatus);
                setTaskStage(nextStage);
                setStatusMessage(getStatusLabel(nextStatus));
                if (nextStatus === "failed") {
                    setError(state.data.error || "Задача завершилась с ошибкой");
                }
                return;
            }

            setTaskStatus("done");
            setTaskStage("done");
            setDownloadReady(true);
            setStatusMessage("Готово к скачиванию");

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
/*
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
    };*/

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
                    disabled={loading || hasActiveTask}
                >
                    {loading ? "Обработка видео..." : hasActiveTask ? "Ожидаем завершения текущей задачи" : "Сделать конспект"}
                </button>

                {error && (
                    <div className="error">
                        <p style={{ color: 'red' }}>Ошибка: {error}</p>
                    </div>
                )}

                {isCreated && (
                    <div className="result">
                        <div className="result-text">
                            <p className="success">Задача создана</p>
                            <p className="title">Статус: {statusMessage}</p>
                            <div className="todo-list">
                                {TODO_STEPS.map((step) => {
                                    const activeStage = getActiveStage({ taskStatus, taskStage, downloadReady });
                                    const stepState = getStepState(step.key, activeStage, taskStatus === "failed");
                                    return (
                                        <div key={step.key} className={`todo-item todo-${stepState}`}>
                                            <span className="todo-marker">
                                                {stepState === "done" ? "✓" : stepState === "active" ? "•" : stepState === "error" ? "!" : "○"}
                                            </span>
                                            <span>{step.title}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {taskId && (
                                <p className="task-id">
                                    ID задачи: {taskId}
                                </p>
                            )}
                        </div>

                        {downloadReady && (
                            <button className="download-button" onClick={handleDownload} disabled={!taskId || loading}>
                                Скачать файл
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;

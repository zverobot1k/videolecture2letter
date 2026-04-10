import './App.css';
import { useEffect, useState } from 'react';
import { api } from '../api/api_client.js';

const TASK_STORAGE_KEY = 'softwarepr_active_task';
const ACTIVE_TASK_TTL_MS = 10 * 60 * 1000;

const SUMMARY_PROMPTS = {
    short: 'Сделай очень краткий конспект видео на русском языке. Формат: 4-6 коротких пунктов с самыми важными идеями и выводами. Без вводных фраз. Только чистый текст, без Markdown-разметки.',
    medium: 'Сделай сжатый структурированный конспект видео на русском языке. Формат: название, основная идея, 5-8 разделов с ключевыми тезисами и важными деталями. Только чистый текст, без Markdown-разметки и без лишних комментариев.',
    detailed: 'Сделай подробный конспект видео на русском языке. Формат: название, основная идея, нумерованные разделы с детальным раскрытием темы, ключевыми аргументами и примерами. Убери повторы, пиши только по содержанию. Только чистый текст, без Markdown-разметки.',
};

function extractFileName(contentDispositionHeader) {
    if (!contentDispositionHeader) {
        return 'summary.txt';
    }

    const match = contentDispositionHeader.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : 'summary.txt';
}

function getStatusLabel(status) {
    const normalized = status || 'queued';
    const labels = {
        queued: 'В очереди',
        started: 'В обработке',
        processing: 'В обработке',
        done: 'Готово',
        finished: 'Готово',
        failed: 'Ошибка',
        not_found: 'Задача не найдена',
        unknown: 'Неизвестно',
    };

    return labels[normalized] || `Неизвестный статус: ${normalized}`;
}

function getNextPollDelay() {
    return 5000 + Math.floor(Math.random() * 5001);
}

const TODO_STEPS = [
    { key: 'extract_audio', title: 'Извлекаю аудио' },
    { key: 'transcribe', title: 'Транскрибирую' },
    { key: 'summarize', title: 'Создаю конспект' },
];

function getActiveStage({ taskStatus, taskStage, downloadReady }) {
    if (downloadReady || taskStatus === 'done') {
        return 'done';
    }

    if (taskStatus === 'queued') {
        return 'queued';
    }

    if (taskStatus === 'failed') {
        return taskStage || 'failed';
    }

    return taskStage || 'extract_audio';
}

function getStepState(stepKey, activeStage, hasFailed) {
    const order = ['extract_audio', 'transcribe', 'summarize'];
    const stepIndex = order.indexOf(stepKey);
    const activeIndex = order.indexOf(activeStage);

    if (activeStage === 'queued') {
        return 'pending';
    }

    if (activeStage === 'done') {
        return 'done';
    }

    if (stepIndex < activeIndex) {
        return 'done';
    }

    if (stepIndex === activeIndex) {
        return hasFailed ? 'error' : 'active';
    }

    return 'pending';
}

function isTerminalStatus(status) {
    return status === 'done' || status === 'failed' || status === 'not_found';
}


function isYoutubeUrl(value) {
    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        return host === 'youtube.com'
            || host === 'www.youtube.com'
            || host === 'm.youtube.com'
            || host === 'youtu.be';
    } catch {
        return false;
    }
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

        if (!parsed.savedAt || Date.now() - parsed.savedAt > ACTIVE_TASK_TTL_MS) {
            localStorage.removeItem(TASK_STORAGE_KEY);
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function getInitialTaskSnapshot() {
    const saved = loadSavedTask();
    if (!saved || isTerminalStatus(saved.taskStatus)) {
        return {
            taskId: null,
            taskStatus: null,
            taskStage: 'queued',
            statusMessage: 'Ожидание запуска',
            isCreated: false,
            downloadReady: false,
        };
    }

    const normalizedStatus = saved.taskStatus || 'queued';
    return {
        taskId: saved.taskId,
        taskStatus: normalizedStatus,
        taskStage: saved.taskStage || 'queued',
        statusMessage: saved.statusMessage || getStatusLabel(normalizedStatus),
        isCreated: true,
        downloadReady: false,
    };
}

export default function App({ user, onUserUpdate }) {
    const initialTaskSnapshot = getInitialTaskSnapshot();
    const [videoURL, setVideoURL] = useState('');
    const [isCreated, setIsCreated] = useState(initialTaskSnapshot.isCreated);
    const [loading, setLoading] = useState(false);
    const [taskId, setTaskId] = useState(initialTaskSnapshot.taskId);
    const [taskStatus, setTaskStatus] = useState(initialTaskSnapshot.taskStatus);
    const [error, setError] = useState(null);
    const [downloadReady, setDownloadReady] = useState(initialTaskSnapshot.downloadReady);
    const [size, setSize] = useState('medium');
    const [statusMessage, setStatusMessage] = useState(initialTaskSnapshot.statusMessage);
    const [taskStage, setTaskStage] = useState(initialTaskSnapshot.taskStage);

    const hasActiveTask = Boolean(taskId) && !isTerminalStatus(taskStatus);
    const canCancelActiveTask = hasActiveTask && taskStatus === 'queued';

    useEffect(() => {
        let cancelled = false;

        const restoreTask = async () => {
            const saved = loadSavedTask();
            if (!saved || isTerminalStatus(saved.taskStatus)) {
                localStorage.removeItem(TASK_STORAGE_KEY);
                return;
            }

            try {
                const state = await api.getTaskStatus(saved.taskId);
                if (cancelled) {
                    return;
                }

                if (state.kind !== 'json') {
                    localStorage.removeItem(TASK_STORAGE_KEY);
                    return;
                }

                const nextStatus = state.data.status || 'unknown';
                if (isTerminalStatus(nextStatus)) {
                    localStorage.removeItem(TASK_STORAGE_KEY);
                    return;
                }

                setTaskId(saved.taskId);
                setTaskStatus(nextStatus);
                setTaskStage(state.data.stage || 'queued');
                setStatusMessage(getStatusLabel(nextStatus));
                setDownloadReady(false);
                setIsCreated(true);
            } catch {
                localStorage.removeItem(TASK_STORAGE_KEY);
            }
        };

        restoreTask();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!taskId) {
            localStorage.removeItem(TASK_STORAGE_KEY);
            return;
        }

        const payload = {
            taskId,
            taskStatus: taskStatus || 'queued',
            taskStage,
            statusMessage,
            downloadReady,
            savedAt: Date.now(),
        };
        localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(payload));
    }, [taskId, taskStatus, taskStage, statusMessage, downloadReady]);

    useEffect(() => {
        if (!taskId || downloadReady || taskStatus === 'failed' || taskStatus === 'not_found') {
            return undefined;
        }

        let cancelled = false;
        let timeoutId = null;

        const poll = async () => {
            try {
                const state = await api.getTaskStatus(taskId);
                if (cancelled) {
                    return;
                }

                if (state.kind === 'json') {
                    const nextStatus = state.data.status || 'unknown';
                    const nextStage = state.data.stage || 'queued';
                    setTaskStatus(nextStatus);
                    setTaskStage(nextStage);
                    setStatusMessage(getStatusLabel(nextStatus));
                    if (nextStatus === 'failed') {
                        setError(state.data.error || 'Задача завершилась с ошибкой');
                        return;
                    }
                    if (nextStatus === 'not_found') {
                        setError('Задача не найдена. Запустите новую.');
                        return;
                    }
                    timeoutId = setTimeout(poll, getNextPollDelay());
                    return;
                }

                setTaskStatus('done');
                setTaskStage('done');
                setDownloadReady(true);
                setStatusMessage('Готово к скачиванию');
                setError(null);
            } catch (err) {
                if (!cancelled) {
                    setError(err.response?.data?.detail || err.message || 'Не удалось получить статус задачи');
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
            setError('У вас уже есть активная задача. Дождитесь завершения текущей обработки.');
            return;
        }

        if (!videoURL) {
            setError('Вставьте ссылку на видео');
            return;
        }

        if (!isYoutubeUrl(videoURL)) {
            setError('Разрешены только ссылки на YouTube');
            return;
        }

        setLoading(true);
        setError(null);
        setDownloadReady(false);
        setTaskStatus(null);
        setTaskStage('queued');
        setTaskId(null);
        setStatusMessage('Создаём задачу...');
        setIsCreated(false);

        try {
            const response = await api.handleVideo(videoURL, SUMMARY_PROMPTS[size], size);
            const data = response.data;
            setTaskId(data.task_id);
            setTaskStatus(data.status || 'queued');
            setTaskStage(data.stage || 'queued');
            setStatusMessage(getStatusLabel(data.status || 'queued'));
            setIsCreated(true);
            if (typeof data.balance_tokens === 'number' && onUserUpdate) {
                onUserUpdate({ balance_tokens: data.balance_tokens });
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Не удалось создать задачу');
            console.error('[ERROR]: ', err);
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
            const state = await api.getTaskStatus(taskId);
            if (state.kind === 'json') {
                const nextStatus = state.data.status || 'unknown';
                const nextStage = state.data.stage || 'queued';
                setTaskStatus(nextStatus);
                setTaskStage(nextStage);
                setStatusMessage(getStatusLabel(nextStatus));
                if (nextStatus === 'failed') {
                    setError(state.data.error || 'Задача завершилась с ошибкой');
                }
                return;
            }

            setTaskStatus('done');
            setTaskStage('done');
            setDownloadReady(true);
            setStatusMessage('Готово к скачиванию');

            const url = window.URL.createObjectURL(state.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = state.filename || extractFileName();
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Не удалось скачать файл');
        }
    };

    const handleCancelTask = async () => {
        if (!taskId || !hasActiveTask) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await api.cancelTask(taskId);
            const nextBalance = response.data?.balance_tokens;
            if (typeof nextBalance === 'number' && onUserUpdate) {
                onUserUpdate({ balance_tokens: nextBalance });
            }

            setTaskStatus('failed');
            setTaskStage('failed');
            setStatusMessage('Задача отменена');
            setIsCreated(false);
            setTaskId(null);
            setDownloadReady(false);
            localStorage.removeItem(TASK_STORAGE_KEY);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Не удалось отменить задачу');
        } finally {
            setLoading(false);
        }
    };

    const handleSize = (nextSize) => {
        setSize(nextSize);
    };

    if (!user) {
        return (
            <div className="card">
                <h1>Создание конспекта</h1>
                <p className="subtitle">Сначала войдите в аккаунт.</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h1>Создание конспекта</h1>
            <p className="subtitle">Баланс: {user.balance_tokens}</p>
            <h3 className="subtitle">Вставьте ссылку</h3>

            <input
                type="text"
                placeholder="Ссылка на лекцию"
                value={videoURL}
                onChange={(e) => setVideoURL(e.target.value)}
                disabled={loading}
            />

            <div className="size-buttons">
                <button className="size-button" onClick={() => handleSize('short')} style={{ backgroundColor: size === 'short' ? '#1c4269' : '#5b7fa6' }}>Краткий</button>
                <button className="size-button" onClick={() => handleSize('medium')} style={{ backgroundColor: size === 'medium' ? '#1c4269' : '#5b7fa6' }}>Сжатый</button>
                <button className="size-button" onClick={() => handleSize('detailed')} style={{ backgroundColor: size === 'detailed' ? '#1c4269' : '#5b7fa6' }}>Подробный</button>
            </div>

            <button className="create-button" onClick={handleCreateSummary} disabled={loading || hasActiveTask}>
                {loading ? 'Обработка видео...' : hasActiveTask ? 'Ожидаем завершения текущей задачи' : 'Сделать конспект'}
            </button>

            {hasActiveTask && (
                <button className="btn--danger" onClick={handleCancelTask} disabled={loading || !taskId || !canCancelActiveTask}>
                    {canCancelActiveTask ? 'Отменить текущую задачу' : 'Отмена недоступна: задача уже обрабатывается'}
                </button>
            )}

            {error && (
                <div className="error">
                    <p className="error-text">Ошибка: {error}</p>
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
                                const stepState = getStepState(step.key, activeStage, taskStatus === 'failed');
                                return (
                                    <div key={step.key} className={`todo-item todo-${stepState}`}>
                                        <span className="todo-marker">
                                            {stepState === 'done' ? '✓' : stepState === 'active' ? '•' : stepState === 'error' ? '!' : '○'}
                                        </span>
                                        <span>{step.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {taskId && <p className="task-id">ID задачи: {taskId}</p>}
                    </div>

                    {downloadReady && (
                        <button className="download-button" onClick={handleDownload} disabled={!taskId || loading}>
                            Скачать файл
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
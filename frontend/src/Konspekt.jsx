export default function Konspekt({ konspekt, onDownload, onCancel }) {
    const deriveSummaryTitle = () => {
        if (!konspekt.file_path) {
            return 'Название появится после генерации';
        }

        const fileName = konspekt.file_path.split('/').pop() || '';
        const withoutExt = fileName.replace(/\.[^.]+$/, '');
        const withoutSummarySuffix = withoutExt.replace(/_summary$/i, '');
        const withoutVideoId = withoutSummarySuffix.replace(/_[A-Za-z0-9_-]{11}$/i, '');
        const normalized = withoutVideoId.replace(/[_\s]+/g, ' ').trim();

        return normalized || 'Без названия';
    };

    const summaryTitle = deriveSummaryTitle();
    const createdAt = konspekt.created_at
        ? new Intl.DateTimeFormat('ru-RU', {
            dateStyle: 'long',
            timeStyle: 'short',
        }).format(new Date(konspekt.created_at))
        : 'Неизвестно';
    const sizeLabels = {
        short: 'Краткий',
        medium: 'Сжатый',
        detailed: 'Подробный',
    };
    const statusLabels = {
        queued: 'В очереди',
        processing: 'В обработке',
        started: 'В обработке',
        done: 'Готов',
        failed: 'Ошибка',
    };
    const sizeLabel = sizeLabels[konspekt.size] || konspekt.size || 'Неизвестно';
    const statusLabel = statusLabels[konspekt.status] || konspekt.status || 'Неизвестно';
    const isReady = konspekt.status === 'done';
    const isQueued = konspekt.status === 'queued';
    const isProcessing = konspekt.status === 'processing' || konspekt.status === 'started';

    return (
        <div className="konspekt">
            <div className="konspekt__meta">
                <h3 className="konspekt__title">{summaryTitle}</h3>
                <p className="konspekt__subline">Размер: {sizeLabel}</p>
                <p className="konspekt__subline">Дата: {createdAt}</p>
                <p className="konspekt__subline">Статус: {statusLabel}</p>
            </div>
            <div className="actions">
                {isReady && (
                    <button className="btn btn--success" onClick={() => onDownload(konspekt.task_id)} disabled={!konspekt.task_id}>
                        Скачать конспект
                    </button>
                )}
                {isQueued && (
                    <button className="btn btn--danger" onClick={() => onCancel(konspekt.task_id)} disabled={!konspekt.task_id}>
                        Отменить
                    </button>
                )}
                {isProcessing && (
                    <button className="btn btn--danger" disabled>
                        Уже в обработке
                    </button>
                )}
                {!isReady && !isQueued && !isProcessing && (
                    <button className="btn btn--danger" disabled>
                        {statusLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
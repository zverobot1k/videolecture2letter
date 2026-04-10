export default function Konspekt({ konspekt, onDownload, onCancel }) {
    const createdAt = konspekt.created_at ? new Date(konspekt.created_at).toLocaleString() : 'Неизвестно';
    const isReady = konspekt.status === 'done';
    const isQueued = konspekt.status === 'queued';
    const isProcessing = konspekt.status === 'processing' || konspekt.status === 'started';

    return (
        <div className="konspekt">
            <div className="konspekt__meta">
                <h3 className="konspekt__title">{konspekt.size} · {konspekt.token_cost} токенов</h3>
                <p className="konspekt__subline">{createdAt}</p>
                <p className="konspekt__subline">Статус: {konspekt.status}</p>
                <p className="konspekt__subline">Файл: {konspekt.file_path || 'ожидает генерации'}</p>
                <p className="konspekt__subline konspekt__path">{konspekt.source_url}</p>
            </div>
            <div className="actions">
                <button className="btn btn--success" onClick={() => onDownload(konspekt.task_id)} disabled={!isReady || !konspekt.task_id}>
                    Скачать
                </button>
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
            </div>
        </div>
    );
}
import Konspekt from './Konspekt';

export default function KonspektsList({ konspekts, onDownload, onCancel }) {
    if (!konspekts || konspekts.length <= 0) {
        return <div className="empty">Список пуст...</div>;
    }

    return (
        <div className="konspektsList">
            {konspekts.map((konspekt) => (
                <Konspekt key={konspekt.id || konspekt.task_id} konspekt={konspekt} onDownload={onDownload} onCancel={onCancel} />
            ))}
        </div>
    );
}
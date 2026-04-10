import { useState } from 'react';
import './App.css';
import KonspektsList from './KonspektsList';

export default function Profile({ user, konspekts, onDownload, onCancel, onReload }) {
    const [hideFailedSummaries, setHideFailedSummaries] = useState(false);

    const filteredKonspekts = hideFailedSummaries
        ? konspekts.filter(k => k.status !== 'failed')
        : konspekts;

    const failedCount = konspekts.filter(k => k.status === 'failed').length;

    return (
        <div className="profile-card">
            <h1>Профиль</h1>
            <h3 className="subtitle">Почта: {user.email}</h3>
            <h3 className="subtitle">Баланс: {user.balance_tokens}</h3>
            <div className="profile-controls">
                {onReload && (
                    <button className="page-button page-button--secondary" onClick={onReload}>Обновить историю</button>
                )}
                {failedCount > 0 && (
                    <button 
                        className={`page-button ${hideFailedSummaries ? 'page-button--primary' : 'page-button--secondary'}`}
                        onClick={() => setHideFailedSummaries(!hideFailedSummaries)}
                    >
                        {hideFailedSummaries ? `Показать упавшие (${failedCount})` : `Скрыть упавшие (${failedCount})`}
                    </button>
                )}
            </div>
            <KonspektsList konspekts={filteredKonspekts} onDownload={onDownload} onCancel={onCancel} />
        </div>
    );
}
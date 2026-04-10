import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Auth from './Auth.jsx';
import Profile from './Profile.jsx';
import { api } from '../api/api_client.js';

function Root() {
    const [pageName, setPageName] = useState('reg');
    const [user, setUser] = useState(null);
    const [konspekts, setKonspekts] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminBalance, setAdminBalance] = useState('');
    const [adminTarget, setAdminTarget] = useState(null);
    const [adminMessage, setAdminMessage] = useState('');

    useEffect(() => {
        const bootstrap = async () => {
            const storedUser = api.getStoredUser();
            if (!storedUser || !api.getRefreshToken()) {
                setPageName('reg');
                return;
            }

            try {
                const response = await api.getMe();
                setUser(response.data);
                setPageName('main');
            } catch {
                api.clearSession();
                setUser(null);
                setPageName('reg');
            }
        };

        bootstrap();
    }, []);

    useEffect(() => {
        const loadHistory = async () => {
            if (pageName !== 'profile' || !user) {
                return;
            }

            setHistoryLoading(true);
            setHistoryError('');

            try {
                const response = await api.getHistory();
                setKonspekts(response.data.summaries || []);
            } catch (error) {
                setHistoryError(error.response?.data?.detail || error.message || 'Не удалось загрузить историю');
            } finally {
                setHistoryLoading(false);
            }
        };

        loadHistory();
    }, [pageName, user]);

    const router = (address, body = {}) => {
        setPageName(address);
        if (body.user) {
            setUser(body.user);
        }
    };

    const handleLogout = () => {
        api.clearSession();
        localStorage.removeItem('softwarepr_active_task');
        setUser(null);
        setKonspekts([]);
        setAdminTarget(null);
        setAdminMessage('');
        setPageName('reg');
    };

    const refreshUser = async () => {
        try {
            const response = await api.getMe();
            setUser(response.data);
        } catch {
            api.clearSession();
            setUser(null);
            setPageName('reg');
        }
    };

    const onDownload = async (taskId) => {
        if (!taskId) {
            return;
        }

        try {
            const state = await api.getTaskStatus(taskId);
            if (state.kind !== 'file') {
                setHistoryError(state.data?.error || 'Файл ещё не готов');
                return;
            }

            const url = window.URL.createObjectURL(state.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = state.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setHistoryError(error.response?.data?.detail || error.message || 'Не удалось скачать файл');
        }
    };

    const onCancel = async (taskId) => {
        if (!taskId) {
            return;
        }

        try {
            const response = await api.cancelTask(taskId);
            if (typeof response.data?.balance_tokens === 'number') {
                setUser((current) => (current ? { ...current, balance_tokens: response.data.balance_tokens } : current));
            }
            setHistoryError(response.data?.detail || 'Задача отменена');
            const historyResponse = await api.getHistory();
            setKonspekts(historyResponse.data.summaries || []);
        } catch (error) {
            setHistoryError(error.response?.data?.detail || error.message || 'Не удалось отменить задачу');
        }
    };

    const searchUserByEmail = async () => {
        setAdminMessage('');
        setAdminTarget(null);
        try {
            const response = await api.findUserByEmail(adminEmail);
            setAdminTarget(response.data.user);
            setAdminBalance(String(response.data.user.balance_tokens));
        } catch (error) {
            setAdminMessage(error.response?.data?.detail || error.message || 'Не удалось найти пользователя');
        }
    };

    const updateAdminBalance = async () => {
        if (!adminEmail) {
            setAdminMessage('Укажите email пользователя');
            return;
        }

        try {
            const response = await api.updateUserBalanceByEmail(adminEmail, Number(adminBalance));
            setAdminTarget(response.data.user);
            setAdminMessage('Баланс обновлён');
            if (user && response.data.user.id === user.id) {
                setUser(response.data.user);
            }
        } catch (error) {
            setAdminMessage(error.response?.data?.detail || error.message || 'Не удалось обновить баланс');
        }
    };

    const renderMain = () => (
        <App user={user} onUserUpdate={(patch) => setUser((current) => (current ? { ...current, ...patch } : current))} />
    );

    const renderProfile = () => (
        <Profile
            user={user}
            konspekts={konspekts}
            onDownload={onDownload}
            onCancel={onCancel}
            onReload={refreshUser}
        />
    );

    const renderAdmin = () => (
        <div className="profile-card admin-panel">
            <h1>Админ-панель</h1>
            <p className="subtitle">Поиск пользователя по email и изменение баланса токенов.</p>
            <input
                className="input"
                type="email"
                placeholder="Email пользователя"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
            />
            <div className="admin-actions">
                <button className="page-button" onClick={searchUserByEmail}>Найти</button>
                <input
                    className="input"
                    type="number"
                    placeholder="Новый баланс"
                    value={adminBalance}
                    onChange={(e) => setAdminBalance(e.target.value)}
                />
                <button className="page-button" onClick={updateAdminBalance}>Сохранить</button>
            </div>
            {adminMessage && <div className="error-text">{adminMessage}</div>}
            {adminTarget && (
                <div className="admin-result">
                    <p>Пользователь: {adminTarget.email}</p>
                    <p>ID: {adminTarget.id}</p>
                    <p>Баланс: {adminTarget.balance_tokens}</p>
                    <p>Роль: {adminTarget.is_admin ? 'admin' : 'user'}</p>
                </div>
            )}
        </div>
    );

    return (
        <StrictMode>
            <div className="screen">
                {user && pageName !== 'reg' && (
                    <div className="pages">
                        <button onClick={() => setPageName('main')} className="page-button" style={{ backgroundColor: pageName === 'main' ? '#1c4269' : '#5b7fa6' }}>Главная</button>
                        <button onClick={() => setPageName('profile')} className="page-button" style={{ backgroundColor: pageName === 'profile' ? '#1c4269' : '#5b7fa6' }}>Профиль</button>
                        {user.is_admin && (
                            <button onClick={() => setPageName('admin-panel')} className="page-button" style={{ backgroundColor: pageName === 'admin-panel' ? '#1c4269' : '#5b7fa6' }}>Админ-панель</button>
                        )}
                        <div className="balance-bar">
                            <h3 className="balance">Баланс: {user.balance_tokens}</h3>
                            <button className="btn btn--replenish" onClick={refreshUser}>Обновить</button>
                            <button className="btn btn--danger" onClick={handleLogout}>Выйти</button>
                        </div>
                    </div>
                )}

                <div className="main">
                    {!user || pageName === 'reg' ? (
                        <Auth router={router} />
                    ) : pageName === 'main' ? (
                        renderMain()
                    ) : pageName === 'profile' ? (
                        historyLoading ? <div className="card">Загрузка истории...</div> : renderProfile()
                    ) : pageName === 'admin-panel' && user.is_admin ? (
                        renderAdmin()
                    ) : (
                        <div className="card">Раздел недоступен</div>
                    )}
                </div>

                {historyError && pageName === 'profile' && <div className="global-message">{historyError}</div>}
            </div>
        </StrictMode>
    );
}

createRoot(document.getElementById('root')).render(<Root />);
import { useState } from 'react';
import { api } from '../api/api_client.js';
import './App.css';

export default function Auth({ router }) {
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [reaction, setReaction] = useState('');
    const [loading, setLoading] = useState(false);

    const isRegister = mode === 'register';

    const handleSubmit = async () => {
        setLoading(true);
        setReaction('');

        try {
            const response = isRegister
                ? await api.register({ email, password })
                : await api.login({ email, password });

            api.setSession({
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                user: response.data.user,
            });
            localStorage.removeItem('softwarepr_active_task');
            router('main', { user: response.data.user });
        } catch (error) {
            const message = error.response?.data?.detail || error.message || 'Не удалось выполнить запрос';
            setReaction(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="screen screen--auth">
            <div className="card auth-card">
                <div className="actions">
                    <button
                        className="action-button"
                        onClick={() => setMode('register')}
                        disabled={isRegister}
                        style={{ backgroundColor: isRegister ? '#1c4269' : '#5b7fa6' }}
                    >
                        Регистрация
                    </button>
                    <button
                        className="action-button"
                        onClick={() => setMode('login')}
                        disabled={!isRegister}
                        style={{ backgroundColor: !isRegister ? '#1c4269' : '#5b7fa6' }}
                    >
                        Авторизация
                    </button>
                </div>

                <h3 className="subtitle">{isRegister ? 'Регистрация' : 'Авторизация'}</h3>
                <input className="input" type="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                {reaction && <div className="error-text">{reaction}</div>}
                <button className="login-button" onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Проверяем...' : isRegister ? 'Зарегистрироваться' : 'Войти'}
                </button>
            </div>
        </div>
    );
}
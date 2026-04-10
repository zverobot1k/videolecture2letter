import './App.css';
import KonspektsList from './KonspektsList';
export default function Profile({ router, user, konspekts, onDownload }) {


    /* 
    получение списка конспектов:
    - новый эндпоинт на сервер(user)
    - приходит полный список всех конспектов(с датой создания?) 
    */
    /*
    Профиль
    Почта: блаблабла@маил.ку
    Ваши конспекты:
    Список формата: дата создания - название - кнопка скачать

    Скорее всего надо создать новые jsx - KonspektList.jsx Konspekt.jsx
    */
    return (
        <div className="profile-card">
            <h1>Профиль</h1>
            <h3 className='subtitle'>Почта: {user.email}</h3>
            <h3 className='subtitle'>Баланс: {user.balance}</h3>
            <KonspektsList konspekts={konspekts} onDownload={onDownload} />
        </div>
    );
}
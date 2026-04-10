import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Auth from './Auth.jsx';
import Profile from './Profile.jsx';

const Root = () => {
  const [isAuth, setIsAuth] = useState(true); // true - авторизован, false - страница регистрации
  const [user, setUser] = useState({ email: "lalala", balance: 0, role: "admin" });// test user : {email: "lalala", balance: 0, role: 'admin'}
  const [pageName, setPageName] = useState("main"); // reg - регистрация/авторизация, main - главная, profile - профиль
  const router = (address, body) => {
    setPageName(address);
    if (!isAuth) { //значит роутер вызван из Auth.jsx
      setUser(body.user);
    }
  };

  const onDownload = async () => {

  };

  return (
    <StrictMode>
      <div className='screen'>
        {
          pageName !== 'reg' &&
          <div className='pages'>
            <button onClick={() => setPageName('main')} className='page-button' style={{ backgroundColor: pageName === "main" ? '#1c4269' : '#5b7fa6' }}>Главная</button>
            <button onClick={() => setPageName('profile')} className='page-button' style={{ backgroundColor: pageName === "profile" ? '#1c4269' : '#5b7fa6' }}>Профиль</button>
            {user.role === 'admin' &&
              <button onClick={() => setPageName('admin-panel')} className='page-button' style={{ backgroundColor: pageName === "admin-panel" ? '#1c4269' : '#5b7fa6' }}>Админ-панель</button>
            }
            <div className='balance-bar'>
              <h3 className='balance'>Баланс: {user.balance}</h3>
              <button className='btn btn--replenish'>Пополнить</button>
            </div>
          </div>
        }
        <div className='main'>
          {
            pageName === "reg" ?
              <Auth router={router} />
              :
              pageName === "main" ?
                <App router={router} user={user} />
                :
                pageName === 'profile' ?
                  <Profile router={router} user={user} konspekts={undefined} onDownload={onDownload} /> // konspekts === null onDownload === null!!!!!!!!!!!!!!!
                  :
                  <div></div>
          }
        </div>
      </div>
    </StrictMode>
  );
};



createRoot(document.getElementById('root')).render(<Root />);

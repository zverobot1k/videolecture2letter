import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import Auth from './Auth.jsx';

const Root = () => {
  const [isAuth, setIsAuth] = useState(false); // true - авторизован, false - страница регистрации
  const handleState = () => {

  };

  return (
    <StrictMode>
      {
        isAuth ?
        <App/>
        :
        <Auth handleState={handleState}/>
      }
    </StrictMode>
  );
};



createRoot(document.getElementById('root')).render(<Root/>);

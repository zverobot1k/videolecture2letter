import { useState } from "react";
import { api } from "../api/api_client.js";
import './App.css';
export default function Auth({ handleState }) {
    const [isReg, setIsReg] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [reaction, setReaction] = useState("");
    const [action, setAction] = useState("reg"); // reg || auth

    const handleChangeAction = () => {
        if (action === "reg") {
            setAction("auth");
        } else {
            setAction("reg");
        }
    };

    const handleAuth = async () => {
        try {
            if (isReg) {
                let status = await api.Registration({ "email": email, "password": password });
                switch (status.toString()) {
                    case "200":
                        console.log(`[REG]Пользователь успешно зарегистрирован! Email: ${email}`);
                        setReaction("Вы успешно зарегистрированы!");
                        setIsReg(false);
                        break;
                    case "401":
                        console.log(`[REG]Не указаны обязательные поля!`);
                        setReaction("Не указаны обязательные поля!");
                        break;
                    case "409":
                        console.log(`[REG]Пользователь с таким именем уже существует!`);
                        setReaction("Пользователь с таким именем уже существует!");
                        break;
                    default:
                        console.log(`[REG]Неизвестный статус-код при регистрации: ${status}`);
                        setReaction("Неизвестная реакция...");
                        break;
                }
            } else {
                let response = await api.Login({ "email": email, "password": password });
                let status = response.status;
                let data = response.data;

                switch (status) {
                    case "200":
                        console.log(`[LOG]Пользователь успешно авторизован!`);
                        handleState(true);
                        break;
                    case "404":
                        console.log("[LOG]Пользователь с такой почтой не найден или неправильный пароль!");
                        setReaction("Пользователь с такой почтой не найден или неправильный пароль!");
                        break;
                    case "401":
                        console.log(`[LOG]Не указаны обязательные поля!`);
                        setReaction("Не указаны обязательные поля!");
                        break;
                }
            }
        } catch (err) {
            console.log(err);
        } finally {
            setEmail("");
            setPassword("");
        }
    };

    return (
        <div className="screen">
            <div className="card">
                <div className="actions">
                    <button className="action-button" onClick={handleChangeAction} disabled={action === "reg" ? true : false}
                        style={{ backgroundColor: action === "reg" ? '#1c4269' : '#5b7fa6' }}>Регистрация</button>
                    <button className="action-button" onClick={handleChangeAction} disabled={action === "auth" ? true : false}
                        style={{ backgroundColor: action === "auth" ? '#1c4269' : '#5b7fa6' }}>Авторизация</button>
                </div>
                <h3 className="subtitle">{isReg ? "Регистрация" : "Авторизация"}</h3>
                <input className="input" placeholder="Почта" onChange={(e) => setEmail(e.target.value)} />
                <input className="input" placeholder="Пароль" onChange={(e) => setPassword(e.target.value)} />
                {reaction && (<label className="">reaction</label>)}
                <button className="login-button" onClick={handleAuth}>{isReg ? "Зарегистрироваться" : "Войти"}</button>
            </div>
        </div>
    );
}
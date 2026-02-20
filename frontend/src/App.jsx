import "./App.css";
import { useState } from "react";

function App() {
    const [videoURL, setVideoURL] = useState("");
    const [isCreated, setIsCreated] = useState(false);

    return (
        <div className="screen">
            <div className="card">
                <h1>Создание конспекта</h1>

                <h3 className="subtitle">Вставьте ссылку</h3>

                <input
                    type="text"
                    placeholder="Ссылка на лекцию"
                    value={videoURL}
                    onChange={(e) => setVideoURL(e.target.value)}
                />

                <button
                    className="create-button"
                    onClick={() => setIsCreated(true)}
                >
                    Сделать конспект
                </button>

                {isCreated && (
                    <div className="result">
                        <div>
                            <p className="success">Конспект успешно создан!</p>
                            <p className="title">Заголовок: Пример статьи</p>
                        </div>

                        <button className="download-button">
                            Скачать файл
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;

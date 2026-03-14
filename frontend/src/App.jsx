import "./App.css";
import { useState } from "react";
import { api } from "frontend\api\api_client.js";

function App() {
    const [videoURL, setVideoURL] = useState("");
    const [isCreated, setIsCreated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [taskId, setTaskId] = useState(null)
    const [error, setError] = useState(null)

    const port = 8000;

    const handleCreateSummary = async () => {
        if(!videoURL){
            alert("Вставьте ссылку на видео!")
            return
        }
        
        setLoading(true);
        setError(null);

        try{
            await api.handleVideo(videoURL);

            
            if(!response.ok){
                throw new Error(`[ERROR]: ${response.status}`);
            }

            const data = await response.json();
            setTaskId(data.task_id);
            setIsCreated(true);
        } catch(err){
            setError(err.message);
            console.error('[ERROR]: ', err);
        } finally{
            setLoading(false);
        }
    }

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
                    disabled={loading}
                />

                <button
                    className="create-button"
                    onClick={() => handleCreateSummary()}
                    disabled={loading}
                >
                    {loading ? "Обработка видео..." : "Сделать конспект"}
                </button>

                {error && (
                    <div className="error">
                        <p style={{ color: 'red' }}>Ошибка: {error}</p>
                    </div>
                )}

                {isCreated && (
                    <div className="result">
                        <div>
                            <p className="success">Конспект успешно создан!</p>
                            <p className="title">Заголовок: Пример статьи</p>
                            {taskId && (
                                <p className="task-id" style={{ fontSize: '12px', color: '#666' }}>
                                    Task ID: {taskId}
                                </p>
                            )}
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

import { useState } from 'react'
import './App.css'
import NeonBackground from "./NeonBackground";


function App() {
  const [videoURL, setvideoURL] = useState("")

  return (
    <div className="App">
      <NeonBackground />

      <div style={{ padding: "2rem", position: "relative", zIndex: 1 }}>
        <h1>Конспект видео</h1>

        <input
          type="text"
          placeholder="Cсылка на лекцию"
          value={videoURL}
          onChange={(e) => setVideoURL(e.target.value)} // ✅ fixed
          style={{ width: "300px", marginRight: "1rem" }}
        />

        <button>Создать конспект</button>
      </div>
    </div>
  );
}

export default App;

import axios from 'axios'

const apiClient = axios.create({
    baseURL: "http://localhost:8000/process",
    headers:{
        'Content-Type': 'application/json',
        'accept': 'application/json'
    }
});

export const api = {
    handleVideo: async (url, prompt) => {
        let res = await apiClient.post('/', { url: url, prompt: prompt });
        return res.data;
    },
    getTaskStatus: async (task_id) => {
        let res = await apiClient.get(`/${task_id}`);
        return res.data;
    }
}
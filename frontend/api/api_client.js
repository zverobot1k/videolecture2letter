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
    },
    //user_data: { "email": "lalala@mail.ru", "password":"parol123" }
    //response(примерный): { status(201)/status(409)/status(401), access_token, refresh_token }
    Registration: async (user_data) => {
        let res = await apiClient.post('/auth/registration', user_data);
        return res.status;
    },
    //Headers: "Bearer": "access_token"
    //user_data: { "email": "lalala@mail.ru", "password":"parol123" }
    //response(примерный): { status(200)/status(404)/status(401), access_token, refresh_token }
    Login: async (user_data) => {
        let res = await apiClient.post('/auth/login', user_data);
        return {status: res.status, data: res.data };
    },
}
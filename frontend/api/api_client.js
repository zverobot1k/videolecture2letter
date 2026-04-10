import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const ACCESS_TOKEN_KEY = 'softwarepr_access_token';
const REFRESH_TOKEN_KEY = 'softwarepr_refresh_token';
const USER_KEY = 'softwarepr_user';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
    },
});

const authClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
    },
});

let refreshPromise = null;

function readJsonStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function writeJsonStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setSession({ accessToken, refreshToken, user }) {
    if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (user) {
        writeJsonStorage(USER_KEY, user);
    }
}

function clearSession() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function getStoredUser() {
    return readJsonStorage(USER_KEY);
}

function extractFileName(contentDispositionHeader) {
    if (!contentDispositionHeader) {
        return 'summary.txt';
    }

    const match = contentDispositionHeader.match(/filename="?([^";]+)"?/i);
    return match ? match[1] : 'summary.txt';
}

apiClient.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
            throw error;
        }

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            clearSession();
            throw error;
        }

        originalRequest._retry = true;
        try {
            if (!refreshPromise) {
                refreshPromise = authClient.post('/auth/refresh', { refresh_token: refreshToken })
                    .then((response) => response.data.access_token)
                    .finally(() => {
                        refreshPromise = null;
                    });
            }

            const newAccessToken = await refreshPromise;
            localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
        } catch (refreshError) {
            clearSession();
            throw refreshError;
        }
    },
);

async function authRequest(method, path, payload) {
    const response = await authClient.request({
        method,
        url: path,
        data: payload,
    });
    return response;
}

async function readBlobResponse(response) {
    const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
    if (contentType.includes('application/json')) {
        const text = await response.data.text();
        return { kind: 'json', data: JSON.parse(text) };
    }

    return {
        kind: 'file',
        blob: response.data,
        filename: extractFileName(response.headers['content-disposition'] || response.headers['Content-Disposition']),
    };
}

export const api = {
    setSession,
    clearSession,
    getStoredUser,
    getAccessToken,
    getRefreshToken,

    register: async (userData) => authRequest('post', '/auth/register', userData),
    login: async (userData) => authRequest('post', '/auth/login', userData),
    refreshAccessToken: async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            return null;
        }

        const response = await authClient.post('/auth/refresh', { refresh_token: refreshToken });
        localStorage.setItem(ACCESS_TOKEN_KEY, response.data.access_token);
        return response.data.access_token;
    },
    getMe: async () => apiClient.get('/auth/me'),

    handleVideo: async (url, prompt, size) => apiClient.post('/process', { url, prompt, size }),
    cancelTask: async (taskId) => apiClient.delete(`/process/${taskId}`),
    getTaskStatus: async (taskId) => {
        const response = await apiClient.get(`/process/${taskId}`, { responseType: 'blob' });
        return readBlobResponse(response);
    },
    getHistory: async () => apiClient.get('/process/history'),

    findUserByEmail: async (email) => apiClient.get(`/admin/users/by-email/${encodeURIComponent(email)}`),
    updateUserBalanceByEmail: async (email, balanceTokens) => apiClient.patch(
        `/admin/users/by-email/${encodeURIComponent(email)}/balance`,
        { balance_tokens: balanceTokens },
    ),
};
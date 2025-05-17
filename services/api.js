import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add a request interceptor to add the token to every request
api.interceptors.request.use(
    (config) => {
        // Get token from cookie
        const token = document.cookie
            .split('; ')
            .find(row => row.startsWith('customerToken='))
            ?.split('=')[1];

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 409 && error.response?.data?.error === 'Please Login First') {
            // Redirect to login page if token is invalid or expired
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api; 
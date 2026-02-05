// frontend/src/api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// API Base URL - reads from .env file via app.config.js
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/v1';

// Create axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add token to requests
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Error getting token:', error);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        if (error.response) {
            // Server responded with error
            const { status } = error.response;

            if (status === 401) {
                // Unauthorized - clear token and redirect to login
                await AsyncStorage.removeItem('userToken');
                await AsyncStorage.removeItem('user');
                // You can emit an event here to navigate to login
            }
        } else if (error.request) {
            // Request made but no response
            console.error('Network error:', error.request);
        } else {
            // Something else happened
            console.error('Error:', error.message);
        }

        return Promise.reject(error);
    }
);

export default apiClient;
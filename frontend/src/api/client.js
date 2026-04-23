// frontend/src/api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Resolve the API base URL automatically.
// Priority:
//   1. API_URL from .env (if set AND not "auto"/localhost — for prod / remote servers)
//   2. Auto-detect the dev machine's LAN IP from Expo's Metro bundler host
//      (works on any WiFi, no need to edit .env each time)
//   3. Fallback to localhost
const API_PORT = 3000;
const API_PATH = '/api/v1';

function resolveApiBaseUrl() {
    const envUrl = Constants.expoConfig?.extra?.apiUrl;

    // If user explicitly set a real URL (not localhost, not "auto"), use it
    if (envUrl && envUrl !== 'auto' && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
    }

    // Auto-detect: grab the IP Expo/Metro is running on — that's the dev machine
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.expoGoConfig?.debuggerHost ||
        Constants.manifest?.debuggerHost ||
        Constants.manifest2?.extra?.expoClient?.hostUri ||
        Constants.manifest?.hostUri;

    if (hostUri) {
        const host = hostUri.split(':')[0];
        return `http://${host}:${API_PORT}${API_PATH}`;
    }

    return envUrl || `http://localhost:${API_PORT}${API_PATH}`;
}

const API_BASE_URL = resolveApiBaseUrl();
console.log('[API] Base URL:', API_BASE_URL);

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
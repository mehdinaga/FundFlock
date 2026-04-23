// frontend/src/api/auth.js
import apiClient from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Register new user
export const register = async (fullName, email, password) => {
    try {
        const response = await apiClient.post('/auth/register', {
            fullName,
            email,
            password,
        });

        if (response.data.success) {
            // Save token and user data
            await AsyncStorage.setItem('userToken', response.data.data.token);
            await AsyncStorage.setItem('user', JSON.stringify(response.data.data.user));
            return response.data;
        }
    } catch (error) {
        throw error.response?.data || { error: { message: 'Registration failed' } };
    }
};

// Login user
export const login = async (email, password) => {
    try {
        const response = await apiClient.post('/auth/login', {
            email,
            password,
        });

        if (response.data.success) {
            // Save token and user data
            await AsyncStorage.setItem('userToken', response.data.data.token);
            await AsyncStorage.setItem('user', JSON.stringify(response.data.data.user));
            return response.data;
        }
    } catch (error) {
        throw error.response?.data || { error: { message: 'Login failed' } };
    }
};

// Logout user
export const logout = async () => {
    try {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('user');
    } catch (error) {
        console.error('Logout error:', error);
    }
};

// Get current user
export const getCurrentUser = async () => {
    try {
        const response = await apiClient.get('/auth/me');

        if (response.data.success) {
            // Update stored user data
            await AsyncStorage.setItem('user', JSON.stringify(response.data.data));
            return response.data.data;
        }
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to get user' } };
    }
};

// Forgot password
export const forgotPassword = async (email) => {
    try {
        const response = await apiClient.post('/auth/forgot-password', {
            email,
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Request failed' } };
    }
};

// Reset password
export const resetPassword = async (resetCode, newPassword) => {
    try {
        const response = await apiClient.post('/auth/reset-password', {
            resetCode,
            newPassword,
        });

        if (response.data.success) {
            // Save new token
            await AsyncStorage.setItem('userToken', response.data.data.token);
            return response.data;
        }
    } catch (error) {
        throw error.response?.data || { error: { message: 'Reset failed' } };
    }
};

// Change password (requires current password)
export const changePassword = async (currentPassword, newPassword) => {
    try {
        const response = await apiClient.put('/auth/change-password', {
            currentPassword,
            newPassword,
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Password change failed' } };
    }
};

// Delete account (requires password confirmation)
export const deleteAccount = async (password) => {
    try {
        const response = await apiClient.delete('/auth/delete-account', {
            data: { password }
        });
        // Clear stored data
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('user');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to delete account' } };
    }
};

// Update profile
export const updateProfile = async (profileData) => {
    try {
        const response = await apiClient.put('/auth/update-profile', profileData);
        if (response.data.success) {
            // Update stored user data
            await AsyncStorage.setItem('user', JSON.stringify(response.data.data));
            return response.data;
        }
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to update profile' } };
    }
};

// Upload avatar (multipart file upload → returns permanent URL)
export const uploadAvatar = async (imageUri) => {
    try {
        const filename = imageUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : 'jpg';
        const mimeType = ext === 'png' ? 'image/png'
            : ext === 'gif' ? 'image/gif'
            : ext === 'webp' ? 'image/webp'
            : 'image/jpeg';

        const formData = new FormData();
        formData.append('avatar', {
            uri: imageUri,
            name: filename,
            type: mimeType,
        });

        const response = await apiClient.post('/auth/upload-avatar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            transformRequest: (data) => data,
        });

        if (response.data.success) {
            await AsyncStorage.setItem('user', JSON.stringify(response.data.data));
            return response.data;
        }
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to upload avatar' } };
    }
};

// Check if user is authenticated
export const isAuthenticated = async () => {
    try {
        const token = await AsyncStorage.getItem('userToken');
        return !!token;
    } catch (error) {
        return false;
    }
};

// Get stored token
export const getToken = async () => {
    try {
        return await AsyncStorage.getItem('userToken');
    } catch (error) {
        return null;
    }
};

// Get stored user
export const getStoredUser = async () => {
    try {
        const userJson = await AsyncStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
        return null;
    }
};
// src/api/users.js
import apiClient from './client';

export const searchUsers = async (query) => {
    try {
        const response = await apiClient.get(`/users/search?q=${encodeURIComponent(query)}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Search failed' } };
    }
};

export const getUser = async (id) => {
    try {
        const response = await apiClient.get(`/users/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch user' } };
    }
};

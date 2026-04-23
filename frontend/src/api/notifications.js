// src/api/notifications.js
import apiClient from './client';

export const getNotifications = async () => {
    try {
        const response = await apiClient.get('/notifications');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch notifications' } };
    }
};

export const getUnreadCount = async () => {
    try {
        const response = await apiClient.get('/notifications/unread-count');
        return response.data;
    } catch (error) {
        return { data: { count: 0 } };
    }
};

export const markRead = async (id) => {
    try {
        const response = await apiClient.put(`/notifications/${id}/read`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to mark as read' } };
    }
};

export const markAllRead = async () => {
    try {
        const response = await apiClient.put('/notifications/read-all');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to mark all as read' } };
    }
};

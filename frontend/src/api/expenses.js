// src/api/expenses.js
import apiClient from './client';

export const createExpense = async (data) => {
    try {
        const response = await apiClient.post('/expenses', data);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to create expense' } };
    }
};

export const getExpenses = async () => {
    try {
        const response = await apiClient.get('/expenses');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch expenses' } };
    }
};

export const getExpense = async (id) => {
    try {
        const response = await apiClient.get(`/expenses/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch expense' } };
    }
};

export const updateExpense = async (id, data) => {
    try {
        const response = await apiClient.put(`/expenses/${id}`, data);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to update expense' } };
    }
};

export const deleteExpense = async (id) => {
    try {
        const response = await apiClient.delete(`/expenses/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to delete expense' } };
    }
};

export const getGroupExpenses = async (groupId) => {
    try {
        const response = await apiClient.get(`/expenses/group/${groupId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch group expenses' } };
    }
};

export const getFriendExpenses = async (friendId) => {
    try {
        const response = await apiClient.get(`/expenses/friend/${friendId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch friend expenses' } };
    }
};

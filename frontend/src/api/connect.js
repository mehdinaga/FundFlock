// src/api/connect.js
import apiClient from './client';

export const getConnectAccount = async () => {
    try {
        const res = await apiClient.get('/connect/account');
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch account status' } };
    }
};

export const createOnboardingLink = async () => {
    try {
        const res = await apiClient.post('/connect/onboarding-link');
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to start onboarding' } };
    }
};

export const createLoginLink = async () => {
    try {
        const res = await apiClient.post('/connect/login-link');
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to open Stripe dashboard' } };
    }
};

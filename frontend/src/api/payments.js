// src/api/payments.js
import apiClient from './client';

export const createSettlementIntent = async ({ recipientId, amount, note }) => {
    try {
        const res = await apiClient.post('/payments/settle', { recipientId, amount, note });
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to start payment' } };
    }
};

export const cancelSettlement = async (settlementId) => {
    try {
        const res = await apiClient.post(`/payments/settlements/${settlementId}/cancel`);
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to cancel payment' } };
    }
};

export const listSettlements = async () => {
    try {
        const res = await apiClient.get('/payments/settlements');
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to load settlements' } };
    }
};

// Hide a settlement from the current user's receipts list (soft delete).
// The other party still sees the record — settlements are financial history,
// not notes, so we never hard-delete them.
export const deleteSettlement = async (settlementId) => {
    try {
        const res = await apiClient.delete(`/payments/settlements/${settlementId}`);
        return res.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to delete receipt' } };
    }
};

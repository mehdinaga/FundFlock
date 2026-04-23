// frontend/src/api/friends.js
import apiClient from './client';

// Get all friends
export const getFriends = async () => {
    try {
        const response = await apiClient.get('/friends');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to get friends' } };
    }
};

// Get pending friend requests
export const getPendingRequests = async () => {
    try {
        const response = await apiClient.get('/friends/pending');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to get pending requests' } };
    }
};

// Search user by email
export const searchUserByEmail = async (email) => {
    try {
        const response = await apiClient.get('/friends/search', {
            params: { email }
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Search failed' } };
    }
};

// Send friend request
export const sendFriendRequest = async (email) => {
    try {
        const response = await apiClient.post('/friends/request', { email });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to send friend request' } };
    }
};

// Accept friend request
export const acceptFriendRequest = async (friendshipId) => {
    try {
        const response = await apiClient.put(`/friends/${friendshipId}/accept`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to accept request' } };
    }
};

// Decline friend request
export const declineFriendRequest = async (friendshipId) => {
    try {
        const response = await apiClient.put(`/friends/${friendshipId}/decline`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to decline request' } };
    }
};

// Remove friend
export const removeFriend = async (friendshipId) => {
    try {
        const response = await apiClient.delete(`/friends/${friendshipId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to remove friend' } };
    }
};

// Generate invite link
export const generateInviteLink = async () => {
    try {
        const response = await apiClient.post('/friends/invite');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to generate invite link' } };
    }
};

// Accept invite link
export const acceptInvite = async (userId) => {
    try {
        const response = await apiClient.post('/friends/invite/accept', { userId });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to accept invite' } };
    }
};

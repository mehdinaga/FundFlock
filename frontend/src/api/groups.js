// src/api/groups.js
import apiClient from './client';

export const createGroup = async (data) => {
    try {
        const response = await apiClient.post('/groups', data);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to create group' } };
    }
};

export const getGroups = async () => {
    try {
        const response = await apiClient.get('/groups');
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch groups' } };
    }
};

export const getGroup = async (id) => {
    try {
        const response = await apiClient.get(`/groups/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to fetch group' } };
    }
};

export const updateGroup = async (id, data) => {
    try {
        const response = await apiClient.put(`/groups/${id}`, data);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to update group' } };
    }
};

export const addMemberToGroup = async (groupId, userId) => {
    try {
        const response = await apiClient.post(`/groups/${groupId}/members`, { userId });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to add member' } };
    }
};

export const leaveGroup = async (groupId) => {
    try {
        const response = await apiClient.delete(`/groups/${groupId}/leave`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to leave group' } };
    }
};

export const deleteGroup = async (groupId) => {
    try {
        const response = await apiClient.delete(`/groups/${groupId}`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to delete group' } };
    }
};

export const getInviteLink = async (groupId) => {
    try {
        const response = await apiClient.get(`/groups/${groupId}/invite`);
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to get invite link' } };
    }
};

export const joinViaInvite = async (inviteCode) => {
    try {
        const response = await apiClient.post('/groups/join', { inviteCode });
        return response.data;
    } catch (error) {
        throw error.response?.data || { error: { message: 'Failed to join group' } };
    }
};

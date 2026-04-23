// src/screens/friends/PendingRequestsScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, ActivityIndicator, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPendingRequests, acceptFriendRequest, declineFriendRequest } from '../../api/friends';

const COLORS = {
    primary: '#F97316',
    background: '#FFFFFF',
    text: '#171717',
    textSecondary: '#737373',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    success: '#10B981',
    danger: '#EF4444',
};

const AVATAR_COLORS = [
    '#F97316', '#3B82F6', '#10B981', '#8B5CF6',
    '#EF4444', '#EC4899', '#14B8A6', '#F59E0B',
];

const getAvatarColor = (name) => {
    const index = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};

const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

// Renders either the user's uploaded avatar or an initials placeholder.
// Used for both received and sent request rows.
const RequestAvatar = ({ user }) => {
    if (user?.avatar) {
        return (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
        );
    }
    return (
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(user.fullName) }]}>
            <Text style={styles.avatarText}>{getInitials(user.fullName)}</Text>
        </View>
    );
};

const PendingRequestsScreen = ({ navigation }) => {
    const [received, setReceived] = useState([]);
    const [sent, setSent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingIds, setProcessingIds] = useState(new Set());

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            const result = await getPendingRequests();
            if (result.success) {
                setReceived(result.data.received);
                setSent(result.data.sent);
            }
        } catch (error) {
            console.error('Load pending requests error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (friendshipId) => {
        setProcessingIds(prev => new Set([...prev, friendshipId]));
        try {
            await acceptFriendRequest(friendshipId);
            setReceived(prev => prev.filter(r => r.friendshipId !== friendshipId));
        } catch (error) {
            Alert.alert('Error', error?.error?.message || 'Failed to accept request');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(friendshipId);
                return next;
            });
        }
    };

    const handleDecline = async (friendshipId) => {
        setProcessingIds(prev => new Set([...prev, friendshipId]));
        try {
            await declineFriendRequest(friendshipId);
            setReceived(prev => prev.filter(r => r.friendshipId !== friendshipId));
        } catch (error) {
            Alert.alert('Error', error?.error?.message || 'Failed to decline request');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(friendshipId);
                return next;
            });
        }
    };

    const renderReceivedItem = ({ item }) => {
        const isProcessing = processingIds.has(item.friendshipId);

        return (
            <View style={styles.requestItem}>
                <RequestAvatar user={item.user} />
                <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{item.user.fullName}</Text>
                    <Text style={styles.requestEmail}>{item.user.email}</Text>
                </View>
                {isProcessing ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                    <View style={styles.requestActions}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() => handleAccept(item.friendshipId)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.declineBtn]}
                            onPress={() => handleDecline(item.friendshipId)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={20} color={COLORS.danger} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    const renderSentItem = ({ item }) => (
        <View style={styles.requestItem}>
            <RequestAvatar user={item.user} />
            <View style={styles.requestInfo}>
                <Text style={styles.requestName}>{item.user.fullName}</Text>
                <Text style={styles.requestEmail}>{item.user.email}</Text>
            </View>
            <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Friend Requests</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friend Requests</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={[]}
                renderItem={null}
                ListHeaderComponent={() => (
                    <View>
                        {/* Received Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Received ({received.length})
                            </Text>
                            {received.length === 0 ? (
                                <Text style={styles.emptyText}>No pending requests</Text>
                            ) : (
                                received.map(item => (
                                    <View key={item.friendshipId}>
                                        {renderReceivedItem({ item })}
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Sent Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Sent ({sent.length})
                            </Text>
                            {sent.length === 0 ? (
                                <Text style={styles.emptyText}>No sent requests</Text>
                            ) : (
                                sent.map(item => (
                                    <View key={item.friendshipId}>
                                        {renderSentItem({ item })}
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                )}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textMuted,
        paddingVertical: 16,
    },
    requestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    requestInfo: {
        flex: 1,
        marginLeft: 14,
    },
    requestName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    requestEmail: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    requestActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: COLORS.success,
    },
    declineBtn: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    pendingBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F5F5F5',
    },
    pendingBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
});

export default PendingRequestsScreen;

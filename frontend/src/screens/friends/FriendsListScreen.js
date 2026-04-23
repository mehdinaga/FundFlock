// src/screens/friends/FriendsListScreen.js
import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    RefreshControl, SafeAreaView, ActivityIndicator, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFriends, getPendingRequests } from '../../api/friends';

const COLORS = {
    primary: '#F97316',
    background: '#FFFFFF',
    text: '#171717',
    textSecondary: '#737373',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    success: '#10B981',
    danger: '#EF4444',
    cardBg: '#FAFAFA',
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

const AvatarCircle = ({ name, avatar, size = 48 }) => {
    // Prefer the user's uploaded avatar. Fall back to a deterministic
    // coloured circle with initials so rows still read well before anyone
    // has uploaded a photo.
    if (avatar) {
        return (
            <Image
                source={{ uri: avatar }}
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E5E5' }}
            />
        );
    }
    const color = getAvatarColor(name);
    const initials = getInitials(name);
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
            <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
    );
};

const FriendItem = ({ item, onPress }) => {
    const { friend, balance } = item;
    const balanceText = balance === 0 ? 'settled up' : balance > 0 ? `owes you` : `you owe`;
    const balanceColor = balance === 0 ? COLORS.textMuted : balance > 0 ? COLORS.success : COLORS.danger;
    const balanceAmount = balance !== 0 ? `£${Math.abs(balance).toFixed(2)}` : '';

    return (
        <TouchableOpacity style={styles.friendItem} onPress={() => onPress(item)} activeOpacity={0.7}>
            <AvatarCircle name={friend.fullName} avatar={friend.avatar} />
            <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friend.fullName}</Text>
                <Text style={styles.friendEmail}>{friend.email}</Text>
            </View>
            <View style={styles.balanceContainer}>
                <Text style={[styles.balanceLabel, { color: balanceColor }]}>{balanceText}</Text>
                {balanceAmount ? (
                    <Text style={[styles.balanceAmount, { color: balanceColor }]}>{balanceAmount}</Text>
                ) : null}
            </View>
        </TouchableOpacity>
    );
};

const FriendsListScreen = ({ navigation }) => {
    const [friends, setFriends] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [friendsRes, pendingRes] = await Promise.all([
                getFriends(),
                getPendingRequests()
            ]);

            if (friendsRes.success) {
                setFriends(friendsRes.data.friends);
            }
            if (pendingRes.success) {
                setPendingCount(pendingRes.data.receivedCount);
            }
        } catch (error) {
            console.error('Load friends error:', error);
            setError('Could not load friends. Please check your connection and try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleFriendPress = (item) => {
        navigation.navigate('FriendDetail', {
            friend: item.friend,
            friendshipId: item.friendshipId,
            balance: item.balance,
        });
    };

    const renderHeader = () => (
        <>
            {pendingCount > 0 && (
                <TouchableOpacity
                    style={styles.pendingBanner}
                    onPress={() => navigation.navigate('PendingRequests')}
                    activeOpacity={0.7}
                >
                    <View style={styles.pendingLeft}>
                        <Ionicons name="person-add" size={20} color={COLORS.primary} />
                        <Text style={styles.pendingText}>
                            You have {pendingCount} pending friend request{pendingCount > 1 ? 's' : ''}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                </TouchableOpacity>
            )}
        </>
    );

    const renderEmpty = () => {
        if (loading) {
            return (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={[styles.emptyText, { marginTop: 16 }]}>Loading friends...</Text>
                </View>
            );
        }
        if (error) {
            return (
                <View style={styles.emptyContainer}>
                    <Ionicons name="cloud-offline-outline" size={64} color="#D4D4D4" />
                    <Text style={styles.emptyTitle}>Something went wrong</Text>
                    <Text style={styles.emptyText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.emptyButton}
                        onPress={() => { setLoading(true); loadData(); }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.emptyButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#D4D4D4" />
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>Add friends to start splitting expenses!</Text>
                <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => navigation.navigate('AddFriend')}
                    activeOpacity={0.8}
                >
                    <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.emptyButtonText}>Add Friend</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Friends</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('AddFriend')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="person-add-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.addButtonText}>Add friend</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={friends}
                keyExtractor={(item) => item.friendshipId}
                renderItem={({ item }) => (
                    <FriendItem item={item} onPress={handleFriendPress} />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                contentContainerStyle={friends.length === 0 ? styles.emptyList : styles.list}
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    list: {
        paddingBottom: 20,
    },
    emptyList: {
        flexGrow: 1,
    },
    pendingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 24,
        marginTop: 16,
        padding: 16,
        backgroundColor: '#FFF7ED',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    pendingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    pendingText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    avatar: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    friendInfo: {
        flex: 1,
        marginLeft: 14,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
    },
    friendEmail: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    balanceContainer: {
        alignItems: 'flex-end',
    },
    balanceLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    balanceAmount: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 20,
    },
    emptyText: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    emptyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default FriendsListScreen;

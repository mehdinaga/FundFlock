// src/screens/notifications/NotificationsScreen.js
// Unified in-app activity feed. Every row taps into something actionable
// when possible — opening a receipt, a friend request, or the relevant
// expense. Optimistic mark-as-read so the badge clears instantly.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    StatusBar,
    Linking,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    getNotifications,
    markRead,
    markAllRead,
} from '../../api/notifications';
import { listSettlements } from '../../api/payments';

// Visual metadata per notification type. Keep in sync with the Notification
// model enum on the backend — adding a new type there should add one here too.
const TYPE_META = {
    new_expense: { icon: 'receipt-outline', color: '#F97316', bg: '#FFF7ED' },
    expense_updated: { icon: 'create-outline', color: '#6366F1', bg: '#EEF2FF' },
    expense_deleted: { icon: 'trash-outline', color: '#EF4444', bg: '#FEE2E2' },
    payment_reminder: { icon: 'alarm-outline', color: '#F59E0B', bg: '#FEF3C7' },
    payment_received: { icon: 'cash-outline', color: '#10B981', bg: '#D1FAE5' },
    added_to_group: { icon: 'people-outline', color: '#0EA5E9', bg: '#E0F2FE' },
    friend_request: { icon: 'person-add-outline', color: '#F97316', bg: '#FFF7ED' },
    friend_accepted: { icon: 'checkmark-circle-outline', color: '#10B981', bg: '#D1FAE5' },
    settlement_received: { icon: 'arrow-down-circle-outline', color: '#10B981', bg: '#D1FAE5' },
    settlement_sent: { icon: 'arrow-up-circle-outline', color: '#EF4444', bg: '#FEE2E2' },
    settlement_failed: { icon: 'close-circle-outline', color: '#EF4444', bg: '#FEE2E2' },
    settlement_refunded: { icon: 'return-up-back-outline', color: '#6366F1', bg: '#EEF2FF' },
    payout_account_ready: { icon: 'wallet-outline', color: '#10B981', bg: '#D1FAE5' },
    payout_account_issue: { icon: 'warning-outline', color: '#F59E0B', bg: '#FEF3C7' },
    default: { icon: 'notifications-outline', color: '#737373', bg: '#F5F5F5' },
};

const relativeTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString();
};

const NotificationsScreen = ({ navigation }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // all | unread
    // Cached settlements keyed by _id — used so tapping a settlement_*
    // notification can open the Stripe receipt without navigating anywhere.
    const [settlementsById, setSettlementsById] = useState({});

    const load = useCallback(async () => {
        try {
            const [notifRes, settleRes] = await Promise.all([
                getNotifications(),
                listSettlements().catch(() => ({ data: [] })),
            ]);
            setItems(Array.isArray(notifRes?.data) ? notifRes.data : []);
            const map = {};
            for (const s of settleRes?.data || []) map[s._id] = s;
            setSettlementsById(map);
        } catch (err) {
            Alert.alert('Error', err?.error?.message || 'Could not load notifications');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        load();
    }, [load]);

    const filtered = useMemo(
        () =>
            filter === 'unread'
                ? items.filter((n) => !n.isRead)
                : items,
        [items, filter]
    );

    const unreadCount = useMemo(
        () => items.filter((n) => !n.isRead).length,
        [items]
    );

    const handleTap = async (n) => {
        // Optimistically flip to read so the badge updates without a round-trip.
        if (!n.isRead) {
            setItems((prev) =>
                prev.map((x) => (x._id === n._id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x))
            );
            markRead(n._id).catch(() => {
                // If it fails we're OK leaving the optimistic state — the next
                // refresh will reconcile.
            });
        }

        // Open the most useful surface for the notification type.
        const sid = n.data?.settlementId?.toString?.() || n.data?.settlementId;
        if (sid && settlementsById[sid]?.receiptUrl) {
            try {
                await Linking.openURL(settlementsById[sid].receiptUrl);
                return;
            } catch {
                // fall through
            }
        }

        if (n.type === 'settlement_sent' || n.type === 'settlement_received') {
            Alert.alert(
                'Receipt not ready',
                'The receipt for this payment is still being finalised. Check Profile → Receipts in a moment.'
            );
        }
    };

    const handleMarkAll = async () => {
        if (unreadCount === 0) return;
        const now = new Date().toISOString();
        setItems((prev) => prev.map((x) => ({ ...x, isRead: true, readAt: x.readAt || now })));
        try {
            await markAllRead();
        } catch {
            // swallow — optimistic state will reconcile on refresh
        }
    };

    const renderItem = ({ item }) => {
        const meta = TYPE_META[item.type] || TYPE_META.default;
        return (
            <TouchableOpacity
                style={[styles.row, !item.isRead && styles.rowUnread]}
                onPress={() => handleTap(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconBubble, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                            {item.title}
                        </Text>
                        <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.rowBody} numberOfLines={2}>
                        {item.body}
                    </Text>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation?.goBack?.()}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={24} color="#171717" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity
                    onPress={handleMarkAll}
                    disabled={unreadCount === 0}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text
                        style={[
                            styles.markAllText,
                            unreadCount === 0 && styles.markAllDisabled,
                        ]}
                    >
                        Mark all
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filtersRow}>
                <TouchableOpacity
                    style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
                    onPress={() => setFilter('all')}
                >
                    <Text
                        style={[
                            styles.filterText,
                            filter === 'all' && styles.filterTextActive,
                        ]}
                    >
                        All{items.length > 0 ? ` · ${items.length}` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterPill, filter === 'unread' && styles.filterPillActive]}
                    onPress={() => setFilter('unread')}
                >
                    <Text
                        style={[
                            styles.filterText,
                            filter === 'unread' && styles.filterTextActive,
                        ]}
                    >
                        Unread{unreadCount > 0 ? ` · ${unreadCount}` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#F97316" />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={
                        filtered.length === 0 ? styles.emptyWrap : styles.listWrap
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#F97316"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyInner}>
                            <Ionicons name="notifications-off-outline" size={48} color="#D4D4D4" />
                            <Text style={styles.emptyTitle}>
                                {filter === 'unread' ? "You're all caught up" : 'Nothing here yet'}
                            </Text>
                            <Text style={styles.emptyBody}>
                                {filter === 'unread'
                                    ? 'No unread notifications — good job staying on top of things.'
                                    : 'Activity from your friends, groups, and payments will show up here.'}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
    markAllText: { color: '#F97316', fontWeight: '700', fontSize: 14 },
    markAllDisabled: { color: '#D4D4D4' },

    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    filterPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    filterPillActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
    filterText: { fontSize: 13, color: '#525252', fontWeight: '600' },
    filterTextActive: { color: '#FFFFFF' },

    listWrap: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    emptyInner: { alignItems: 'center' },
    emptyTitle: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '700',
        color: '#404040',
    },
    emptyBody: {
        marginTop: 6,
        fontSize: 13,
        color: '#737373',
        textAlign: 'center',
    },

    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    rowUnread: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    iconBubble: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowMain: { flex: 1 },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#171717',
        marginRight: 8,
    },
    rowTime: { fontSize: 12, color: '#A3A3A3' },
    rowBody: { marginTop: 2, fontSize: 13, color: '#525252', lineHeight: 18 },
    unreadDot: {
        position: 'absolute',
        right: 10,
        top: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#F97316',
    },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default NotificationsScreen;

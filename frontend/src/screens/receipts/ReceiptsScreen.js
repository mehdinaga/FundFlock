// src/screens/receipts/ReceiptsScreen.js
// A searchable list of every settlement that ever succeeded for this user.
// Tapping a row opens a FundFlock-branded receipt rendered in-app — we no
// longer bounce out to Stripe's hosted receipt (which depends on an async
// webhook and was producing "Receipt not ready" dialogs).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    TextInput,
    SafeAreaView,
    Platform,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { listSettlements, deleteSettlement } from '../../api/payments';
import { useAuth } from '../../context/AuthContext';
import ReceiptDetailModal from '../../components/ReceiptDetailModal';

const STATUS_META = {
    succeeded: { label: 'Paid', color: '#10B981', bg: '#D1FAE5' },
    processing: { label: 'Processing', color: '#F59E0B', bg: '#FEF3C7' },
    pending: { label: 'Pending', color: '#A3A3A3', bg: '#F5F5F5' },
    failed: { label: 'Failed', color: '#EF4444', bg: '#FEE2E2' },
    canceled: { label: 'Canceled', color: '#737373', bg: '#F5F5F5' },
    refunded: { label: 'Refunded', color: '#6366F1', bg: '#E0E7FF' },
};

const formatMoney = (cents) => `£${((cents || 0) / 100).toFixed(2)}`;

const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

// A single receipt row wrapped in a Swipeable so the user can swipe
// from the right to reveal a Delete action (same pattern as expenses).
const ReceiptRow = ({ item, myId, onPress, onDelete }) => {
    const swipeRef = React.useRef(null);
    const isPayer = item.payer?._id?.toString() === myId;
    const other = isPayer ? item.recipient : item.payer;
    const meta = STATUS_META[item.status] || STATUS_META.pending;

    const renderRightActions = () => (
        <TouchableOpacity
            style={styles.deleteAction}
            activeOpacity={0.85}
            onPress={() => {
                swipeRef.current?.close();
                onDelete?.();
            }}
        >
            <Ionicons name="trash-outline" size={22} color="#FFF" />
            <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
    );

    return (
        <Swipeable
            ref={swipeRef}
            renderRightActions={onDelete ? renderRightActions : undefined}
            friction={1.6}
            rightThreshold={40}
            overshootRight={false}
            containerStyle={styles.swipeWrap}
        >
            <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
                <View style={[styles.avatar, { backgroundColor: isPayer ? '#FEE2E2' : '#D1FAE5' }]}>
                    <Ionicons
                        name={isPayer ? 'arrow-up' : 'arrow-down'}
                        size={20}
                        color={isPayer ? '#EF4444' : '#10B981'}
                    />
                </View>
                <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                        <Text style={styles.rowName} numberOfLines={1}>
                            {isPayer ? 'To ' : 'From '}
                            {other?.fullName || other?.email || 'Unknown'}
                        </Text>
                        <Text
                            style={[
                                styles.rowAmount,
                                { color: isPayer ? '#EF4444' : '#10B981' },
                            ]}
                        >
                            {isPayer ? '-' : '+'}
                            {formatMoney(item.amount)}
                        </Text>
                    </View>
                    <View style={styles.rowBottom}>
                        <Text style={styles.rowDate}>
                            {formatDate(item.completedAt || item.createdAt)}
                        </Text>
                        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                            <Text style={[styles.statusPillText, { color: meta.color }]}>
                                {meta.label}
                            </Text>
                        </View>
                    </View>
                    {!!item.note && (
                        <Text style={styles.rowNote} numberOfLines={1}>
                            “{item.note}”
                        </Text>
                    )}
                    <View style={styles.receiptCta}>
                        <Ionicons name="document-text-outline" size={14} color="#F97316" />
                        <Text style={styles.receiptCtaText}>View receipt</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
};

const ReceiptsScreen = ({ navigation }) => {
    const { user } = useAuth();
    const myId = user?._id?.toString();

    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // all | sent | received
    const [query, setQuery] = useState('');
    const [activeReceipt, setActiveReceipt] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await listSettlements();
            setSettlements(Array.isArray(res?.data) ? res.data : []);
        } catch (err) {
            Alert.alert('Error', err?.error?.message || 'Could not load receipts');
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

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return settlements.filter((s) => {
            const isPayer = s.payer?._id?.toString() === myId;
            if (filter === 'sent' && !isPayer) return false;
            if (filter === 'received' && isPayer) return false;
            if (!q) return true;
            const other = isPayer ? s.recipient : s.payer;
            const name = (other?.fullName || other?.email || '').toLowerCase();
            const note = (s.note || '').toLowerCase();
            return name.includes(q) || note.includes(q);
        });
    }, [settlements, filter, query, myId]);

    const totals = useMemo(() => {
        let paid = 0;
        let received = 0;
        for (const s of settlements) {
            if (s.status !== 'succeeded') continue;
            if (s.payer?._id?.toString() === myId) paid += s.amount || 0;
            else received += s.amount || 0;
        }
        return { paid, received };
    }, [settlements, myId]);

    // We now render receipts in-app using the data we already have on the
    // settlement document — no dependency on Stripe's async receipt URL.
    const openReceipt = (s) => {
        setActiveReceipt(s);
    };

    // Soft-delete: prompt, then hide optimistically, then call the backend.
    // Settlements are never hard-deleted — the other party still sees theirs.
    const handleDelete = useCallback(
        (item) => {
            Alert.alert(
                'Delete Receipt',
                'Remove this receipt from your list? This only hides it for you — the other person still sees their copy.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            setSettlements((prev) => prev.filter((s) => s._id !== item._id));
                            try {
                                await deleteSettlement(item._id);
                            } catch (err) {
                                Alert.alert(
                                    'Error',
                                    err?.error?.message || 'Failed to delete receipt'
                                );
                                load();
                            }
                        },
                    },
                ]
            );
        },
        [load]
    );

    const renderItem = ({ item }) => (
        <ReceiptRow
            item={item}
            myId={myId}
            onPress={() => openReceipt(item)}
            onDelete={() => handleDelete(item)}
        />
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation?.goBack?.()}
                    style={styles.backBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={24} color="#171717" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Receipts</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Totals */}
            <View style={styles.totalsRow}>
                <View style={[styles.totalCard, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={styles.totalLabel}>You paid</Text>
                    <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                        {formatMoney(totals.paid)}
                    </Text>
                </View>
                <View style={[styles.totalCard, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={styles.totalLabel}>You received</Text>
                    <Text style={[styles.totalValue, { color: '#10B981' }]}>
                        {formatMoney(totals.received)}
                    </Text>
                </View>
            </View>

            {/* Filter pills */}
            <View style={styles.filtersRow}>
                {[
                    { id: 'all', label: 'All' },
                    { id: 'sent', label: 'Sent' },
                    { id: 'received', label: 'Received' },
                ].map((f) => (
                    <TouchableOpacity
                        key={f.id}
                        style={[styles.filterPill, filter === f.id && styles.filterPillActive]}
                        onPress={() => setFilter(f.id)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                filter === f.id && styles.filterTextActive,
                            ]}
                        >
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="#737373" />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    style={styles.searchInput}
                    placeholder="Search by name or note"
                    placeholderTextColor="#A3A3A3"
                />
                {!!query && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <Ionicons name="close-circle" size={18} color="#A3A3A3" />
                    </TouchableOpacity>
                )}
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
                            <Ionicons name="receipt-outline" size={48} color="#D4D4D4" />
                            <Text style={styles.emptyTitle}>No receipts yet</Text>
                            <Text style={styles.emptyBody}>
                                Receipts appear here every time you pay or receive a settlement.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* In-app FundFlock receipt viewer. */}
            <ReceiptDetailModal
                visible={!!activeReceipt}
                settlement={activeReceipt}
                myId={myId}
                onClose={() => setActiveReceipt(null)}
            />
        </SafeAreaView>
        </GestureHandlerRootView>
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

    totalsRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    totalCard: {
        flex: 1,
        borderRadius: 14,
        padding: 14,
    },
    totalLabel: { fontSize: 12, color: '#525252', fontWeight: '600' },
    totalValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },

    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    filterPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    filterPillActive: {
        backgroundColor: '#F97316',
        borderColor: '#F97316',
    },
    filterText: { fontSize: 13, color: '#525252', fontWeight: '600' },
    filterTextActive: { color: '#FFFFFF' },

    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#171717',
    },

    listWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
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

    swipeWrap: {
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
    },
    deleteAction: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 88,
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
    },
    deleteActionText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    row: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowMain: { flex: 1 },
    rowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#171717',
        marginRight: 8,
    },
    rowAmount: { fontSize: 15, fontWeight: '800' },
    rowBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    rowDate: { fontSize: 12, color: '#737373' },
    statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    rowNote: { marginTop: 6, fontSize: 12, color: '#525252', fontStyle: 'italic' },
    receiptCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    receiptCtaText: { color: '#F97316', fontSize: 12, fontWeight: '700' },

    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ReceiptsScreen;

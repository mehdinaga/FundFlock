// src/screens/friends/FriendDetailScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { removeFriend } from '../../api/friends';
import { getFriendExpenses } from '../../api/expenses';
import { listSettlements } from '../../api/payments';
import { useAuth } from '../../context/AuthContext';
import { ExpenseDetailModal, AddExpenseModal } from '../expenses/ExpensesScreen';

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

const formatAmount = (n) => `£${parseFloat(n || 0).toFixed(2)}`;
const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FriendDetailScreen = ({ navigation, route }) => {
    const { friend, friendshipId, balance: initialBalance = 0 } = route.params;
    const { user: currentUser } = useAuth();
    const [removing, setRemoving] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [loadingExpenses, setLoadingExpenses] = useState(true);
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);

    const loadExpenses = useCallback(async () => {
        try {
            const [expRes, setRes] = await Promise.all([
                getFriendExpenses(friend._id),
                listSettlements().catch(() => ({ data: [] })),
            ]);
            setExpenses(expRes.data || []);
            // Keep settlements between me and this friend.
            setSettlements(
                (setRes.data || []).filter((s) => {
                    if (s.status !== 'succeeded') return false;
                    const p = s.payer?._id || s.payer;
                    const r = s.recipient?._id || s.recipient;
                    return (
                        (p === currentUser?._id && r === friend._id) ||
                        (p === friend._id && r === currentUser?._id)
                    );
                })
            );
        } catch {
            setExpenses([]);
            setSettlements([]);
        } finally {
            setLoadingExpenses(false);
        }
    }, [friend._id, currentUser?._id]);

    useEffect(() => { loadExpenses(); }, [loadExpenses]);

    // Compute balance locally from the fetched expenses (Splitwise-style)
    const computedBalance = expenses.reduce((acc, exp) => {
        const payer = exp.paidBy?._id || exp.paidBy;
        const mySplit = (exp.splits || []).find(
            (s) => (s.user?._id || s.user) === currentUser?._id
        );
        const friendSplit = (exp.splits || []).find(
            (s) => (s.user?._id || s.user) === friend._id
        );
        if (payer === currentUser?._id) {
            return acc + (friendSplit?.amount || 0);
        }
        if (payer === friend._id) {
            return acc - (mySplit?.amount || 0);
        }
        return acc;
    }, 0)
    // Apply succeeded settlements — each one offsets the absolute debt.
    + settlements.reduce((acc, s) => {
        const dollars = (s.amount || 0) / 100;
        const payerId = s.payer?._id || s.payer;
        // If I paid friend: raise balance (reduces what I owe)
        // If friend paid me: lower balance (reduces what they owe)
        return payerId === currentUser?._id ? acc + dollars : acc - dollars;
    }, 0);
    const balance = loadingExpenses ? initialBalance : Math.round(computedBalance * 100) / 100;

    const balanceText = balance === 0
        ? 'All settled up'
        : balance > 0
            ? `${friend.fullName} owes you`
            : `You owe ${friend.fullName}`;
    const balanceColor = balance === 0 ? COLORS.textMuted : balance > 0 ? COLORS.success : COLORS.danger;
    const balanceAmount = balance !== 0 ? `£${Math.abs(balance).toFixed(2)}` : '';

    const handleRemoveFriend = () => {
        Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${friend.fullName} from your friends?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setRemoving(true);
                        try {
                            await removeFriend(friendshipId);
                            Alert.alert('Done', 'Friend removed successfully');
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Error', error?.error?.message || 'Failed to remove friend');
                        } finally {
                            setRemoving(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{friend.fullName}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <View style={[styles.profileAvatar, { backgroundColor: getAvatarColor(friend.fullName) }]}>
                        <Text style={styles.profileAvatarText}>
                            {getInitials(friend.fullName)}
                        </Text>
                    </View>
                    <Text style={styles.profileName}>{friend.fullName}</Text>
                    <Text style={styles.profileEmail}>{friend.email}</Text>
                </View>

                {/* Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={[styles.balanceLabel, { color: balanceColor }]}>{balanceText}</Text>
                    {balanceAmount ? (
                        <Text style={[styles.balanceAmount, { color: balanceColor }]}>{balanceAmount}</Text>
                    ) : null}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.actionButtonFilled, { flex: 1 }]}
                        activeOpacity={0.7}
                        onPress={() => setShowAddExpense(true)}
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                        <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Add expense</Text>
                    </TouchableOpacity>

                    {computedBalance < 0 && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonOutlined, { flex: 1 }]}
                            activeOpacity={0.7}
                            onPress={() =>
                                navigation.navigate('SettleUp', {
                                    friend,
                                    maxAmount: Math.abs(computedBalance),
                                })
                            }
                        >
                            <Ionicons name="card-outline" size={20} color={COLORS.primary} />
                            <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>Settle up</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Expenses Section */}
                <View style={styles.expensesSection}>
                    <Text style={styles.expensesSectionTitle}>Expenses</Text>
                    {loadingExpenses ? (
                        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                    ) : expenses.length === 0 ? (
                        <View style={styles.emptyExpenses}>
                            <Ionicons name="receipt-outline" size={40} color="#D4D4D4" />
                            <Text style={styles.emptyExpensesText}>
                                No expenses with {friend.fullName} yet
                            </Text>
                        </View>
                    ) : (
                        [...expenses].sort((a, b) => {
                            const da = new Date(a.expenseDate || a.createdAt).getTime();
                            const db = new Date(b.expenseDate || b.createdAt).getTime();
                            return db - da;
                        }).map((exp) => {
                            const payer = exp.paidBy?._id || exp.paidBy;
                            const paidByMe = payer === currentUser?._id;
                            const friendSplit = (exp.splits || []).find(
                                (s) => (s.user?._id || s.user) === friend._id
                            );
                            const mySplit = (exp.splits || []).find(
                                (s) => (s.user?._id || s.user) === currentUser?._id
                            );
                            const showAmount = paidByMe
                                ? (friendSplit?.amount || 0)
                                : (mySplit?.amount || 0);
                            const showLabel = paidByMe ? 'you lent' : 'you owe';
                            const showColor = paidByMe ? COLORS.success : COLORS.danger;
                            return (
                                <TouchableOpacity
                                    key={exp._id}
                                    style={styles.expenseItem}
                                    onPress={() => setSelectedExpense(exp)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.expenseIcon}>
                                        <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.expenseTitle} numberOfLines={1}>{exp.title}</Text>
                                        <Text style={styles.expenseMeta}>
                                            {paidByMe ? 'You paid' : `${exp.paidBy?.fullName} paid`} · {formatAmount(exp.amount)}
                                        </Text>
                                        <Text style={styles.expenseDate}>{formatDate(exp.expenseDate || exp.createdAt)}</Text>
                                    </View>
                                    {showAmount > 0 && (
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.expenseBalanceLabel, { color: showColor }]}>{showLabel}</Text>
                                            <Text style={[styles.expenseBalanceAmount, { color: showColor }]}>
                                                {formatAmount(showAmount)}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* Remove Friend */}
                <TouchableOpacity
                    style={styles.removeButton}
                    onPress={handleRemoveFriend}
                    disabled={removing}
                    activeOpacity={0.7}
                >
                    <Ionicons name="person-remove-outline" size={18} color={COLORS.danger} />
                    <Text style={styles.removeButtonText}>
                        {removing ? 'Removing...' : 'Remove friend'}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            <AddExpenseModal
                visible={showAddExpense}
                onClose={() => setShowAddExpense(false)}
                onCreated={() => { setShowAddExpense(false); loadExpenses(); }}
                currentUser={currentUser}
                prefillFriend={friend}
            />

            <ExpenseDetailModal
                expense={selectedExpense}
                visible={!!selectedExpense}
                onClose={() => setSelectedExpense(null)}
                onUpdated={() => { setSelectedExpense(null); loadExpenses(); }}
                onDeleted={() => { setSelectedExpense(null); loadExpenses(); }}
                currentUser={currentUser}
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
    content: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 32,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    profileAvatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    profileAvatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    profileName: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
    },
    profileEmail: {
        fontSize: 15,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    balanceCard: {
        marginHorizontal: 24,
        marginTop: 20,
        padding: 20,
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    balanceAmount: {
        fontSize: 28,
        fontWeight: '700',
        marginTop: 4,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 24,
        marginTop: 20,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    actionButtonFilled: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    actionButtonOutlined: {
        backgroundColor: '#FFFFFF',
        borderColor: COLORS.primary,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },
    expensesSection: {
        paddingHorizontal: 24,
        marginTop: 32,
    },
    expensesSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
    },
    emptyExpenses: {
        alignItems: 'center',
        paddingVertical: 40,
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    emptyExpensesText: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginTop: 12,
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    expenseIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 12,
    },
    expenseTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
    expenseMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
    expenseDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    expenseBalanceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    expenseBalanceAmount: { fontSize: 15, fontWeight: '700', marginTop: 2 },
    removeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 24,
        marginTop: 32,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
        backgroundColor: '#FEF2F2',
    },
    removeButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.danger,
    },
});

export default FriendDetailScreen;

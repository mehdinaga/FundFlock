// src/screens/expenses/ExpensesScreen.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, FlatList, RefreshControl, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../../context/AuthContext';
import {
    createExpense, getExpenses, updateExpense, deleteExpense
} from '../../api/expenses';
import { getGroups } from '../../api/groups';
import { searchUsers } from '../../api/users';
import { getFriends } from '../../api/friends';
import { listSettlements } from '../../api/payments';

const ORANGE = '#F97316';

// Seven top-level categories. Each has optional sub-categories so that a
// user can pick "Food & Drink → Coffee" to track spending precisely.
const CATEGORIES = [
    {
        id: 'entertainment',
        label: 'Entertainment',
        icon: 'game-controller-outline',
        color: '#8B5CF6',
        subs: [
            { id: 'movies',    label: 'Movies',       icon: 'film-outline' },
            { id: 'gaming',    label: 'Gaming',       icon: 'game-controller-outline' },
            { id: 'streaming', label: 'Streaming',    icon: 'tv-outline' },
            { id: 'events',    label: 'Concerts',     icon: 'musical-notes-outline' },
            { id: 'books',     label: 'Books',        icon: 'book-outline' },
            { id: 'sports',    label: 'Sports',       icon: 'basketball-outline' },
            { id: 'hobbies',   label: 'Hobbies',      icon: 'color-palette-outline' },
        ],
    },
    {
        id: 'food_drink',
        label: 'Food & Drink',
        icon: 'fast-food-outline',
        color: '#F97316',
        subs: [
            { id: 'groceries', label: 'Groceries', icon: 'basket-outline' },
            { id: 'dining',    label: 'Dining Out', icon: 'restaurant-outline' },
            { id: 'coffee',    label: 'Coffee',     icon: 'cafe-outline' },
            { id: 'bars',      label: 'Bars',       icon: 'wine-outline' },
            { id: 'delivery',  label: 'Delivery',   icon: 'bicycle-outline' },
            { id: 'snacks',    label: 'Snacks',     icon: 'ice-cream-outline' },
        ],
    },
    {
        id: 'home',
        label: 'Home',
        icon: 'home-outline',
        color: '#10B981',
        subs: [
            { id: 'rent',        label: 'Rent',        icon: 'key-outline' },
            { id: 'mortgage',    label: 'Mortgage',    icon: 'business-outline' },
            { id: 'furniture',   label: 'Furniture',   icon: 'bed-outline' },
            { id: 'decor',       label: 'Decor',       icon: 'leaf-outline' },
            { id: 'appliances',  label: 'Appliances',  icon: 'tv-outline' },
            { id: 'cleaning',    label: 'Cleaning',    icon: 'sparkles-outline' },
            { id: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
        ],
    },
    {
        id: 'life',
        label: 'Life',
        icon: 'heart-outline',
        color: '#EC4899',
        subs: [
            { id: 'healthcare', label: 'Healthcare', icon: 'medkit-outline' },
            { id: 'fitness',    label: 'Fitness',    icon: 'barbell-outline' },
            { id: 'personal',   label: 'Personal',   icon: 'cut-outline' },
            { id: 'clothing',   label: 'Clothing',   icon: 'shirt-outline' },
            { id: 'gifts',      label: 'Gifts',      icon: 'gift-outline' },
            { id: 'education',  label: 'Education',  icon: 'school-outline' },
            { id: 'childcare',  label: 'Childcare',  icon: 'happy-outline' },
            { id: 'pets',       label: 'Pets',       icon: 'paw-outline' },
        ],
    },
    {
        id: 'transportation',
        label: 'Transportation',
        icon: 'car-outline',
        color: '#3B82F6',
        subs: [
            { id: 'fuel',      label: 'Fuel',          icon: 'speedometer-outline' },
            { id: 'parking',   label: 'Parking',       icon: 'car-sport-outline' },
            { id: 'transit',   label: 'Public Transit', icon: 'bus-outline' },
            { id: 'rideshare', label: 'Rideshare',     icon: 'car-outline' },
            { id: 'car_maint', label: 'Car Care',      icon: 'construct-outline' },
            { id: 'flights',   label: 'Flights',       icon: 'airplane-outline' },
            { id: 'bike',      label: 'Bike',          icon: 'bicycle-outline' },
        ],
    },
    {
        id: 'utilities',
        label: 'Utilities',
        icon: 'flash-outline',
        color: '#F59E0B',
        subs: [
            { id: 'electricity', label: 'Electricity', icon: 'flash-outline' },
            { id: 'gas',         label: 'Gas',         icon: 'flame-outline' },
            { id: 'water',       label: 'Water',       icon: 'water-outline' },
            { id: 'internet',    label: 'Internet',    icon: 'wifi-outline' },
            { id: 'phone',       label: 'Phone',       icon: 'call-outline' },
            { id: 'trash',       label: 'Trash',       icon: 'trash-outline' },
        ],
    },
    {
        id: 'general',
        label: 'General',
        icon: 'ellipsis-horizontal-outline',
        color: '#737373',
        subs: [],
    },
];

// Map legacy single-word categories to the new top-level ids so old
// expenses created before this refactor still render correctly.
const LEGACY_CATEGORY_MAP = {
    food: 'food_drink',
    transport: 'transportation',
    shopping: 'general',
    health: 'life',
    travel: 'transportation',
    education: 'life',
    other: 'general',
    entertainment: 'entertainment',
    utilities: 'utilities',
};

const resolveCategory = (id) => {
    if (!id) return null;
    const direct = CATEGORIES.find((c) => c.id === id);
    if (direct) return direct;
    const mapped = LEGACY_CATEGORY_MAP[id];
    return mapped ? CATEGORIES.find((c) => c.id === mapped) : null;
};

const resolveSubcategory = (catId, subId) => {
    if (!catId || !subId) return null;
    const cat = resolveCategory(catId);
    return cat?.subs?.find((s) => s.id === subId) || null;
};
const SPLIT_TYPES = [
    { id: 'equal', label: 'Split Equally', icon: 'git-branch-outline', desc: 'Each person pays an equal share' },
    { id: 'percentage', label: 'By Percentage', icon: 'pie-chart-outline', desc: 'Specify each person\'s percentage' },
    { id: 'i_owe_full', label: 'I Owe Full', icon: 'arrow-down-circle-outline', desc: 'You owe the entire amount' },
    { id: 'they_owe_full', label: 'They Owe Full', icon: 'arrow-up-circle-outline', desc: 'The other person owes everything' },
];

const formatAmount = (n) => `£${parseFloat(n || 0).toFixed(2)}`;
const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
// Per-expense raw (historical) balance for the given user.
//  type = 'lent'   -> you paid; others owe you { amount }
//  type = 'owed'   -> someone else paid; you owe them { amount }
//  type = 'none'   -> you aren't in the split (nothing to show)
//  type = 'orphan' -> the payer user was deleted (paidBy is null).
//                     We still know your share, but there's nobody to pay.
const getUserBalance = (expense, userId) => {
    const payerId = expense.paidBy?._id || expense.paidBy || null;
    const split = (expense.splits || []).find(
        (s) => (s.user?._id || s.user) === userId
    );
    const myShare = split?.amount || 0;

    if (!payerId) {
        return { amount: myShare, type: 'orphan', payerId: null };
    }
    if (payerId === userId) {
        const totalOwedToMe = (expense.splits || [])
            .filter((s) => (s.user?._id || s.user) !== userId)
            .reduce((acc, s) => acc + (s.amount || 0), 0);
        return { amount: totalOwedToMe, type: 'lent', payerId };
    }
    if (myShare > 0) {
        return { amount: myShare, type: 'owed', payerId };
    }
    return { amount: 0, type: 'none', payerId };
};

const Avatar = ({ user, size = 36 }) => {
    const initials = (user?.fullName || user?.email || '?')
        .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
        <View style={[avatarStyles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[avatarStyles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
    );
};
const avatarStyles = StyleSheet.create({
    wrap: { backgroundColor: '#FED7AA', justifyContent: 'center', alignItems: 'center' },
    text: { color: ORANGE, fontWeight: '700' },
});

// ─── Date Picker Modal ────────────────────────────────────────────────────────
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DatePickerModal = ({ visible, onClose, value, onChange, allowClear = true }) => {
    const initial = value ? new Date(value) : new Date();
    const [viewYear, setViewYear] = useState(initial.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial.getMonth());

    React.useEffect(() => {
        if (visible) {
            const d = value ? new Date(value) : new Date();
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [visible, value]);

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const selected = value ? new Date(value) : null;

    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const goPrev = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };
    const goNext = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    const selectDay = (d) => {
        const picked = new Date(viewYear, viewMonth, d, 12, 0, 0);
        onChange(picked.toISOString());
        onClose();
    };

    const isSelected = (d) => selected &&
        selected.getFullYear() === viewYear &&
        selected.getMonth() === viewMonth &&
        selected.getDate() === d;

    const isToday = (d) =>
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === d;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={dpStyles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={dpStyles.sheet}>
                    <View style={dpStyles.monthRow}>
                        <TouchableOpacity onPress={goPrev} style={dpStyles.navBtn}>
                            <Ionicons name="chevron-back" size={20} color="#262626" />
                        </TouchableOpacity>
                        <Text style={dpStyles.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
                        <TouchableOpacity onPress={goNext} style={dpStyles.navBtn}>
                            <Ionicons name="chevron-forward" size={20} color="#262626" />
                        </TouchableOpacity>
                    </View>

                    <View style={dpStyles.weekRow}>
                        {WEEKDAY_LABELS.map((w, i) => (
                            <Text key={i} style={dpStyles.weekLabel}>{w}</Text>
                        ))}
                    </View>

                    <View style={dpStyles.grid}>
                        {cells.map((d, i) => (
                            <View key={i} style={dpStyles.cell}>
                                {d ? (
                                    <TouchableOpacity
                                        style={[
                                            dpStyles.dayBtn,
                                            isSelected(d) && dpStyles.daySelected,
                                            !isSelected(d) && isToday(d) && dpStyles.dayToday,
                                        ]}
                                        onPress={() => selectDay(d)}
                                    >
                                        <Text style={[
                                            dpStyles.dayText,
                                            isSelected(d) && dpStyles.dayTextSelected,
                                            !isSelected(d) && isToday(d) && dpStyles.dayTextToday,
                                        ]}>{d}</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ))}
                    </View>

                    <View style={dpStyles.footerRow}>
                        <TouchableOpacity
                            style={dpStyles.footerBtn}
                            onPress={() => { onChange(new Date().toISOString()); onClose(); }}
                        >
                            <Text style={dpStyles.footerBtnText}>Today</Text>
                        </TouchableOpacity>
                        {allowClear && (
                            <TouchableOpacity
                                style={dpStyles.footerBtn}
                                onPress={() => { onChange(null); onClose(); }}
                            >
                                <Text style={[dpStyles.footerBtnText, { color: '#EF4444' }]}>Clear</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={dpStyles.footerBtn} onPress={onClose}>
                            <Text style={dpStyles.footerBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const dpStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    sheet: { width: '100%', maxWidth: 380, backgroundColor: '#FFF', borderRadius: 16, padding: 16 },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    navBtn: { padding: 6 },
    monthTitle: { fontSize: 16, fontWeight: '700', color: '#171717' },
    weekRow: { flexDirection: 'row', marginBottom: 6 },
    weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#A3A3A3' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
    dayBtn: { flex: 1, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
    dayToday: { borderWidth: 1, borderColor: ORANGE },
    daySelected: { backgroundColor: ORANGE },
    dayText: { fontSize: 14, color: '#262626', fontWeight: '500' },
    dayTextToday: { color: ORANGE, fontWeight: '700' },
    dayTextSelected: { color: '#FFF', fontWeight: '700' },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
    footerBtn: { paddingVertical: 8, paddingHorizontal: 12 },
    footerBtnText: { fontSize: 14, fontWeight: '600', color: ORANGE },
});

// ─── Expense Detail / Edit Modal ──────────────────────────────────────────────
const ExpenseDetailModal = ({ expense, visible, onClose, onUpdated, onDeleted, currentUser, onPay, netDebts = [], remainingInfo = null }) => {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(expense?.title || '');
    const [amount, setAmount] = useState(expense?.amount?.toString() || '');
    const [splitType, setSplitType] = useState(expense?.splitType || 'equal');
    const [members, setMembers] = useState([]); // participants other than current user
    const [percentages, setPercentages] = useState({});
    const [paidBy, setPaidBy] = useState(null);
    const [showPayerPicker, setShowPayerPicker] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groups, setGroups] = useState([]);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [expenseDate, setExpenseDate] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [myFriends, setMyFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
        if (expense) {
            setTitle(expense.title);
            setAmount(expense.amount?.toString());
            setSplitType(expense.splitType || 'equal');
            setExpenseDate(expense.expenseDate || null);
            // Extract non-current-user participants from splits
            const others = (expense.splits || [])
                .map((s) => s.user)
                .filter((u) => u && (u._id || u) !== currentUser?._id)
                .map((u) => (typeof u === 'object' ? u : { _id: u }));
            setMembers(others);
            // Preload percentages from existing splits
            const pcts = {};
            (expense.splits || []).forEach((s) => {
                const uid = s.user?._id || s.user;
                if (s.percentage != null) pcts[uid] = String(s.percentage);
            });
            setPercentages(pcts);
            setPaidBy(expense.paidBy?._id || expense.paidBy || null);
            // Preload current group (may be a populated object, or null)
            if (expense.groupId) {
                setSelectedGroup(
                    typeof expense.groupId === 'object'
                        ? expense.groupId
                        : { _id: expense.groupId }
                );
            } else {
                setSelectedGroup(null);
            }
            setEditing(false);
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [expense, currentUser?._id]);

    // Keep paidBy valid against current editable members
    React.useEffect(() => {
        if (!editing) return;
        const memberIds = [currentUser._id, ...members.map((m) => m._id)];
        if (!memberIds.includes(paidBy)) setPaidBy(currentUser._id);
    }, [members, editing, currentUser._id]);

    React.useEffect(() => {
        if (editing) { loadFriends(); loadGroups(); }
    }, [editing]);

    const loadFriends = async () => {
        try {
            const res = await getFriends();
            const flat = (res.data?.friends || []).map((f) => f.friend).filter(Boolean);
            setMyFriends(flat);
        } catch { setMyFriends([]); }
    };

    const loadGroups = async () => {
        try {
            const res = await getGroups();
            setGroups(res.data || []);
        } catch { setGroups([]); }
    };

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const res = await searchUsers(q.trim());
            setSearchResults(res.data || []);
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    };

    const addMember = (user) => {
        if (!user || user._id === currentUser?._id) return;
        if (members.find((m) => m._id === user._id)) return;
        setMembers([...members, user]);
        setPercentages((prev) => ({ ...prev, [user._id]: '' }));
        setSearchQuery(''); setSearchResults([]);
    };

    const removeMember = (userId) => {
        setMembers(members.filter((m) => m._id !== userId));
        setPercentages((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    };

    const buildSplits = () => {
        const all = [{ _id: currentUser._id, ...currentUser }, ...members];
        const total = parseFloat(amount);
        if (splitType === 'equal') {
            const share = total / all.length;
            return all.map((m) => ({ user: m._id, amount: parseFloat(share.toFixed(2)) }));
        }
        if (splitType === 'percentage') {
            return all.map((m) => {
                const pct = parseFloat(percentages[m._id] || 0);
                return { user: m._id, amount: parseFloat(((pct / 100) * total).toFixed(2)), percentage: pct };
            });
        }
        if (splitType === 'i_owe_full') {
            return [
                { user: currentUser._id, amount: total },
                ...members.map((m) => ({ user: m._id, amount: 0 }))
            ];
        }
        if (splitType === 'they_owe_full') {
            const share = members.length > 0 ? total / members.length : total;
            return [
                { user: currentUser._id, amount: 0 },
                ...members.map((m) => ({ user: m._id, amount: parseFloat(share.toFixed(2)) }))
            ];
        }
        return [];
    };

    if (!expense) return null;

    const handleSave = async () => {
        if (!title.trim()) return Alert.alert('Error', 'Title is required');
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) return Alert.alert('Error', 'Enter a valid amount');
        if (members.length === 0 && splitType !== 'i_owe_full') {
            return Alert.alert('Error', 'At least one other person is required');
        }
        if (splitType === 'percentage') {
            const allIds = [currentUser._id, ...members.map((m) => m._id)];
            const sum = allIds.reduce((acc, id) => acc + (parseFloat(percentages[id]) || 0), 0);
            if (Math.round(sum) !== 100) {
                return Alert.alert('Error', `Percentages must add up to 100 (current: ${sum})`);
            }
        }
        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                amount: amt,
                splitType,
                splits: buildSplits(),
                members: [currentUser._id, ...members.map((m) => m._id)],
                paidBy: paidBy || currentUser._id,
                groupId: selectedGroup?._id || null,
                expenseDate: expenseDate,
            };
            const res = await updateExpense(expense._id, payload);
            onUpdated(res.data);
            setEditing(false);
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete Expense', `Delete "${expense.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteExpense(expense._id);
                        onDeleted(expense._id);
                        onClose();
                    } catch (e) {
                        Alert.alert('Error', e.error?.message || 'Delete failed');
                    }
                }
            }
        ]);
    };

    const isPayer = (expense.paidBy?._id || expense.paidBy) === currentUser?._id;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={detailStyles.container}>
                <View style={detailStyles.header}>
                    <TouchableOpacity onPress={onClose} style={detailStyles.closeBtn}>
                        <Ionicons name="close" size={24} color="#262626" />
                    </TouchableOpacity>
                    <Text style={detailStyles.headerTitle}>Expense Details</Text>
                    <TouchableOpacity onPress={() => setEditing(!editing)} style={detailStyles.editBtn}>
                        <Ionicons name={editing ? 'close-circle-outline' : 'create-outline'} size={22} color={ORANGE} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={detailStyles.body}>
                    {editing ? (
                        <>
                            {expense.category && (
                                <View style={detailStyles.badge}>
                                    <Text style={detailStyles.badgeText}>{expense.category.toUpperCase()}</Text>
                                </View>
                            )}
                            <TextInput
                                style={detailStyles.titleInput}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Expense title"
                                placeholderTextColor="#A3A3A3"
                            />
                            <View style={detailStyles.amountRow}>
                                <Text style={detailStyles.currencySign}>£</Text>
                                <TextInput
                                    style={detailStyles.amountInput}
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="decimal-pad"
                                    placeholder="0.00"
                                    placeholderTextColor="#A3A3A3"
                                />
                            </View>
                            <TouchableOpacity
                                style={detailStyles.dateEditBtn}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={16} color="#737373" />
                                <Text style={detailStyles.dateEditText}>
                                    {expenseDate ? formatDate(expenseDate) : 'Pick a date (default: created)'}
                                </Text>
                                <Ionicons name="chevron-down-outline" size={16} color="#A3A3A3" />
                            </TouchableOpacity>
                        </>
                    ) : (() => {
                        const cat = resolveCategory(expense.category);
                        const sub = resolveSubcategory(expense.category, expense.subcategory);
                        const balance = getUserBalance(expense, currentUser?._id);
                        // Normalise payer into an object that always has _id so
                        // downstream lookups (netDebts, payer picker) work even when
                        // expense.paidBy is a raw ID string.
                        const payerObj =
                            expense.paidBy && typeof expense.paidBy === 'object'
                                ? expense.paidBy
                                : expense.paidBy
                                    ? { _id: expense.paidBy }
                                    : null;
                        const payerId = balance.payerId;
                        return (
                            <>
                                {/* Hero card */}
                                <View style={detailStyles.hero}>
                                    <View style={detailStyles.heroIcon}>
                                        <Ionicons
                                            name={cat?.icon || 'receipt-outline'}
                                            size={28}
                                            color={ORANGE}
                                        />
                                    </View>
                                    {expense.category && (
                                        <View style={detailStyles.heroBadge}>
                                            <Text style={detailStyles.heroBadgeText}>
                                                {cat?.label || expense.category}
                                                {sub ? ` · ${sub.label}` : ''}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={detailStyles.heroTitle} numberOfLines={2}>
                                        {expense.title}
                                    </Text>
                                    <Text style={detailStyles.heroAmount}>
                                        {formatAmount(expense.amount)}
                                    </Text>
                                    <View style={detailStyles.heroDateRow}>
                                        <Ionicons name="calendar-outline" size={13} color="#A3A3A3" />
                                        <Text style={detailStyles.heroDate}>
                                            {formatDate(expense.expenseDate || expense.createdAt)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Your share card */}
                                {balance.amount > 0.004 && balance.type !== 'none' && (() => {
                                    // Prefer per-expense FIFO remaining (source of truth that
                                    // matches the list cards). Fall back to raw share when
                                    // we don't have it yet.
                                    const isOrphan = balance.type === 'orphan';
                                    const original = remainingInfo?.original ?? balance.amount;
                                    const remaining = remainingInfo?.remaining ?? balance.amount;
                                    const payable = Math.max(0, remaining);
                                    const settled =
                                        balance.type === 'owed'
                                        && payable <= 0.004
                                        && !isOrphan
                                        && original > 0.004;

                                    return (
                                        <View style={[
                                            detailStyles.yourShare,
                                            settled
                                                ? detailStyles.yourShareSettled
                                                : balance.type === 'lent'
                                                    ? detailStyles.yourShareLent
                                                    : detailStyles.yourShareOwed,
                                        ]}>
                                            <View style={detailStyles.yourShareRow}>
                                                <View style={detailStyles.yourShareIconWrap}>
                                                    <Ionicons
                                                        name={
                                                            settled
                                                                ? 'checkmark-circle'
                                                                : balance.type === 'lent'
                                                                    ? 'arrow-down-circle'
                                                                    : 'arrow-up-circle'
                                                        }
                                                        size={22}
                                                        color={
                                                            settled
                                                                ? '#10B981'
                                                                : balance.type === 'lent'
                                                                    ? '#10B981'
                                                                    : '#EF4444'
                                                        }
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={detailStyles.yourShareLabel}>
                                                        {isOrphan
                                                            ? 'Your share'
                                                            : settled
                                                                ? 'Settled'
                                                                : balance.type === 'lent'
                                                                    ? 'You are owed'
                                                                    : 'You owe'}
                                                    </Text>
                                                    <Text style={detailStyles.yourShareHint}>
                                                        {isOrphan
                                                            ? 'Payer account no longer exists'
                                                            : settled
                                                                ? 'You have paid this off'
                                                                : balance.type === 'lent'
                                                                    ? 'Others will settle with you'
                                                                    : `Pay ${payerObj?.fullName || 'payer'} to clear`}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={[
                                                        detailStyles.yourShareAmount,
                                                        {
                                                            color: settled
                                                                ? '#10B981'
                                                                : balance.type === 'lent'
                                                                    ? '#10B981'
                                                                    : '#EF4444',
                                                            textDecorationLine: settled ? 'line-through' : 'none',
                                                        }
                                                    ]}>
                                                        {formatAmount(settled ? original : remaining)}
                                                    </Text>
                                                    {remaining < original - 0.004 && !settled && (
                                                        <Text style={detailStyles.yourShareOrig}>
                                                            of {formatAmount(original)}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Pay button — only when there's something payable
                                                AND we have a valid payer to send money to */}
                                            {balance.type === 'owed'
                                                && !settled
                                                && !isOrphan
                                                && payable > 0.004
                                                && payerObj
                                                && onPay && (
                                                <TouchableOpacity
                                                    style={detailStyles.payBtn}
                                                    activeOpacity={0.85}
                                                    onPress={() => {
                                                        onClose();
                                                        setTimeout(() => onPay(payerObj, payable), 250);
                                                    }}
                                                >
                                                    <Ionicons name="card" size={18} color="#FFF" />
                                                    <Text style={detailStyles.payBtnText}>
                                                        Pay {formatAmount(payable)}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })()}
                            </>
                        );
                    })()}

                    <View style={detailStyles.section}>
                        <Text style={detailStyles.sectionLabel}>Paid by</Text>
                        {editing ? (() => {
                            const allMembers = [currentUser, ...members];
                            const payerObj = allMembers.find((m) => m._id === paidBy) || currentUser;
                            const isMe = payerObj._id === currentUser._id;
                            return (
                                <TouchableOpacity
                                    style={detailStyles.payerSelector}
                                    onPress={() => setShowPayerPicker(true)}
                                >
                                    <Avatar user={payerObj} size={32} />
                                    <Text style={[detailStyles.memberName, { flex: 1 }]}>
                                        {isMe ? 'You' : (payerObj.fullName || payerObj.email)}
                                    </Text>
                                    <Ionicons name="chevron-down-outline" size={18} color="#A3A3A3" />
                                </TouchableOpacity>
                            );
                        })() : (
                            <View style={detailStyles.paidByCard}>
                                <Avatar user={expense.paidBy} size={40} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={detailStyles.paidByName}>
                                        {expense.paidBy?.fullName || 'Unknown'}
                                        {isPayer ? ' (You)' : ''}
                                    </Text>
                                    <Text style={detailStyles.paidBySub}>
                                        Paid {formatAmount(expense.amount)}
                                    </Text>
                                </View>
                                <View style={detailStyles.paidByIconWrap}>
                                    <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={detailStyles.section}>
                        <Text style={detailStyles.sectionLabel}>Split</Text>
                        {editing ? (
                            <>
                                <View style={detailStyles.splitTypeGrid}>
                                    {SPLIT_TYPES.map((st) => {
                                        const active = splitType === st.id;
                                        return (
                                            <TouchableOpacity
                                                key={st.id}
                                                style={[detailStyles.splitTypeChip, active && detailStyles.splitTypeChipActive]}
                                                onPress={() => setSplitType(st.id)}
                                            >
                                                <Ionicons name={st.icon} size={16} color={active ? '#FFF' : ORANGE} />
                                                <Text style={[detailStyles.splitTypeChipText, active && { color: '#FFF' }]}>
                                                    {st.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={[detailStyles.sectionLabel, { marginTop: 16 }]}>People</Text>
                                <View style={detailStyles.splitRow}>
                                    <Avatar user={currentUser} size={28} />
                                    <Text style={detailStyles.splitName}>You</Text>
                                    {splitType === 'percentage' && (
                                        <TextInput
                                            style={detailStyles.pctInput}
                                            value={percentages[currentUser._id] || ''}
                                            onChangeText={(v) => setPercentages({ ...percentages, [currentUser._id]: v })}
                                            keyboardType="decimal-pad"
                                            placeholder="%"
                                        />
                                    )}
                                </View>
                                {members.map((m) => (
                                    <View key={m._id} style={detailStyles.splitRow}>
                                        <Avatar user={m} size={28} />
                                        <Text style={detailStyles.splitName}>{m.fullName || m.email}</Text>
                                        {splitType === 'percentage' && (
                                            <TextInput
                                                style={detailStyles.pctInput}
                                                value={percentages[m._id] || ''}
                                                onChangeText={(v) => setPercentages({ ...percentages, [m._id]: v })}
                                                keyboardType="decimal-pad"
                                                placeholder="%"
                                            />
                                        )}
                                        <TouchableOpacity onPress={() => removeMember(m._id)} style={{ marginLeft: 8 }}>
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {myFriends.filter((f) => !members.find((m) => m._id === f._id)).length > 0 && (
                                    <>
                                        <Text style={[detailStyles.sectionLabel, { marginTop: 12 }]}>Add from friends</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                                            {myFriends
                                                .filter((f) => !members.find((m) => m._id === f._id))
                                                .map((f) => (
                                                    <TouchableOpacity
                                                        key={f._id}
                                                        style={detailStyles.friendChip}
                                                        onPress={() => addMember(f)}
                                                    >
                                                        <Avatar user={f} size={24} />
                                                        <Text style={detailStyles.friendChipText} numberOfLines={1}>
                                                            {f.fullName || f.email}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                        </ScrollView>
                                    </>
                                )}

                                <TextInput
                                    style={detailStyles.searchInput}
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    placeholder="Search people to add..."
                                    placeholderTextColor="#A3A3A3"
                                />
                                {searching && <ActivityIndicator color={ORANGE} style={{ marginVertical: 8 }} />}
                                {searchResults.filter((u) => u._id !== currentUser._id && !members.find((m) => m._id === u._id))
                                    .map((u) => (
                                        <TouchableOpacity
                                            key={u._id}
                                            style={detailStyles.searchResult}
                                            onPress={() => addMember(u)}
                                        >
                                            <Avatar user={u} size={28} />
                                            <Text style={detailStyles.splitName}>{u.fullName || u.email}</Text>
                                            <Ionicons name="add-circle" size={20} color={ORANGE} />
                                        </TouchableOpacity>
                                    ))}
                            </>
                        ) : (() => {
                            const splitLabel = SPLIT_TYPES.find((s) => s.id === expense.splitType);
                            const payerId = expense.paidBy?._id || expense.paidBy;
                            return (
                                <>
                                    <View style={detailStyles.splitTypePill}>
                                        <Ionicons
                                            name={splitLabel?.icon || 'git-branch-outline'}
                                            size={14}
                                            color={ORANGE}
                                        />
                                        <Text style={detailStyles.splitTypePillText}>
                                            {splitLabel?.label || expense.splitType}
                                        </Text>
                                    </View>
                                    <View style={detailStyles.splitBreakdown}>
                                        {(expense.splits || []).map((s, i) => {
                                            const sUid = s.user?._id || s.user;
                                            const isSelf = sUid === currentUser?._id;
                                            const isPayerRow = sUid === payerId;
                                            return (
                                                <View
                                                    key={i}
                                                    style={[
                                                        detailStyles.breakdownRow,
                                                        i === (expense.splits.length - 1) && { borderBottomWidth: 0 },
                                                    ]}
                                                >
                                                    <Avatar user={s.user} size={32} />
                                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                                        <Text style={detailStyles.breakdownName}>
                                                            {isSelf ? 'You' : (s.user?.fullName || 'Unknown')}
                                                        </Text>
                                                        <Text style={detailStyles.breakdownSub}>
                                                            {isPayerRow ? 'Paid in full' : (s.amount > 0 ? 'Owes this amount' : 'No share')}
                                                        </Text>
                                                    </View>
                                                    <Text style={[
                                                        detailStyles.breakdownAmount,
                                                        isPayerRow && { color: '#10B981' },
                                                    ]}>
                                                        {formatAmount(s.amount)}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </>
                            );
                        })()}
                    </View>

                    {editing ? (
                        <View style={detailStyles.section}>
                            <Text style={detailStyles.sectionLabel}>Group</Text>
                            <TouchableOpacity
                                style={detailStyles.payerSelector}
                                onPress={() => setShowGroupPicker(true)}
                            >
                                <Ionicons name="people-outline" size={18} color="#737373" />
                                <Text style={[detailStyles.memberName, { flex: 1 }, !selectedGroup && { color: '#A3A3A3' }]}>
                                    {selectedGroup?.name || 'No group (personal)'}
                                </Text>
                                {selectedGroup && (
                                    <TouchableOpacity onPress={() => setSelectedGroup(null)} style={{ marginRight: 8 }}>
                                        <Ionicons name="close-circle" size={18} color="#A3A3A3" />
                                    </TouchableOpacity>
                                )}
                                <Ionicons name="chevron-down-outline" size={16} color="#A3A3A3" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        expense.groupId && (
                            <View style={detailStyles.section}>
                                <Text style={detailStyles.sectionLabel}>Group</Text>
                                <View style={detailStyles.groupCard}>
                                    <View style={detailStyles.groupCardIcon}>
                                        <Ionicons name="people-outline" size={18} color={ORANGE} />
                                    </View>
                                    <Text style={detailStyles.groupCardName}>
                                        {expense.groupId?.name || 'Group'}
                                    </Text>
                                </View>
                            </View>
                        )
                    )}

                    {editing && (
                        <TouchableOpacity
                            style={[detailStyles.saveBtn, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#FFF" /> : <Text style={detailStyles.saveBtnText}>Save Changes</Text>}
                        </TouchableOpacity>
                    )}

                    {isPayer && (
                        <TouchableOpacity style={detailStyles.deleteBtn} onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            <Text style={detailStyles.deleteBtnText}>Delete Expense</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>

                <Modal visible={showPayerPicker} transparent animationType="fade" onRequestClose={() => setShowPayerPicker(false)}>
                    <TouchableOpacity style={pickerStyles.overlay} onPress={() => setShowPayerPicker(false)}>
                        <View style={pickerStyles.sheet}>
                            <Text style={pickerStyles.sheetTitle}>Who Paid?</Text>
                            {[currentUser, ...members].map((m) => {
                                const isMe = m._id === currentUser._id;
                                const selected = paidBy === m._id;
                                return (
                                    <TouchableOpacity
                                        key={m._id}
                                        style={pickerStyles.groupItem}
                                        onPress={() => { setPaidBy(m._id); setShowPayerPicker(false); }}
                                    >
                                        <Avatar user={m} size={32} />
                                        <Text style={[pickerStyles.groupName, { marginLeft: 10, flex: 1 }]}>
                                            {isMe ? 'You' : (m.fullName || m.email)}
                                        </Text>
                                        {selected && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </TouchableOpacity>
                </Modal>

                <Modal visible={showGroupPicker} transparent animationType="fade" onRequestClose={() => setShowGroupPicker(false)}>
                    <TouchableOpacity style={pickerStyles.overlay} onPress={() => setShowGroupPicker(false)}>
                        <View style={pickerStyles.sheet}>
                            <Text style={pickerStyles.sheetTitle}>Select Group</Text>
                            <TouchableOpacity
                                style={pickerStyles.groupItem}
                                onPress={() => { setSelectedGroup(null); setShowGroupPicker(false); }}
                            >
                                <View style={pickerStyles.groupIcon}>
                                    <Ionicons name="person-outline" size={18} color={ORANGE} />
                                </View>
                                <Text style={[pickerStyles.groupName, { flex: 1 }]}>No group (personal)</Text>
                                {!selectedGroup && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                            </TouchableOpacity>
                            {groups.length === 0 ? (
                                <Text style={pickerStyles.emptyText}>No groups yet</Text>
                            ) : (
                                groups.map((g) => (
                                    <TouchableOpacity
                                        key={g._id}
                                        style={pickerStyles.groupItem}
                                        onPress={() => { setSelectedGroup(g); setShowGroupPicker(false); }}
                                    >
                                        <View style={pickerStyles.groupIcon}>
                                            <Ionicons name="people-outline" size={18} color={ORANGE} />
                                        </View>
                                        <Text style={[pickerStyles.groupName, { flex: 1 }]}>{g.name}</Text>
                                        {selectedGroup?._id === g._id && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    </TouchableOpacity>
                </Modal>

                <DatePickerModal
                    visible={showDatePicker}
                    value={expenseDate}
                    onChange={setExpenseDate}
                    onClose={() => setShowDatePicker(false)}
                />
            </View>
        </Modal>
    );
};

const detailStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    closeBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
    editBtn: { padding: 4 },
    body: { padding: 24 },
    badge: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
    badgeText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
    title: { fontSize: 24, fontWeight: '700', color: '#171717', marginBottom: 8 },
    titleInput: { fontSize: 22, fontWeight: '700', color: '#171717', marginBottom: 8, borderBottomWidth: 2, borderBottomColor: ORANGE, paddingBottom: 4 },
    amount: { fontSize: 36, fontWeight: '800', color: ORANGE, marginBottom: 4 },
    amountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    currencySign: { fontSize: 28, fontWeight: '800', color: ORANGE, marginRight: 4 },
    amountInput: { fontSize: 32, fontWeight: '800', color: ORANGE, borderBottomWidth: 2, borderBottomColor: ORANGE, flex: 1, paddingBottom: 4 },
    date: { fontSize: 13, color: '#A3A3A3', marginBottom: 24 },
    dateEditBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 10, borderWidth: 1, borderColor: '#E5E5E5',
        backgroundColor: '#FAFAFA',
        marginBottom: 24,
    },
    dateEditText: { fontSize: 13, color: '#525252', fontWeight: '500' },
    section: { marginBottom: 20 },
    sectionLabel: { fontSize: 12, fontWeight: '600', color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    memberRow: { flexDirection: 'row', alignItems: 'center' },
    memberName: { fontSize: 15, fontWeight: '500', color: '#262626', marginLeft: 10 },
    payerSelector: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 8,
    },
    splitTypeLabel: { fontSize: 14, fontWeight: '600', color: '#262626', marginBottom: 10 },
    splitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    splitName: { flex: 1, fontSize: 14, color: '#525252', marginLeft: 8 },
    splitAmount: { fontSize: 14, fontWeight: '700', color: '#262626' },
    groupName: { fontSize: 15, fontWeight: '600', color: '#262626' },
    saveBtn: { backgroundColor: ORANGE, borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 16, marginBottom: 12 },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    deleteBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '600', marginLeft: 6 },
    splitTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    splitTypeChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: ORANGE,
        backgroundColor: '#FFF', marginRight: 8, marginBottom: 8
    },
    splitTypeChipActive: { backgroundColor: ORANGE },
    splitTypeChipText: { fontSize: 12, fontWeight: '600', color: ORANGE, marginLeft: 6 },
    pctInput: {
        width: 60, borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 4, textAlign: 'right', marginLeft: 8, color: '#171717'
    },
    friendChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 20, backgroundColor: '#FFF7ED', marginRight: 8
    },
    friendChipText: { fontSize: 12, fontWeight: '600', color: '#262626', marginLeft: 6, maxWidth: 100 },
    searchInput: {
        borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10,
        fontSize: 14, color: '#171717', marginTop: 8
    },
    searchResult: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 8,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },

    // Hero card
    hero: {
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderRadius: 20,
        paddingVertical: 24, paddingHorizontal: 20,
        marginBottom: 16,
        borderWidth: 1, borderColor: '#FED7AA',
    },
    heroIcon: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 10,
        shadowColor: ORANGE, shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
    },
    heroBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 10,
        marginBottom: 8,
    },
    heroBadgeText: { fontSize: 11, fontWeight: '700', color: '#D97706', letterSpacing: 0.3 },
    heroTitle: {
        fontSize: 20, fontWeight: '700',
        color: '#171717', textAlign: 'center',
        marginBottom: 6,
    },
    heroAmount: {
        fontSize: 38, fontWeight: '800',
        color: ORANGE, marginBottom: 6,
    },
    heroDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    heroDate: { fontSize: 12, color: '#737373', fontWeight: '500' },

    // Your share card
    yourShare: {
        borderRadius: 16, padding: 14,
        marginBottom: 18,
        borderWidth: 1,
    },
    yourShareLent: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
    yourShareOwed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    yourShareSettled: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
    yourShareRow: { flexDirection: 'row', alignItems: 'center' },
    yourShareIconWrap: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 12,
    },
    yourShareLabel: { fontSize: 13, fontWeight: '700', color: '#171717' },
    yourShareHint: { fontSize: 12, color: '#737373', marginTop: 2 },
    yourShareAmount: { fontSize: 20, fontWeight: '800' },
    yourShareOrig: { fontSize: 11, color: '#A3A3A3', marginTop: 2 },
    payBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: ORANGE,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 12,
        shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
    },
    payBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

    // Paid by card
    paidByCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: '#F0F0F0',
    },
    paidByName: { fontSize: 15, fontWeight: '700', color: '#171717' },
    paidBySub: { fontSize: 12, color: '#737373', marginTop: 2 },
    paidByIconWrap: { marginLeft: 8 },

    // Split breakdown
    splitTypePill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        borderWidth: 1, borderColor: '#FED7AA',
        marginBottom: 10,
    },
    splitTypePillText: { fontSize: 12, fontWeight: '700', color: ORANGE },
    splitBreakdown: {
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1, borderColor: '#F0F0F0',
    },
    breakdownRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    breakdownName: { fontSize: 14, fontWeight: '600', color: '#171717' },
    breakdownSub: { fontSize: 11, color: '#A3A3A3', marginTop: 2 },
    breakdownAmount: { fontSize: 14, fontWeight: '700', color: '#262626' },

    // Group card
    groupCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: '#F0F0F0',
    },
    groupCardIcon: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 10,
    },
    groupCardName: { fontSize: 15, fontWeight: '600', color: '#262626' },
});

// ─── Add Expense Modal ────────────────────────────────────────────────────────
const AddExpenseModal = ({ visible, onClose, onCreated, currentUser, prefillFriend, prefillGroup }) => {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState(null);
    const [subcategory, setSubcategory] = useState(null);
    const [splitType, setSplitType] = useState('equal');
    const [friends, setFriends] = useState([]);
    const [percentages, setPercentages] = useState({});
    const [paidBy, setPaidBy] = useState(currentUser?._id); // user id of payer
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [showPayerPicker, setShowPayerPicker] = useState(false);
    const [expenseDate, setExpenseDate] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [myFriends, setMyFriends] = useState([]);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    React.useEffect(() => {
        if (visible) {
            loadGroups();
            loadFriends();
            setTitle(''); setAmount(''); setCategory(null); setSubcategory(null); setSplitType('equal');

            // If a group is prefilled, preselect it and auto-include its members
            if (prefillGroup) {
                const groupMemberUsers = (prefillGroup.members || [])
                    .map((m) => m.user || m)
                    .filter((u) => u && u._id && u._id !== currentUser?._id);
                setFriends(groupMemberUsers);
                const pcts = {};
                groupMemberUsers.forEach((u) => { pcts[u._id] = ''; });
                setPercentages(pcts);
                setSelectedGroup(prefillGroup);
            } else {
                setFriends(prefillFriend ? [prefillFriend] : []);
                setPercentages(prefillFriend ? { [prefillFriend._id]: '' } : {});
                setSelectedGroup(null);
            }

            setPaidBy(currentUser?._id);
            setSearchQuery('');
            setSearchResults([]); setErrors({});
            setExpenseDate(null);
        }
    }, [visible, prefillFriend, prefillGroup, currentUser?._id]);

    const loadGroups = async () => {
        try {
            const res = await getGroups();
            setGroups(res.data || []);
        } catch { setGroups([]); }
    };

    const loadFriends = async () => {
        try {
            const res = await getFriends();
            // friendController returns { data: { friends: [{ friend: {_id, fullName, email, avatar}, ... }] } }
            const flat = (res.data?.friends || []).map((f) => f.friend).filter(Boolean);
            setMyFriends(flat);
        } catch { setMyFriends([]); }
    };

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const res = await searchUsers(q.trim());
            setSearchResults(res.data || []);
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    };

    const addFriend = (user) => {
        if (friends.find((f) => f._id === user._id)) return;
        setFriends([...friends, user]);
        setPercentages((prev) => ({ ...prev, [user._id]: '' }));
        setSearchQuery(''); setSearchResults([]);
    };

    const removeFriend = (userId) => {
        setFriends(friends.filter((f) => f._id !== userId));
        setPercentages((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    };

    const buildSplits = () => {
        const allMembers = [{ _id: currentUser._id, ...currentUser }, ...friends];
        const total = parseFloat(amount);
        if (splitType === 'equal') {
            const share = total / allMembers.length;
            return allMembers.map((m) => ({ user: m._id, amount: parseFloat(share.toFixed(2)) }));
        }
        if (splitType === 'percentage') {
            return allMembers.map((m) => {
                const pct = parseFloat(percentages[m._id] || 0);
                return { user: m._id, amount: parseFloat(((pct / 100) * total).toFixed(2)), percentage: pct };
            });
        }
        if (splitType === 'i_owe_full') {
            return [
                { user: currentUser._id, amount: total },
                ...friends.map((f) => ({ user: f._id, amount: 0 }))
            ];
        }
        if (splitType === 'they_owe_full') {
            const share = friends.length > 0 ? total / friends.length : total;
            return [
                { user: currentUser._id, amount: 0 },
                ...friends.map((f) => ({ user: f._id, amount: parseFloat(share.toFixed(2)) }))
            ];
        }
        return [];
    };

    const validate = () => {
        const errs = {};
        if (!title.trim()) errs.title = 'Title is required';
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount';
        if (splitType === 'percentage') {
            const allMembers = [currentUser, ...friends];
            const total = allMembers.reduce((acc, m) => acc + parseFloat(percentages[m._id] || 0), 0);
            if (Math.abs(total - 100) > 0.01) errs.percentage = 'Percentages must add up to 100%';
        }
        if (friends.length === 0) errs.friends = 'Add at least one person to share with';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const splits = buildSplits();
            const payload = {
                title: title.trim(),
                amount: parseFloat(amount),
                category: category || undefined,
                subcategory: subcategory || undefined,
                splitType,
                splits,
                members: [currentUser._id, ...friends.map((f) => f._id)],
                paidBy,
                groupId: selectedGroup?._id || undefined,
                expenseDate: expenseDate || undefined,
            };
            const res = await createExpense(payload);
            onCreated(res.data);
            onClose();
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Failed to create expense');
        } finally {
            setSaving(false);
        }
    };

    // Keep payer valid: if the selected payer is removed from members, fall back to current user
    React.useEffect(() => {
        const memberIds = [currentUser._id, ...friends.map((f) => f._id)];
        if (!memberIds.includes(paidBy)) setPaidBy(currentUser._id);
    }, [friends, currentUser._id]);

    const payerObj = paidBy === currentUser._id
        ? currentUser
        : friends.find((f) => f._id === paidBy) || currentUser;

    const allPercentageMembers = [currentUser, ...friends];
    const percentageTotal = allPercentageMembers.reduce(
        (acc, m) => acc + parseFloat(percentages[m._id] || 0), 0
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={addStyles.container}>
                    <View style={addStyles.header}>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#262626" />
                        </TouchableOpacity>
                        <Text style={addStyles.headerTitle}>Add Expense</Text>
                        <TouchableOpacity
                            onPress={handleCreate}
                            disabled={saving}
                            style={[addStyles.saveHeaderBtn, saving && { opacity: 0.5 }]}
                        >
                            {saving
                                ? <ActivityIndicator color={ORANGE} size="small" />
                                : <Text style={addStyles.saveHeaderBtnText}>Save</Text>}
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={addStyles.body} keyboardShouldPersistTaps="handled">
                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Expense Name *</Text>
                            <View style={[addStyles.inputWrap, errors.title && addStyles.inputError]}>
                                <Ionicons name="receipt-outline" size={18} color="#A3A3A3" style={addStyles.inputIcon} />
                                <TextInput
                                    style={addStyles.input}
                                    placeholder="e.g. Dinner at Mario's"
                                    placeholderTextColor="#A3A3A3"
                                    value={title}
                                    onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: null })); }}
                                />
                            </View>
                            {errors.title && <Text style={addStyles.errorText}>{errors.title}</Text>}
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Amount *</Text>
                            <View style={[addStyles.inputWrap, errors.amount && addStyles.inputError]}>
                                <Text style={addStyles.currencyPrefix}>£</Text>
                                <TextInput
                                    style={addStyles.input}
                                    placeholder="0.00"
                                    placeholderTextColor="#A3A3A3"
                                    value={amount}
                                    onChangeText={(t) => { setAmount(t); setErrors((e) => ({ ...e, amount: null })); }}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                            {errors.amount && <Text style={addStyles.errorText}>{errors.amount}</Text>}
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Category <Text style={addStyles.optional}>(optional)</Text></Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                                {CATEGORIES.map((cat) => {
                                    const active = category === cat.id;
                                    return (
                                        <TouchableOpacity
                                            key={cat.id}
                                            onPress={() => {
                                                if (active) {
                                                    setCategory(null);
                                                    setSubcategory(null);
                                                } else {
                                                    setCategory(cat.id);
                                                    setSubcategory(null);
                                                }
                                            }}
                                            style={[
                                                addStyles.catChip,
                                                active && { backgroundColor: cat.color, borderColor: cat.color },
                                            ]}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name={cat.icon} size={16} color={active ? '#FFF' : cat.color} />
                                            <Text style={[addStyles.catChipText, active && addStyles.catChipTextActive]}>
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Subcategory picker — appears only once a top-level is chosen
                                and that category has sub-options. */}
                            {category && (resolveCategory(category)?.subs?.length > 0) && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={{ marginTop: 8, marginHorizontal: -4 }}
                                >
                                    {resolveCategory(category).subs.map((sub) => {
                                        const active = subcategory === sub.id;
                                        const accent = resolveCategory(category).color;
                                        return (
                                            <TouchableOpacity
                                                key={sub.id}
                                                onPress={() =>
                                                    setSubcategory(active ? null : sub.id)
                                                }
                                                style={[
                                                    addStyles.subChip,
                                                    active && { backgroundColor: `${accent}15`, borderColor: accent },
                                                ]}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name={sub.icon} size={14} color={active ? accent : '#737373'} />
                                                <Text style={[addStyles.subChipText, active && { color: accent, fontWeight: '700' }]}>
                                                    {sub.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Date <Text style={addStyles.optional}>(optional — defaults to today)</Text></Text>
                            <TouchableOpacity
                                style={addStyles.inputWrap}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="calendar-outline" size={18} color="#A3A3A3" style={addStyles.inputIcon} />
                                <Text style={[addStyles.input, !expenseDate && { color: '#A3A3A3' }]}>
                                    {expenseDate ? formatDate(expenseDate) : 'Today'}
                                </Text>
                                {expenseDate && (
                                    <TouchableOpacity onPress={() => setExpenseDate(null)} style={{ paddingHorizontal: 8 }}>
                                        <Ionicons name="close-circle" size={18} color="#A3A3A3" />
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Share with *</Text>
                            {errors.friends && <Text style={addStyles.errorText}>{errors.friends}</Text>}

                            {friends.length > 0 && (
                                <View style={addStyles.friendList}>
                                    {friends.map((f) => (
                                        <View key={f._id} style={addStyles.friendChip}>
                                            <Avatar user={f} size={24} />
                                            <Text style={addStyles.friendChipName}>{f.fullName}</Text>
                                            <TouchableOpacity onPress={() => removeFriend(f._id)}>
                                                <Ionicons name="close-circle" size={18} color="#A3A3A3" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {myFriends.length > 0 && (
                                <View style={addStyles.myFriendsWrap}>
                                    <Text style={addStyles.myFriendsLabel}>Your Friends</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={addStyles.myFriendsRow}
                                    >
                                        {myFriends.map((f) => {
                                            const selected = !!friends.find((x) => x._id === f._id);
                                            return (
                                                <TouchableOpacity
                                                    key={f._id}
                                                    style={[addStyles.myFriendItem, selected && addStyles.myFriendItemActive]}
                                                    onPress={() => selected ? removeFriend(f._id) : addFriend(f)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View>
                                                        <Avatar user={f} size={48} />
                                                        {selected && (
                                                            <View style={addStyles.myFriendCheck}>
                                                                <Ionicons name="checkmark" size={12} color="#FFF" />
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text
                                                        style={[addStyles.myFriendName, selected && addStyles.myFriendNameActive]}
                                                        numberOfLines={1}
                                                    >
                                                        {(f.fullName || '').split(' ')[0]}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            <View style={addStyles.searchWrap}>
                                <Ionicons name="search-outline" size={18} color="#A3A3A3" style={addStyles.inputIcon} />
                                <TextInput
                                    style={addStyles.input}
                                    placeholder="Search by name or email..."
                                    placeholderTextColor="#A3A3A3"
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                    autoCapitalize="none"
                                />
                                {searching && <ActivityIndicator size="small" color={ORANGE} />}
                            </View>

                            {searchResults.length > 0 && (
                                <View style={addStyles.searchDropdown}>
                                    {searchResults.map((u) => {
                                        const isFriend = !!myFriends.find((mf) => mf._id === u._id);
                                        const alreadyAdded = !!friends.find((x) => x._id === u._id);
                                        return (
                                            <TouchableOpacity
                                                key={u._id}
                                                style={addStyles.searchItem}
                                                onPress={() => !alreadyAdded && addFriend(u)}
                                                disabled={alreadyAdded}
                                            >
                                                <Avatar user={u} size={32} />
                                                <View style={{ marginLeft: 10, flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={addStyles.searchItemName}>{u.fullName}</Text>
                                                        {isFriend && (
                                                            <View style={addStyles.friendBadge}>
                                                                <Text style={addStyles.friendBadgeText}>Friend</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text style={addStyles.searchItemEmail}>{u.email}</Text>
                                                </View>
                                                {alreadyAdded
                                                    ? <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
                                                    : <Ionicons name="add-circle-outline" size={22} color={ORANGE} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Paid By</Text>
                            <TouchableOpacity
                                style={addStyles.groupSelector}
                                onPress={() => setShowPayerPicker(true)}
                            >
                                <Avatar user={payerObj} size={24} />
                                <Text style={[addStyles.groupSelectorText, { marginLeft: 10 }]}>
                                    {paidBy === currentUser._id ? 'You' : (payerObj.fullName || payerObj.email || 'Unknown')}
                                </Text>
                                <Ionicons name="chevron-down-outline" size={16} color="#A3A3A3" />
                            </TouchableOpacity>
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>How to Split</Text>
                            {SPLIT_TYPES.map((st) => (
                                <TouchableOpacity
                                    key={st.id}
                                    style={[addStyles.splitOption, splitType === st.id && addStyles.splitOptionActive]}
                                    onPress={() => setSplitType(st.id)}
                                >
                                    <View style={[addStyles.splitIconWrap, splitType === st.id && addStyles.splitIconWrapActive]}>
                                        <Ionicons name={st.icon} size={18} color={splitType === st.id ? '#FFF' : '#737373'} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[addStyles.splitOptionLabel, splitType === st.id && addStyles.splitOptionLabelActive]}>
                                            {st.label}
                                        </Text>
                                        <Text style={addStyles.splitOptionDesc}>{st.desc}</Text>
                                    </View>
                                    {splitType === st.id && (
                                        <Ionicons name="checkmark-circle" size={20} color={ORANGE} />
                                    )}
                                </TouchableOpacity>
                            ))}

                            {splitType === 'percentage' && (
                                <View style={addStyles.percentageBox}>
                                    <View style={addStyles.percentageRow}>
                                        <Avatar user={currentUser} size={28} />
                                        <Text style={addStyles.percentageName}>{currentUser.fullName} (You)</Text>
                                        <View style={addStyles.percentageInputWrap}>
                                            <TextInput
                                                style={addStyles.percentageInput}
                                                value={percentages[currentUser._id] || ''}
                                                onChangeText={(v) => setPercentages((p) => ({ ...p, [currentUser._id]: v }))}
                                                keyboardType="decimal-pad"
                                                placeholder="0"
                                                placeholderTextColor="#A3A3A3"
                                            />
                                            <Text style={addStyles.percentageSign}>%</Text>
                                        </View>
                                    </View>
                                    {friends.map((f) => (
                                        <View key={f._id} style={addStyles.percentageRow}>
                                            <Avatar user={f} size={28} />
                                            <Text style={addStyles.percentageName}>{f.fullName}</Text>
                                            <View style={addStyles.percentageInputWrap}>
                                                <TextInput
                                                    style={addStyles.percentageInput}
                                                    value={percentages[f._id] || ''}
                                                    onChangeText={(v) => setPercentages((p) => ({ ...p, [f._id]: v }))}
                                                    keyboardType="decimal-pad"
                                                    placeholder="0"
                                                    placeholderTextColor="#A3A3A3"
                                                />
                                                <Text style={addStyles.percentageSign}>%</Text>
                                            </View>
                                        </View>
                                    ))}
                                    <View style={addStyles.percentageTotalRow}>
                                        <Text style={[
                                            addStyles.percentageTotal,
                                            Math.abs(percentageTotal - 100) > 0.01 && addStyles.percentageTotalError
                                        ]}>
                                            Total: {percentageTotal.toFixed(1)}%
                                        </Text>
                                        {Math.abs(percentageTotal - 100) > 0.01 && (
                                            <Text style={addStyles.percentageTotalHint}>Must equal 100%</Text>
                                        )}
                                    </View>
                                    {errors.percentage && <Text style={addStyles.errorText}>{errors.percentage}</Text>}
                                </View>
                            )}
                        </View>

                        <View style={addStyles.fieldGroup}>
                            <Text style={addStyles.fieldLabel}>Add to Group <Text style={addStyles.optional}>(optional)</Text></Text>
                            <TouchableOpacity
                                style={addStyles.groupSelector}
                                onPress={() => setShowGroupPicker(true)}
                            >
                                <Ionicons name="people-outline" size={18} color="#737373" style={addStyles.inputIcon} />
                                <Text style={[addStyles.groupSelectorText, !selectedGroup && { color: '#A3A3A3' }]}>
                                    {selectedGroup ? selectedGroup.name : 'Select a group...'}
                                </Text>
                                {selectedGroup && (
                                    <TouchableOpacity onPress={() => setSelectedGroup(null)}>
                                        <Ionicons name="close-circle" size={18} color="#A3A3A3" />
                                    </TouchableOpacity>
                                )}
                                {!selectedGroup && <Ionicons name="chevron-down-outline" size={16} color="#A3A3A3" />}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={showPayerPicker} transparent animationType="fade" onRequestClose={() => setShowPayerPicker(false)}>
                <TouchableOpacity style={pickerStyles.overlay} onPress={() => setShowPayerPicker(false)}>
                    <View style={pickerStyles.sheet}>
                        <Text style={pickerStyles.sheetTitle}>Who Paid?</Text>
                        {[currentUser, ...friends].map((m) => {
                            const isMe = m._id === currentUser._id;
                            const selected = paidBy === m._id;
                            return (
                                <TouchableOpacity
                                    key={m._id}
                                    style={pickerStyles.groupItem}
                                    onPress={() => { setPaidBy(m._id); setShowPayerPicker(false); }}
                                >
                                    <Avatar user={m} size={32} />
                                    <Text style={[pickerStyles.groupName, { marginLeft: 10 }]}>
                                        {isMe ? 'You' : (m.fullName || m.email)}
                                    </Text>
                                    {selected && <Ionicons name="checkmark" size={18} color={ORANGE} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={showGroupPicker} transparent animationType="fade" onRequestClose={() => setShowGroupPicker(false)}>
                <TouchableOpacity style={pickerStyles.overlay} onPress={() => setShowGroupPicker(false)}>
                    <View style={pickerStyles.sheet}>
                        <Text style={pickerStyles.sheetTitle}>Select Group</Text>
                        {groups.length === 0 && (
                            <Text style={pickerStyles.emptyText}>No groups yet</Text>
                        )}
                        {groups.map((g) => (
                            <TouchableOpacity
                                key={g._id}
                                style={pickerStyles.groupItem}
                                onPress={() => { setSelectedGroup(g); setShowGroupPicker(false); }}
                            >
                                <View style={pickerStyles.groupIcon}>
                                    <Ionicons name="people-outline" size={18} color={ORANGE} />
                                </View>
                                <Text style={pickerStyles.groupName}>{g.name}</Text>
                                {selectedGroup?._id === g._id && (
                                    <Ionicons name="checkmark" size={18} color={ORANGE} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            <DatePickerModal
                visible={showDatePicker}
                value={expenseDate}
                onChange={setExpenseDate}
                onClose={() => setShowDatePicker(false)}
            />
        </Modal>
    );
};

const addStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
    saveHeaderBtn: { paddingHorizontal: 4, paddingVertical: 4 },
    saveHeaderBtnText: { fontSize: 16, fontWeight: '700', color: ORANGE },
    body: { padding: 20, paddingBottom: 60 },
    fieldGroup: { marginBottom: 24 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#525252', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
    optional: { color: '#A3A3A3', fontWeight: '400', textTransform: 'none' },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAFAFA', borderRadius: 12,
        borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 14, height: 52
    },
    inputError: { borderColor: '#EF4444' },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: '#171717' },
    currencyPrefix: { fontSize: 18, fontWeight: '700', color: '#262626', marginRight: 6 },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
    catChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: '#E5E5E5',
        backgroundColor: '#FAFAFA', marginHorizontal: 4
    },
    catChipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
    catChipText: { fontSize: 13, color: '#525252', marginLeft: 6, fontWeight: '600' },
    catChipTextActive: { color: '#FFF' },
    subChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 16, borderWidth: 1, borderColor: '#E5E5E5',
        backgroundColor: '#FAFAFA',
        marginHorizontal: 4,
    },
    subChipText: { fontSize: 12, color: '#525252', marginLeft: 5 },
    friendList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
    friendChip: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FEF3C7', borderRadius: 20,
        paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8
    },
    friendChipName: { fontSize: 13, fontWeight: '600', color: '#D97706', marginHorizontal: 6 },
    myFriendsWrap: { marginBottom: 12 },
    myFriendsLabel: {
        fontSize: 11, fontWeight: '700', color: '#A3A3A3',
        textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10
    },
    myFriendsRow: { paddingVertical: 2, paddingRight: 8 },
    myFriendItem: { alignItems: 'center', marginRight: 14, width: 64 },
    myFriendItemActive: {},
    myFriendCheck: {
        position: 'absolute', bottom: -2, right: -2,
        width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#FFF'
    },
    myFriendName: { fontSize: 11, color: '#525252', marginTop: 6, textAlign: 'center' },
    myFriendNameActive: { color: ORANGE, fontWeight: '700' },
    friendBadge: {
        backgroundColor: '#FFF7ED', paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 4, marginLeft: 6,
        borderWidth: 1, borderColor: '#FED7AA'
    },
    friendBadgeText: { fontSize: 10, fontWeight: '700', color: ORANGE },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAFAFA', borderRadius: 12,
        borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 14, height: 48
    },
    searchDropdown: {
        backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1,
        borderColor: '#E5E5E5', marginTop: 8, overflow: 'hidden'
    },
    searchItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    searchItemName: { fontSize: 14, fontWeight: '600', color: '#262626' },
    searchItemEmail: { fontSize: 12, color: '#A3A3A3' },
    splitOption: {
        flexDirection: 'row', alignItems: 'center', padding: 14,
        borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5',
        backgroundColor: '#FAFAFA', marginBottom: 10
    },
    splitOptionActive: { borderColor: ORANGE, backgroundColor: '#FFF7ED' },
    splitIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center'
    },
    splitIconWrapActive: { backgroundColor: ORANGE },
    splitOptionLabel: { fontSize: 14, fontWeight: '600', color: '#262626', marginBottom: 2 },
    splitOptionLabelActive: { color: ORANGE },
    splitOptionDesc: { fontSize: 12, color: '#A3A3A3' },
    percentageBox: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 14, marginTop: 8 },
    percentageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    percentageName: { flex: 1, fontSize: 14, color: '#262626', marginLeft: 10 },
    percentageInputWrap: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 8,
        paddingHorizontal: 8, height: 36
    },
    percentageInput: { width: 44, fontSize: 14, color: '#262626', textAlign: 'right' },
    percentageSign: { fontSize: 14, color: '#525252', marginLeft: 2 },
    percentageTotalRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E5E5', paddingTop: 10 },
    percentageTotal: { fontSize: 13, fontWeight: '700', color: '#262626' },
    percentageTotalError: { color: '#EF4444' },
    percentageTotalHint: { fontSize: 12, color: '#EF4444', marginLeft: 8 },
    groupSelector: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAFAFA', borderRadius: 12,
        borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 14, height: 52
    },
    groupSelectorText: { flex: 1, fontSize: 15, color: '#171717' },
});

const pickerStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '60%' },
    sheetTitle: { fontSize: 17, fontWeight: '700', color: '#171717', marginBottom: 16 },
    emptyText: { color: '#A3A3A3', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
    groupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    groupIcon: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12
    },
    groupName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#262626' },
});

// ─── Expense Card ─────────────────────────────────────────────────────────────
const ExpenseCard = ({ expense, currentUserId, perExpenseRemaining, onPress, onDelete }) => {
    const swipeRef = React.useRef(null);
    const cat = resolveCategory(expense.category);
    const info = perExpenseRemaining?.[expense._id] || null;

    const payerId = expense.paidBy?._id || expense.paidBy || null;
    const iPaid = payerId === currentUserId;
    const isOrphan = (info?.type || (payerId ? null : 'orphan')) === 'orphan';

    const payerName =
        expense.paidBy?.fullName ||
        expense.paidBy?.email ||
        (isOrphan ? '(deleted user)' : 'Someone');

    // Determine displayed balance: historical original, and remaining after
    // settlements have been applied FIFO (oldest expense first).
    const original = info?.original ?? 0;
    const remaining = info?.remaining ?? original;
    const kind = info?.type || 'none'; // 'owed' | 'lent' | 'orphan' | 'none'

    let status = 'raw'; // 'raw' | 'settled' | 'partial' | 'orphan'
    if (isOrphan) status = 'orphan';
    else if (original > 0.004 && remaining <= 0.004) status = 'settled';
    else if (info?.isPartial && remaining > 0.004) status = 'partial';

    const amountColor =
        status === 'settled'
            ? '#A3A3A3'
            : kind === 'lent'
                ? '#10B981'
                : kind === 'owed'
                    ? '#EF4444'
                    : '#737373';

    const renderAmount = () => {
        if (kind === 'none' || original <= 0.004) return null;
        const sign = kind === 'lent' ? '+' : '-';
        // On a partially settled "owed" card, show the remaining prominently with
        // a subtle secondary line for the original.
        if (status === 'partial') {
            return (
                <>
                    <Text style={[cardStyles.balance, { color: amountColor }]}>
                        {sign}{formatAmount(remaining)}
                    </Text>
                    <Text style={cardStyles.balanceOrig}>
                        of {formatAmount(original)}
                    </Text>
                </>
            );
        }
        return (
            <Text
                style={[
                    cardStyles.balance,
                    { color: amountColor },
                    status === 'settled' && cardStyles.balanceStruck,
                ]}
            >
                {sign}{formatAmount(status === 'settled' ? original : remaining)}
            </Text>
        );
    };

    const renderRightActions = (_progress, _dragX) => (
        <TouchableOpacity
            style={cardStyles.deleteAction}
            activeOpacity={0.85}
            onPress={() => {
                swipeRef.current?.close();
                onDelete?.();
            }}
        >
            <Ionicons name="trash-outline" size={22} color="#FFF" />
            <Text style={cardStyles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
    );

    return (
        <Swipeable
            ref={swipeRef}
            renderRightActions={onDelete ? renderRightActions : undefined}
            friction={1.6}
            rightThreshold={40}
            overshootRight={false}
            containerStyle={cardStyles.swipeWrap}
        >
        <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.75}>
            <View style={cardStyles.iconWrap}>
                <Ionicons name={cat?.icon || 'receipt-outline'} size={22} color={ORANGE} />
            </View>
            <View style={cardStyles.info}>
                <Text style={cardStyles.title} numberOfLines={1}>{expense.title}</Text>
                <Text style={cardStyles.meta} numberOfLines={1}>
                    {iPaid ? 'You paid' : `${payerName} paid`} · {formatDate(expense.expenseDate || expense.createdAt)}
                </Text>
                {expense.groupId?.name && (
                    <Text style={cardStyles.groupBadge}>{expense.groupId.name}</Text>
                )}
            </View>
            <View style={cardStyles.amountWrap}>
                <Text style={cardStyles.total}>{formatAmount(expense.amount)}</Text>
                {renderAmount()}
                {status === 'settled' && (
                    <View style={[cardStyles.statusPill, cardStyles.settledPill]}>
                        <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                        <Text style={[cardStyles.statusPillText, { color: '#10B981' }]}>Settled</Text>
                    </View>
                )}
                {status === 'partial' && (
                    <View style={[cardStyles.statusPill, cardStyles.partialPill]}>
                        <Ionicons name="time-outline" size={10} color="#D97706" />
                        <Text style={[cardStyles.statusPillText, { color: '#D97706' }]}>Partial</Text>
                    </View>
                )}
                {status === 'orphan' && original > 0.004 && (
                    <View style={[cardStyles.statusPill, cardStyles.orphanPill]}>
                        <Ionicons name="alert-circle-outline" size={10} color="#737373" />
                        <Text style={[cardStyles.statusPillText, { color: '#737373' }]}>Unreachable</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
        </Swipeable>
    );
};

const cardStyles = StyleSheet.create({
    swipeWrap: {
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
    },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', padding: 16,
        borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
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
    iconWrap: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginRight: 14
    },
    info: { flex: 1 },
    title: { fontSize: 15, fontWeight: '600', color: '#171717', marginBottom: 3 },
    meta: { fontSize: 12, color: '#A3A3A3' },
    groupBadge: { fontSize: 11, color: ORANGE, fontWeight: '600', marginTop: 3 },
    amountWrap: { alignItems: 'flex-end' },
    total: { fontSize: 15, fontWeight: '700', color: '#262626' },
    balance: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    balanceOrig: { fontSize: 10, color: '#A3A3A3', marginTop: 1 },
    lent: { color: '#10B981' },
    owed: { color: '#EF4444' },
    balanceStruck: {
        textDecorationLine: 'line-through',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginTop: 4,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '700',
        marginLeft: 3,
    },
    settledPill: { backgroundColor: '#ECFDF5' },
    reversedPill: { backgroundColor: '#EFF6FF' },
    partialPill: { backgroundColor: '#FFFBEB' },
    orphanPill: { backgroundColor: '#F5F5F5' },
});

// ─── Main Expenses Screen ─────────────────────────────────────────────────────
const ExpensesScreen = ({ onOpenSettle }) => {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [settlements, setSettlements] = useState([]); // succeeded payments — offset debts
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);
    const [showPayPicker, setShowPayPicker] = useState(false);

    const sortedExpenses = useMemo(() => {
        return [...expenses].sort((a, b) => {
            const da = new Date(a.expenseDate || a.createdAt).getTime();
            const db = new Date(b.expenseDate || b.createdAt).getTime();
            return db - da;
        });
    }, [expenses]);

    const fetchExpenses = useCallback(async () => {
        try {
            const [expRes, setRes] = await Promise.all([
                getExpenses(),
                listSettlements().catch(() => ({ data: [] })), // non-fatal if payments API errors
            ]);
            setExpenses(expRes.data || []);
            setSettlements(setRes.data || []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

    // Compute the true net balance with every counterparty by combining
    // expense splits AND succeeded settlements. This lets the UI correctly
    // handle overpayments, null paidBy, and partial settles.
    //
    //   netPerFriend[friendId].net > 0  =>  friend owes me that much
    //   netPerFriend[friendId].net < 0  =>  I owe friend that much
    const netPerFriend = useMemo(() => {
        const myId = user?._id?.toString() || '';
        const net = {}; // friendId -> { friend, net }
        const bump = (id, friendObj, delta) => {
            if (!id || id === myId) return;
            if (!net[id]) {
                net[id] = {
                    friend: typeof friendObj === 'object' && friendObj
                        ? friendObj
                        : { _id: id },
                    net: 0,
                };
            }
            net[id].net += delta;
        };

        // --- Expenses ---
        expenses.forEach((e) => {
            const payer = e.paidBy;
            const payerId = payer?._id?.toString?.() || payer?.toString?.() || '';
            if (!payerId) return; // skip expenses with null payer (orphan data)
            (e.splits || []).forEach((s) => {
                const uid = s.user?._id?.toString?.() || s.user?.toString?.() || '';
                if (!uid) return;
                const share = s.amount || 0;
                if (payerId === myId && uid !== myId) {
                    // I paid. Their share is what they owe me.
                    bump(uid, s.user, +share);
                } else if (uid === myId && payerId !== myId) {
                    // They paid. My share is what I owe them.
                    bump(payerId, payer, -share);
                }
            });
        });

        // --- Applied settlements ---
        (settlements || [])
            .filter((s) => s.status === 'succeeded')
            .forEach((s) => {
                const payerId = s.payer?._id?.toString?.() || s.payer?.toString?.() || '';
                const recipientId = s.recipient?._id?.toString?.() || s.recipient?.toString?.() || '';
                const dollars = (s.amount || 0) / 100; // Settlement.amount is cents
                if (payerId === myId && recipientId) {
                    // I paid friend. Reduces what I owe => raises net.
                    bump(recipientId, s.recipient, +dollars);
                } else if (recipientId === myId && payerId) {
                    // Friend paid me. Reduces what they owe => lowers net.
                    bump(payerId, s.payer, -dollars);
                }
            });

        // Round each bucket to 2dp
        Object.values(net).forEach((x) => {
            x.net = Math.round(x.net * 100) / 100;
        });
        return net;
    }, [expenses, settlements, user._id]);

    // Per-expense remaining amount after settlements are applied FIFO (oldest first)
    // per counterparty. Each expense id maps to:
    //   { type: 'owed'|'lent'|'orphan', payerId, original, remaining, isPartial }
    // For group expenses (I paid for 3 people), remaining is accumulated across
    // each counterparty's individual FIFO bucket.
    const perExpenseRemaining = useMemo(() => {
        const out = {};

        // Group expenses by counterparty, chronologically
        const byFriend = new Map(); // friendId -> { iOwe:[], theyOwe:[], net }
        const bucket = (fid) => {
            if (!byFriend.has(fid)) byFriend.set(fid, { iOwe: [], theyOwe: [], net: 0 });
            return byFriend.get(fid);
        };

        const sortedAsc = [...expenses].sort((a, b) => {
            const da = new Date(a.expenseDate || a.createdAt).getTime();
            const db = new Date(b.expenseDate || b.createdAt).getTime();
            return da - db; // oldest first
        });

        const myId = user?._id?.toString() || '';
        sortedAsc.forEach((e) => {
            const payerId = e.paidBy?._id?.toString?.() || e.paidBy?.toString?.() || null;
            if (!payerId) {
                // Orphan — payer account was deleted, we know your share but can't settle.
                const mine = (e.splits || []).find(
                    (s) => (s.user?._id?.toString?.() || s.user?.toString?.()) === myId
                );
                const share = mine?.amount || 0;
                out[e._id] = {
                    type: 'orphan',
                    payerId: null,
                    original: share,
                    remaining: share,
                    isPartial: false,
                };
                return;
            }
            (e.splits || []).forEach((s) => {
                const uid = s.user?._id?.toString?.() || s.user?.toString?.() || '';
                if (!uid) return;
                const share = s.amount || 0;
                if (share <= 0.004) return;
                if (payerId === myId && uid !== myId) {
                    bucket(uid).theyOwe.push({ id: e._id, share });
                } else if (uid === myId && payerId !== myId) {
                    bucket(payerId).iOwe.push({ id: e._id, share });
                }
            });
        });

        (settlements || [])
            .filter((s) => s.status === 'succeeded')
            .forEach((s) => {
                const pId = s.payer?._id?.toString?.() || s.payer?.toString?.() || '';
                const rId = s.recipient?._id?.toString?.() || s.recipient?.toString?.() || '';
                const dollars = (s.amount || 0) / 100;
                if (pId === myId && rId) bucket(rId).net += dollars;
                else if (rId === myId && pId) bucket(pId).net -= dollars;
            });

        // Emit helpers: accumulate across counterparties for group expenses.
        const accum = (id, partial, type, payerId) => {
            if (!out[id]) {
                out[id] = {
                    type,
                    payerId,
                    original: 0,
                    remaining: 0,
                    isPartial: false,
                };
            }
            out[id].original += partial.original;
            out[id].remaining += partial.remaining;
            if (partial.original - partial.remaining > 0.004) out[id].isPartial = true;
        };

        byFriend.forEach((data, fid) => {
            let credit = data.net;

            if (credit > 0) {
                // I've paid this friend net +credit. Reduce my debts to them oldest-first.
                for (const d of data.iOwe) {
                    const applied = Math.min(d.share, Math.max(0, credit));
                    credit -= applied;
                    accum(d.id, {
                        original: d.share,
                        remaining: Math.max(0, d.share - applied),
                    }, 'owed', fid);
                }
                // Their debts to me are untouched (my overpayment shows as net credit in header).
                data.theyOwe.forEach((l) =>
                    accum(l.id, { original: l.share, remaining: l.share }, 'lent', user._id)
                );
            } else if (credit < -0.004) {
                let abs = -credit;
                for (const l of data.theyOwe) {
                    const applied = Math.min(l.share, Math.max(0, abs));
                    abs -= applied;
                    accum(l.id, {
                        original: l.share,
                        remaining: Math.max(0, l.share - applied),
                    }, 'lent', user._id);
                }
                data.iOwe.forEach((d) =>
                    accum(d.id, { original: d.share, remaining: d.share }, 'owed', fid)
                );
            } else {
                data.iOwe.forEach((d) =>
                    accum(d.id, { original: d.share, remaining: d.share }, 'owed', fid)
                );
                data.theyOwe.forEach((l) =>
                    accum(l.id, { original: l.share, remaining: l.share }, 'lent', user._id)
                );
            }
        });

        // Round each entry.
        Object.values(out).forEach((x) => {
            x.original = Math.round(x.original * 100) / 100;
            x.remaining = Math.round(x.remaining * 100) / 100;
        });
        return out;
    }, [expenses, settlements, user._id]);

    // People I owe (net < 0). Used by the pay picker + header total.
    const debtsByPerson = useMemo(
        () => Object.values(netPerFriend)
            .filter((x) => x.net < -0.004)
            .map((x) => ({ friend: x.friend, amount: -x.net }))
            .sort((a, b) => b.amount - a.amount),
        [netPerFriend]
    );

    const totalOwed = useMemo(
        () => debtsByPerson.reduce((a, d) => a + d.amount, 0),
        [debtsByPerson]
    );

    // People who owe me (net > 0).
    const totalLent = useMemo(
        () => Object.values(netPerFriend)
            .filter((x) => x.net > 0.004)
            .reduce((sum, x) => sum + x.net, 0),
        [netPerFriend]
    );

    // Gross totals for the header summary. Unlike the net-per-person
    // totals above (which power the Pay button), these match the raw
    // per-expense amounts shown on each list card and the Dashboard KPIs
    // — summing every share you owe and every share others owe you,
    // without cross-cancelling a friend's debt to you against your
    // debt to that same friend.
    const grossOwed = useMemo(() => {
        const myId = user?._id?.toString() || '';
        let sum = 0;
        for (const e of expenses) {
            const payerId = e.paidBy?._id?.toString?.() || e.paidBy?.toString?.() || '';
            if (!payerId || payerId === myId) continue;
            const mine = (e.splits || []).find((s) => {
                const uid = s.user?._id?.toString?.() || s.user?.toString?.() || '';
                return uid === myId;
            });
            sum += Number(mine?.amount) || 0;
        }
        return Math.round(sum * 100) / 100;
    }, [expenses, user._id]);

    const grossLent = useMemo(() => {
        const myId = user?._id?.toString() || '';
        let sum = 0;
        for (const e of expenses) {
            const payerId = e.paidBy?._id?.toString?.() || e.paidBy?.toString?.() || '';
            if (!payerId || payerId !== myId) continue;
            for (const s of e.splits || []) {
                const uid = s.user?._id?.toString?.() || s.user?.toString?.() || '';
                if (uid && uid !== myId) sum += Number(s.amount) || 0;
            }
        }
        return Math.round(sum * 100) / 100;
    }, [expenses, user._id]);

    // Gross per-person debts for the Pay picker. Sums your share in every
    // expense each friend paid, without cancelling against what they owe
    // you — so every person you still owe appears in the list and the
    // totals match the grossOwed header.
    const grossDebtsByPerson = useMemo(() => {
        const myId = user?._id?.toString() || '';
        const perFriend = {}; // id -> { friend, amount }
        for (const e of expenses) {
            const payer = e.paidBy;
            const payerId = payer?._id?.toString?.() || payer?.toString?.() || '';
            if (!payerId || payerId === myId) continue;
            const mine = (e.splits || []).find((s) => {
                const uid = s.user?._id?.toString?.() || s.user?.toString?.() || '';
                return uid === myId;
            });
            const share = Number(mine?.amount) || 0;
            if (share <= 0.004) continue;
            if (!perFriend[payerId]) {
                perFriend[payerId] = {
                    friend: typeof payer === 'object' && payer ? payer : { _id: payerId },
                    amount: 0,
                };
            }
            perFriend[payerId].amount += share;
        }
        return Object.values(perFriend)
            .map((x) => ({ friend: x.friend, amount: Math.round(x.amount * 100) / 100 }))
            .filter((x) => x.amount > 0.004)
            .sort((a, b) => b.amount - a.amount);
    }, [expenses, user._id]);

    const handlePayPerson = (debt) => {
        setShowPayPicker(false);
        onOpenSettle?.(debt.friend, debt.amount);
    };

    const openPayFromDetail = (payer, amount) => {
        onOpenSettle?.(payer, amount);
    };

    const handleDeleteExpense = (expense) => {
        Alert.alert(
            'Delete Expense',
            `Delete "${expense.title}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Optimistic removal
                        setExpenses((prev) => prev.filter((e) => e._id !== expense._id));
                        try {
                            await deleteExpense(expense._id);
                        } catch (err) {
                            // Roll back on failure
                            Alert.alert(
                                'Error',
                                err?.error?.message || 'Failed to delete expense'
                            );
                            fetchExpenses();
                        }
                    },
                },
            ]
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={listStyles.container}>
            <View style={listStyles.header}>
                <Text style={listStyles.headerTitle}>Expenses</Text>
                <View style={listStyles.headerActions}>
                    {grossOwed > 0.004 && (
                        <TouchableOpacity
                            style={listStyles.payHeaderBtn}
                            onPress={() => setShowPayPicker(true)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="card-outline" size={15} color="#FFF" />
                            <Text style={listStyles.payHeaderBtnText}>
                                Pay {formatAmount(grossOwed)}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={listStyles.addBtn} onPress={() => setShowAdd(true)}>
                        <Ionicons name="add" size={22} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={listStyles.summaryRow}>
                <View style={listStyles.summaryCard}>
                    <Text style={listStyles.summaryLabel}>You are owed</Text>
                    <Text style={[listStyles.summaryAmount, listStyles.lentColor]}>{formatAmount(grossLent)}</Text>
                </View>
                <View style={listStyles.summaryDivider} />
                <View style={listStyles.summaryCard}>
                    <Text style={listStyles.summaryLabel}>You owe</Text>
                    <Text style={[listStyles.summaryAmount, listStyles.owedColor]}>{formatAmount(grossOwed)}</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 60 }} />
            ) : sortedExpenses.length === 0 ? (
                <View style={listStyles.emptyWrap}>
                    <Ionicons name="receipt-outline" size={64} color="#E5E5E5" />
                    <Text style={listStyles.emptyTitle}>No expenses yet</Text>
                    <Text style={listStyles.emptySubtitle}>Tap + to add your first expense</Text>
                </View>
            ) : (
                <FlatList
                    data={sortedExpenses}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <ExpenseCard
                            expense={item}
                            currentUserId={user._id}
                            perExpenseRemaining={perExpenseRemaining}
                            onPress={() => setSelectedExpense(item)}
                            onDelete={() => handleDeleteExpense(item)}
                        />
                    )}
                    contentContainerStyle={listStyles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchExpenses(); }}
                            tintColor={ORANGE}
                        />
                    }
                />
            )}

            <AddExpenseModal
                visible={showAdd}
                onClose={() => setShowAdd(false)}
                onCreated={(expense) => setExpenses((prev) => [expense, ...prev])}
                currentUser={user}
            />

            <ExpenseDetailModal
                expense={selectedExpense}
                visible={!!selectedExpense}
                onClose={() => setSelectedExpense(null)}
                currentUser={user}
                onPay={openPayFromDetail}
                netDebts={debtsByPerson}
                remainingInfo={selectedExpense ? perExpenseRemaining[selectedExpense._id] : null}
                onUpdated={(updated) => {
                    setExpenses((prev) => prev.map((e) => e._id === updated._id ? updated : e));
                    setSelectedExpense(updated);
                }}
                onDeleted={(id) => {
                    setExpenses((prev) => prev.filter((e) => e._id !== id));
                }}
            />

            {/* Pay picker — pick which friend to settle up with */}
            <Modal
                visible={showPayPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPayPicker(false)}
            >
                <TouchableOpacity
                    style={listStyles.payOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPayPicker(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={listStyles.paySheet}>
                        <View style={listStyles.paySheetHandle} />
                        <Text style={listStyles.paySheetTitle}>Settle up</Text>
                        <Text style={listStyles.paySheetSubtitle}>
                            You owe a total of {formatAmount(grossOwed)}. Select a person to pay.
                        </Text>

                        <ScrollView style={{ marginTop: 8 }}>
                            {grossDebtsByPerson.length === 0 ? (
                                <Text style={listStyles.paySheetEmpty}>You're all settled up.</Text>
                            ) : (
                                grossDebtsByPerson.map((d) => (
                                    <TouchableOpacity
                                        key={d.friend._id}
                                        style={listStyles.payPersonRow}
                                        onPress={() => handlePayPerson(d)}
                                        activeOpacity={0.75}
                                    >
                                        <Avatar user={d.friend} size={42} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={listStyles.payPersonName} numberOfLines={1}>
                                                {d.friend.fullName || d.friend.email || 'Unknown'}
                                            </Text>
                                            <Text style={listStyles.payPersonHint}>
                                                You owe
                                            </Text>
                                        </View>
                                        <View style={listStyles.payPersonAmountWrap}>
                                            <Text style={listStyles.payPersonAmount}>
                                                {formatAmount(d.amount)}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color="#A3A3A3" />
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={listStyles.payCancelBtn}
                            onPress={() => setShowPayPicker(false)}
                        >
                            <Text style={listStyles.payCancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const listStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F8F8' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFF',
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    headerTitle: { fontSize: 28, fontWeight: '700', color: '#171717' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    addBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center'
    },
    payHeaderBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, height: 36, borderRadius: 18,
        backgroundColor: '#EF4444',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28, shadowRadius: 6, elevation: 3,
    },
    payHeaderBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    paySheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingTop: 10, paddingHorizontal: 22, paddingBottom: 24,
        maxHeight: '75%',
    },
    paySheetHandle: {
        alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#E5E5E5', marginBottom: 12,
    },
    paySheetTitle: { fontSize: 20, fontWeight: '800', color: '#171717' },
    paySheetSubtitle: { fontSize: 13, color: '#737373', marginTop: 4 },
    paySheetEmpty: { fontSize: 14, color: '#A3A3A3', textAlign: 'center', paddingVertical: 40 },
    payPersonRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    },
    payPersonName: { fontSize: 15, fontWeight: '700', color: '#171717' },
    payPersonHint: { fontSize: 12, color: '#A3A3A3', marginTop: 2 },
    payPersonAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    payPersonAmount: { fontSize: 16, fontWeight: '800', color: '#EF4444' },
    payCancelBtn: {
        marginTop: 14, paddingVertical: 14,
        borderRadius: 12, backgroundColor: '#F5F5F5',
        alignItems: 'center',
    },
    payCancelBtnText: { fontSize: 15, fontWeight: '700', color: '#525252' },
    summaryRow: {
        flexDirection: 'row', backgroundColor: '#FFF',
        marginHorizontal: 16, marginTop: 16, borderRadius: 16,
        padding: 16, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 2
    },
    summaryCard: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, height: 40, backgroundColor: '#E5E5E5' },
    summaryLabel: { fontSize: 12, color: '#A3A3A3', marginBottom: 4 },
    summaryAmount: { fontSize: 20, fontWeight: '800' },
    lentColor: { color: '#10B981' },
    owedColor: { color: '#EF4444' },
    list: { padding: 16, paddingTop: 12 },
    emptyWrap: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#A3A3A3', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#BDBDBD', marginTop: 6 },
});

export { ExpenseDetailModal, AddExpenseModal };
export default ExpensesScreen;

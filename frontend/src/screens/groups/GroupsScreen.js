// src/screens/groups/GroupsScreen.js
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, FlatList, Modal,
    TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView,
    Platform, RefreshControl, Share, SafeAreaView, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import {
    createGroup, getGroups, getGroup, updateGroup,
    addMemberToGroup, leaveGroup, deleteGroup, getInviteLink
} from '../../api/groups';
import { getGroupExpenses } from '../../api/expenses';
import { searchUsers } from '../../api/users';
import { getFriends } from '../../api/friends';
import { ExpenseDetailModal, AddExpenseModal } from '../expenses/ExpensesScreen';

const ORANGE = '#F97316';
const GROUP_TYPES = [
    { id: 'trip', label: 'Trip', icon: 'airplane-outline' },
    { id: 'home', label: 'Home', icon: 'home-outline' },
    { id: 'couple', label: 'Couple', icon: 'heart-outline' },
    { id: 'friends', label: 'Friends', icon: 'people-outline' },
    { id: 'work', label: 'Work', icon: 'briefcase-outline' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatAmount = (n) => `£${parseFloat(n || 0).toFixed(2)}`;

// ─── Avatar ──────────────────────────────────────────────────────────────────
const Avatar = ({ user, size = 36 }) => {
    // If the user has uploaded a profile picture, render it. Otherwise fall
    // back to a coloured circle with their initials. Group member rows and
    // stacked avatars both lean on this, so a single change propagates.
    if (user?.avatar) {
        return (
            <Image
                source={{ uri: user.avatar }}
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FED7AA' }}
            />
        );
    }
    const initials = (user?.fullName || user?.email || '?')
        .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
        <View style={[avStyles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[avStyles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
        </View>
    );
};
const avStyles = StyleSheet.create({
    wrap: { backgroundColor: '#FED7AA', justifyContent: 'center', alignItems: 'center' },
    text: { color: ORANGE, fontWeight: '700' },
});

// ─── Group Icon ───────────────────────────────────────────────────────────────
const GroupIcon = ({ group, size = 52 }) => {
    const type = GROUP_TYPES.find((t) => t.id === group.type) || GROUP_TYPES[5];
    if (group?.avatar) {
        return (
            <Image
                source={{ uri: group.avatar }}
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFF7ED' }}
            />
        );
    }
    return (
        <View style={[giStyles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
            <Ionicons name={type.icon} size={size * 0.46} color={ORANGE} />
        </View>
    );
};
const giStyles = StyleSheet.create({
    wrap: { backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center' },
});

// ─── Group Settings Modal ─────────────────────────────────────────────────────
// Edit Group sub-page (full page inside settings modal)
const EditGroupPage = ({ group, onBack, onSaved }) => {
    const [name, setName] = useState(group?.name || '');
    const [type, setType] = useState(group?.type || 'other');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return Alert.alert('Error', 'Group name is required');
        setSaving(true);
        try {
            const res = await updateGroup(group._id, { name: name.trim(), type });
            onSaved(res.data);
            onBack();
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={settingsStyles.container}>
            <View style={settingsStyles.subHeader}>
                <TouchableOpacity onPress={onBack} style={settingsStyles.subBack}>
                    <Ionicons name="chevron-back" size={26} color="#262626" />
                </TouchableOpacity>
                <Text style={settingsStyles.subHeaderTitle}>Edit Group</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={[settingsStyles.subHeaderAction, saving && { opacity: 0.5 }]}
                >
                    {saving
                        ? <ActivityIndicator color={ORANGE} size="small" />
                        : <Text style={settingsStyles.subHeaderActionText}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={settingsStyles.body} keyboardShouldPersistTaps="handled">
                <View style={{ alignItems: 'center', paddingVertical: 20, backgroundColor: '#FFF', marginBottom: 12 }}>
                    <GroupIcon group={{ ...group, type }} size={80} />
                </View>

                <View style={settingsStyles.editForm}>
                    <Text style={settingsStyles.editLabel}>Group Name</Text>
                    <View style={settingsStyles.editInput}>
                        <TextInput
                            style={settingsStyles.editTextInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Group name"
                            placeholderTextColor="#A3A3A3"
                        />
                    </View>

                    <Text style={[settingsStyles.editLabel, { marginTop: 20 }]}>Group Type</Text>
                    <View style={settingsStyles.typeGrid}>
                        {GROUP_TYPES.map((t) => (
                            <TouchableOpacity
                                key={t.id}
                                onPress={() => setType(t.id)}
                                style={[settingsStyles.typeChip, type === t.id && settingsStyles.typeChipActive]}
                            >
                                <Ionicons name={t.icon} size={16} color={type === t.id ? '#FFF' : '#737373'} />
                                <Text style={[settingsStyles.typeChipText, type === t.id && settingsStyles.typeChipTextActive]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// Add People sub-page (full page inside settings modal)
const AddPeoplePage = ({ group, onBack, onMemberAdded, currentUser }) => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [myFriends, setMyFriends] = useState([]);
    const [addingId, setAddingId] = useState(null);

    React.useEffect(() => {
        (async () => {
            try {
                const res = await getFriends();
                const flat = (res.data?.friends || []).map((f) => f.friend).filter(Boolean);
                setMyFriends(flat);
            } catch { setMyFriends([]); }
        })();
    }, []);

    const handleSearch = async (q) => {
        setQuery(q);
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const res = await searchUsers(q.trim());
            setSearchResults(res.data || []);
        } catch { setSearchResults([]); }
        finally { setSearching(false); }
    };

    const handleAdd = async (userId) => {
        setAddingId(userId);
        try {
            const res = await addMemberToGroup(group._id, userId);
            onMemberAdded(res.data);
            setQuery('');
            setSearchResults([]);
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Failed to add member');
        } finally {
            setAddingId(null);
        }
    };

    const currentMembers = group.members || [];
    const isAlreadyMember = (userId) =>
        currentMembers.some((m) => (m.user?._id || m.user) === userId);

    const friendsNotInGroup = myFriends.filter((f) => !isAlreadyMember(f._id));

    return (
        <SafeAreaView style={settingsStyles.container}>
            <View style={settingsStyles.subHeader}>
                <TouchableOpacity onPress={onBack} style={settingsStyles.subBack}>
                    <Ionicons name="chevron-back" size={26} color="#262626" />
                </TouchableOpacity>
                <Text style={settingsStyles.subHeaderTitle}>Add People</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={settingsStyles.body} keyboardShouldPersistTaps="handled">
                {friendsNotInGroup.length > 0 && (
                    <View style={settingsStyles.section}>
                        <Text style={settingsStyles.sectionTitle}>Your Friends</Text>
                        {friendsNotInGroup.map((f) => (
                            <TouchableOpacity
                                key={f._id}
                                style={settingsStyles.memberRow}
                                onPress={() => handleAdd(f._id)}
                                disabled={addingId === f._id}
                            >
                                <Avatar user={f} size={40} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={settingsStyles.memberName}>{f.fullName}</Text>
                                    <Text style={settingsStyles.memberEmail}>{f.email}</Text>
                                </View>
                                {addingId === f._id
                                    ? <ActivityIndicator size="small" color={ORANGE} />
                                    : <Ionicons name="add-circle" size={26} color={ORANGE} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={settingsStyles.section}>
                    <Text style={settingsStyles.sectionTitle}>Search Everyone</Text>
                    <View style={settingsStyles.searchWrap}>
                        <Ionicons name="search-outline" size={18} color="#A3A3A3" style={{ marginRight: 8 }} />
                        <TextInput
                            style={{ flex: 1, fontSize: 15, color: '#171717' }}
                            placeholder="Search by name or email..."
                            placeholderTextColor="#A3A3A3"
                            value={query}
                            onChangeText={handleSearch}
                            autoCapitalize="none"
                            autoFocus={false}
                        />
                        {searching && <ActivityIndicator size="small" color={ORANGE} />}
                    </View>

                    {searchResults.length > 0 && (
                        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                            {searchResults.map((u) => {
                                const alreadyIn = isAlreadyMember(u._id);
                                const isFriend = !!myFriends.find((f) => f._id === u._id);
                                return (
                                    <TouchableOpacity
                                        key={u._id}
                                        style={settingsStyles.searchItem}
                                        onPress={() => !alreadyIn && handleAdd(u._id)}
                                        disabled={alreadyIn || addingId === u._id}
                                    >
                                        <Avatar user={u} size={36} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={settingsStyles.searchName}>{u.fullName}</Text>
                                                {isFriend && (
                                                    <View style={settingsStyles.friendTag}>
                                                        <Text style={settingsStyles.friendTagText}>Friend</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={settingsStyles.searchEmail}>{u.email}</Text>
                                        </View>
                                        {alreadyIn
                                            ? <Text style={settingsStyles.alreadyText}>Already in</Text>
                                            : addingId === u._id
                                                ? <ActivityIndicator size="small" color={ORANGE} />
                                                : <Ionicons name="add-circle" size={24} color={ORANGE} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                    {query.length >= 2 && !searching && searchResults.length === 0 && (
                        <Text style={{ textAlign: 'center', color: '#A3A3A3', padding: 20 }}>No users found</Text>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const GroupSettingsModal = ({ group, visible, onClose, currentUser, onGroupUpdated, onGroupLeft, onGroupDeleted }) => {
    // view: 'main' | 'edit' | 'addPeople'
    const [view, setView] = useState('main');

    React.useEffect(() => {
        if (visible) setView('main');
    }, [visible, group?._id]);

    if (!group) return null;

    const isCreator = (group.createdBy?._id || group.createdBy) === currentUser._id;
    const currentMembers = group.members || [];

    const handleInviteLink = async () => {
        try {
            const res = await getInviteLink(group._id);
            const link = res.data?.inviteLink || '';
            await Share.share({ message: `Join my group "${group.name}" on FundFlock: ${link}` });
        } catch {
            Alert.alert('Error', 'Failed to get invite link');
        }
    };

    const handleLeave = () => {
        Alert.alert('Leave Group', `Leave "${group.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Leave', style: 'destructive', onPress: async () => {
                    try {
                        await leaveGroup(group._id);
                        onGroupLeft(group._id);
                        onClose();
                    } catch (e) {
                        Alert.alert('Error', e.error?.message || 'Failed to leave group');
                    }
                }
            }
        ]);
    };

    const handleDelete = () => {
        if (!isCreator) {
            return Alert.alert(
                'Permission Required',
                'Only the group creator can delete this group. Ask the creator to delete it.',
                [{ text: 'OK' }]
            );
        }
        Alert.alert('Delete Group', `Permanently delete "${group.name}" and all its data?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteGroup(group._id);
                        onGroupDeleted(group._id);
                        onClose();
                    } catch (e) {
                        Alert.alert('Error', e.error?.message || 'Failed to delete group');
                    }
                }
            }
        ]);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            {view === 'edit' ? (
                <EditGroupPage
                    group={group}
                    onBack={() => setView('main')}
                    onSaved={(updated) => onGroupUpdated(updated)}
                />
            ) : view === 'addPeople' ? (
                <AddPeoplePage
                    group={group}
                    currentUser={currentUser}
                    onBack={() => setView('main')}
                    onMemberAdded={(updated) => onGroupUpdated(updated)}
                />
            ) : (
                <SafeAreaView style={settingsStyles.container}>
                    <View style={settingsStyles.subHeader}>
                        <TouchableOpacity onPress={onClose} style={settingsStyles.subBack}>
                            <Ionicons name="close" size={26} color="#262626" />
                        </TouchableOpacity>
                        <Text style={settingsStyles.subHeaderTitle}>Group Settings</Text>
                        <View style={{ width: 60 }} />
                    </View>

                    <ScrollView contentContainerStyle={settingsStyles.body} keyboardShouldPersistTaps="handled">
                        <View style={settingsStyles.groupHeader}>
                            <GroupIcon group={group} size={72} />
                            <Text style={settingsStyles.groupName}>{group.name}</Text>
                            <Text style={settingsStyles.groupType}>
                                {GROUP_TYPES.find((t) => t.id === group.type)?.label} · {currentMembers.length} members
                            </Text>
                        </View>

                        <View style={settingsStyles.section}>
                            <TouchableOpacity style={settingsStyles.tile} onPress={() => setView('edit')}>
                                <View style={settingsStyles.tileIconWrap}>
                                    <Ionicons name="create-outline" size={20} color={ORANGE} />
                                </View>
                                <Text style={settingsStyles.tileName}>Edit Group</Text>
                                <Ionicons name="chevron-forward" size={16} color="#A3A3A3" />
                            </TouchableOpacity>

                            <TouchableOpacity style={settingsStyles.tile} onPress={() => setView('addPeople')}>
                                <View style={settingsStyles.tileIconWrap}>
                                    <Ionicons name="person-add-outline" size={20} color={ORANGE} />
                                </View>
                                <Text style={settingsStyles.tileName}>Add People</Text>
                                <Ionicons name="chevron-forward" size={16} color="#A3A3A3" />
                            </TouchableOpacity>

                            <TouchableOpacity style={settingsStyles.tile} onPress={handleInviteLink}>
                                <View style={settingsStyles.tileIconWrap}>
                                    <Ionicons name="link-outline" size={20} color={ORANGE} />
                                </View>
                                <Text style={settingsStyles.tileName}>Invite via Link</Text>
                                <Ionicons name="chevron-forward" size={16} color="#A3A3A3" />
                            </TouchableOpacity>

                            <TouchableOpacity style={settingsStyles.tile} onPress={handleLeave}>
                                <View style={[settingsStyles.tileIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                    <Ionicons name="exit-outline" size={20} color="#EF4444" />
                                </View>
                                <Text style={[settingsStyles.tileName, { color: '#EF4444' }]}>Leave Group</Text>
                                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                            </TouchableOpacity>

                            <TouchableOpacity style={[settingsStyles.tile, { borderBottomWidth: 0 }]} onPress={handleDelete}>
                                <View style={[settingsStyles.tileIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </View>
                                <Text style={[settingsStyles.tileName, { color: '#EF4444' }]}>Delete Group</Text>
                                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        <View style={settingsStyles.section}>
                            <Text style={settingsStyles.sectionTitle}>Members ({currentMembers.length})</Text>
                            {currentMembers.map((m, i) => {
                                const u = m.user || m;
                                return (
                                    <View key={i} style={settingsStyles.memberRow}>
                                        <Avatar user={u} size={36} />
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={settingsStyles.memberName}>
                                                {u.fullName}
                                                {(u._id || u) === currentUser._id ? ' (You)' : ''}
                                            </Text>
                                            <Text style={settingsStyles.memberEmail}>{u.email}</Text>
                                        </View>
                                        {m.role === 'admin' && (
                                            <View style={settingsStyles.adminBadge}>
                                                <Text style={settingsStyles.adminBadgeText}>Admin</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </SafeAreaView>
            )}
        </Modal>
    );
};

const settingsStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F8F8' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
    subHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    subHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
    subBack: { width: 60, flexDirection: 'row', alignItems: 'center' },
    subHeaderAction: { width: 60, alignItems: 'flex-end' },
    subHeaderActionText: { fontSize: 16, fontWeight: '700', color: ORANGE },
    friendTag: {
        backgroundColor: '#FFF7ED', paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 4, marginLeft: 6, borderWidth: 1, borderColor: '#FED7AA'
    },
    friendTagText: { fontSize: 10, fontWeight: '700', color: ORANGE },
    body: { paddingBottom: 60 },
    groupHeader: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#FFF', marginBottom: 12 },
    groupName: { fontSize: 20, fontWeight: '800', color: '#171717', marginTop: 12 },
    groupType: { fontSize: 13, color: '#A3A3A3', marginTop: 4 },
    section: {
        backgroundColor: '#FFF', borderRadius: 16,
        marginHorizontal: 16, marginBottom: 12, overflow: 'hidden'
    },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: 0.5, padding: 16, paddingBottom: 8 },
    tile: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    tileIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginRight: 14
    },
    tileName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#262626' },
    editForm: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12 },
    editLabel: { fontSize: 12, fontWeight: '600', color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
    editInput: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E5E5',
        borderRadius: 10, paddingHorizontal: 14, height: 48, backgroundColor: '#FAFAFA'
    },
    editTextInput: { flex: 1, fontSize: 15, color: '#171717' },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    typeChip: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: '#E5E5E5',
        backgroundColor: '#FAFAFA', margin: 4
    },
    typeChipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
    typeChipText: { fontSize: 13, color: '#525252', marginLeft: 6 },
    typeChipTextActive: { color: '#FFF' },
    saveBtn: {
        backgroundColor: ORANGE, borderRadius: 12, height: 48,
        justifyContent: 'center', alignItems: 'center', marginTop: 16
    },
    saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#E5E5E5',
        borderRadius: 10, paddingHorizontal: 14, height: 48,
        backgroundColor: '#FAFAFA', marginHorizontal: 16, marginBottom: 8
    },
    searchDropdown: {
        marginHorizontal: 16, backgroundColor: '#FFF',
        borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', marginBottom: 8
    },
    searchItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    searchName: { fontSize: 14, fontWeight: '600', color: '#262626' },
    searchEmail: { fontSize: 12, color: '#A3A3A3' },
    alreadyText: { fontSize: 12, color: '#A3A3A3' },
    memberRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    memberName: { fontSize: 14, fontWeight: '600', color: '#262626' },
    memberEmail: { fontSize: 12, color: '#A3A3A3' },
    adminBadge: {
        backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 6, borderWidth: 1, borderColor: '#FED7AA'
    },
    adminBadgeText: { fontSize: 11, fontWeight: '700', color: ORANGE },
});

// ─── Group Detail Screen ──────────────────────────────────────────────────────
const GroupDetailScreen = ({ group: initialGroup, onBack, currentUser, onGroupUpdated, onGroupLeft, onGroupDeleted }) => {
    const [group, setGroup] = useState(initialGroup);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState(null);
    const [showAddExpense, setShowAddExpense] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [groupRes, expensesRes] = await Promise.all([
                getGroup(group._id),
                getGroupExpenses(group._id)
            ]);
            setGroup(groupRes.data);
            setExpenses(expensesRes.data || []);
        } catch { }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [group._id]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const getUserBalance = (expense) => {
        const payerId = expense.paidBy?._id || expense.paidBy || null;
        const split = (expense.splits || []).find(
            (s) => (s.user?._id || s.user) === currentUser._id
        );
        const myShare = split?.amount || 0;

        if (!payerId) {
            return { amount: myShare, type: 'orphan' };
        }
        if (payerId === currentUser._id) {
            const totalOwedToMe = (expense.splits || [])
                .filter((s) => (s.user?._id || s.user) !== currentUser._id)
                .reduce((acc, s) => acc + (s.amount || 0), 0);
            return { amount: totalOwedToMe, type: 'lent' };
        }
        if (myShare > 0) {
            return { amount: myShare, type: 'owed' };
        }
        return { amount: 0, type: 'none' };
    };

    const members = group.members || [];

    const sortedExpenses = useMemo(() => {
        return [...expenses].sort((a, b) => {
            const da = new Date(a.expenseDate || a.createdAt).getTime();
            const db = new Date(b.expenseDate || b.createdAt).getTime();
            return db - da;
        });
    }, [expenses]);

    return (
        <SafeAreaView style={gdStyles.container}>
            <View style={gdStyles.header}>
                <TouchableOpacity onPress={onBack} style={gdStyles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#262626" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={gdStyles.groupName} numberOfLines={1}>{group.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowSettings(true)} style={gdStyles.settingsBtn}>
                    <Ionicons name="settings-outline" size={22} color="#262626" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 60 }} />
            ) : (
                <FlatList
                    data={sortedExpenses}
                    keyExtractor={(item) => item._id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchData(); }}
                            tintColor={ORANGE}
                        />
                    }
                    ListHeaderComponent={() => (
                        <>
                            <TouchableOpacity style={gdStyles.membersStrip} onPress={() => setShowSettings(true)}>
                                <View style={gdStyles.avatarStack}>
                                    {members.slice(0, 5).map((m, i) => {
                                        const u = m.user || m;
                                        return (
                                            <View key={i} style={[gdStyles.stackedAvatar, { left: i * 22, zIndex: 5 - i }]}>
                                                <Avatar user={u} size={36} />
                                            </View>
                                        );
                                    })}
                                    {members.length > 5 && (
                                        <View style={[gdStyles.stackedAvatar, gdStyles.moreAvatar, { left: 5 * 22, zIndex: 0 }]}>
                                            <Text style={gdStyles.moreText}>+{members.length - 5}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ marginLeft: members.length > 5 ? members.length * 12 + 50 : members.slice(0, 5).length * 22 + 20 }}>
                                    <Text style={gdStyles.memberCount}>{members.length} Members</Text>
                                    <Text style={gdStyles.memberTap}>Tap to manage</Text>
                                </View>
                            </TouchableOpacity>

                            <Text style={gdStyles.expensesTitle}>Expenses</Text>
                            {expenses.length === 0 && (
                                <View style={gdStyles.emptyExpenses}>
                                    <Ionicons name="receipt-outline" size={48} color="#E5E5E5" />
                                    <Text style={gdStyles.emptyText}>No expenses yet</Text>
                                </View>
                            )}
                        </>
                    )}
                    renderItem={({ item: exp }) => {
                        const balance = getUserBalance(exp);
                        const payerId = exp.paidBy?._id || exp.paidBy || null;
                        const paidByMe = payerId === currentUser._id;
                        const payerName =
                            exp.paidBy?.fullName ||
                            exp.paidBy?.email ||
                            (payerId ? 'Someone' : '(deleted user)');
                        return (
                            <TouchableOpacity
                                style={gdStyles.expenseRow}
                                onPress={() => setSelectedExpense(exp)}
                                activeOpacity={0.7}
                            >
                                <View style={gdStyles.expenseIcon}>
                                    <Ionicons name="receipt-outline" size={18} color={ORANGE} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={gdStyles.expenseTitle} numberOfLines={1}>{exp.title}</Text>
                                    <Text style={gdStyles.expenseDate}>{formatDate(exp.expenseDate || exp.createdAt)}</Text>
                                    <Text style={gdStyles.expensePayer}>
                                        {paidByMe ? 'You paid' : `${payerName} paid`} · {formatAmount(exp.amount)}
                                    </Text>
                                </View>
                                {balance.amount > 0 && balance.type !== 'none' && balance.type !== 'orphan' && (
                                    <View style={gdStyles.balanceWrap}>
                                        <Text style={[gdStyles.balanceAmount, balance.type === 'lent' ? gdStyles.lentColor : gdStyles.owedColor]}>
                                            {balance.type === 'lent' ? 'you lent' : 'you owe'}
                                        </Text>
                                        <Text style={[gdStyles.balanceValue, balance.type === 'lent' ? gdStyles.lentColor : gdStyles.owedColor]}>
                                            {formatAmount(balance.amount)}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <GroupSettingsModal
                group={group}
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                currentUser={currentUser}
                onGroupUpdated={(updated) => {
                    setGroup(updated);
                    onGroupUpdated(updated);
                }}
                onGroupLeft={(id) => {
                    onGroupLeft(id);
                    onBack();
                }}
                onGroupDeleted={(id) => {
                    onGroupDeleted(id);
                    onBack();
                }}
            />

            <ExpenseDetailModal
                expense={selectedExpense}
                visible={!!selectedExpense}
                onClose={() => setSelectedExpense(null)}
                onUpdated={() => { setSelectedExpense(null); fetchData(); }}
                onDeleted={() => { setSelectedExpense(null); fetchData(); }}
                currentUser={currentUser}
            />

            <TouchableOpacity
                style={gdStyles.fab}
                onPress={() => setShowAddExpense(true)}
                activeOpacity={0.85}
            >
                <Ionicons name="add" size={28} color="#FFF" />
            </TouchableOpacity>

            <AddExpenseModal
                visible={showAddExpense}
                onClose={() => setShowAddExpense(false)}
                onCreated={() => { setShowAddExpense(false); fetchData(); }}
                currentUser={currentUser}
                prefillGroup={group}
            />
        </SafeAreaView>
    );
};

const gdStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F8F8' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    backBtn: { padding: 4, marginRight: 8 },
    groupName: { fontSize: 28, fontWeight: '700', color: '#171717' },
    settingsBtn: { padding: 4, marginLeft: 8 },
    membersStrip: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16,
        borderRadius: 14, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
    },
    avatarStack: { flexDirection: 'row', height: 36, position: 'relative', width: 80 },
    stackedAvatar: { position: 'absolute', top: 0, borderWidth: 2, borderColor: '#FFF', borderRadius: 18 },
    moreAvatar: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center'
    },
    moreText: { fontSize: 11, fontWeight: '700', color: '#525252' },
    memberCount: { fontSize: 14, fontWeight: '700', color: '#171717' },
    memberTap: { fontSize: 12, color: ORANGE, marginTop: 2 },
    expensesTitle: { fontSize: 16, fontWeight: '700', color: '#525252', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
    emptyExpenses: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: '#BDBDBD', marginTop: 12 },
    expenseRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 10,
        borderRadius: 14, padding: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
    },
    expenseIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginRight: 12
    },
    expenseTitle: { fontSize: 14, fontWeight: '600', color: '#171717', marginBottom: 2 },
    expenseDate: { fontSize: 12, color: '#A3A3A3' },
    expensePayer: { fontSize: 12, color: '#737373', marginTop: 2 },
    balanceWrap: { alignItems: 'flex-end' },
    balanceAmount: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
    balanceValue: { fontSize: 14, fontWeight: '800' },
    lentColor: { color: '#10B981' },
    owedColor: { color: '#EF4444' },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 28,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: ORANGE,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
});

// ─── Create Group Modal ───────────────────────────────────────────────────────
const CreateGroupModal = ({ visible, onClose, onCreated, currentUser }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('friends');
    const [image, setImage] = useState(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    React.useEffect(() => {
        if (visible) {
            setName(''); setType('friends'); setImage(null); setErrors({});
        }
    }, [visible]);

    const toDataUri = (asset) =>
        asset?.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset?.uri;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Grant camera roll permissions to add a group photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true
        });
        if (!result.canceled && result.assets[0]) {
            setImage(toDataUri(result.assets[0]));
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Grant camera permissions to take a photo.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true
        });
        if (!result.canceled && result.assets[0]) {
            setImage(toDataUri(result.assets[0]));
        }
    };

    const handleImagePress = () => {
        Alert.alert('Group Photo', 'Choose an option', [
            { text: 'Take Photo', onPress: takePhoto },
            { text: 'Choose from Library', onPress: pickImage },
            { text: 'Cancel', style: 'cancel' }
        ]);
    };

    const handleCreate = async () => {
        const errs = {};
        if (!name.trim()) errs.name = 'Group name is required';
        if (!type) errs.type = 'Select a group type';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setSaving(true);
        try {
            const res = await createGroup({ name: name.trim(), type, avatar: image || null });
            onCreated(res.data);
            onClose();
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Failed to create group');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={cgStyles.container}>
                    <View style={cgStyles.header}>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#262626" />
                        </TouchableOpacity>
                        <Text style={cgStyles.headerTitle}>New Group</Text>
                        <TouchableOpacity
                            onPress={handleCreate}
                            disabled={saving}
                            style={[cgStyles.createBtn, saving && { opacity: 0.5 }]}
                        >
                            {saving ? <ActivityIndicator color={ORANGE} size="small" /> : <Text style={cgStyles.createBtnText}>Create</Text>}
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={cgStyles.body} keyboardShouldPersistTaps="handled">
                        <View style={cgStyles.imageSection}>
                            <TouchableOpacity style={cgStyles.imagePickerWrap} onPress={handleImagePress}>
                                {image ? (
                                    <Image source={{ uri: image }} style={cgStyles.imagePreview} />
                                ) : (
                                    <View style={cgStyles.imagePlaceholder}>
                                        <Ionicons name="camera-outline" size={28} color="#A3A3A3" />
                                        <Text style={cgStyles.imagePlaceholderText}>Add Photo</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <Text style={cgStyles.imageHint}>
                                {image ? 'Tap to change' : 'Optional group photo'}
                            </Text>
                        </View>

                        <View style={cgStyles.fieldGroup}>
                            <Text style={cgStyles.fieldLabel}>Group Name *</Text>
                            <View style={[cgStyles.inputWrap, errors.name && cgStyles.inputError]}>
                                <Ionicons name="people-outline" size={18} color="#A3A3A3" style={{ marginRight: 10 }} />
                                <TextInput
                                    style={cgStyles.input}
                                    placeholder="e.g. Thailand Trip 2025"
                                    placeholderTextColor="#A3A3A3"
                                    value={name}
                                    onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: null })); }}
                                />
                            </View>
                            {errors.name && <Text style={cgStyles.errorText}>{errors.name}</Text>}
                        </View>

                        <View style={cgStyles.fieldGroup}>
                            <Text style={cgStyles.fieldLabel}>Group Type *</Text>
                            {errors.type && <Text style={cgStyles.errorText}>{errors.type}</Text>}
                            <View style={cgStyles.typeGrid}>
                                {GROUP_TYPES.map((t) => (
                                    <TouchableOpacity
                                        key={t.id}
                                        onPress={() => setType(t.id)}
                                        style={[cgStyles.typeCard, type === t.id && cgStyles.typeCardActive]}
                                    >
                                        <View style={[cgStyles.typeIcon, type === t.id && cgStyles.typeIconActive]}>
                                            <Ionicons name={t.icon} size={22} color={type === t.id ? '#FFF' : '#737373'} />
                                        </View>
                                        <Text style={[cgStyles.typeLabel, type === t.id && cgStyles.typeLabelActive]}>
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const cgStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },
    createBtn: { paddingVertical: 4, paddingHorizontal: 4 },
    createBtnText: { fontSize: 16, fontWeight: '700', color: ORANGE },
    body: { padding: 20, paddingBottom: 60 },
    imageSection: { alignItems: 'center', marginBottom: 28 },
    imagePickerWrap: {
        width: 100, height: 100, borderRadius: 50,
        overflow: 'hidden', marginBottom: 8
    },
    imagePlaceholder: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#E5E5E5', borderStyle: 'dashed'
    },
    imagePlaceholderText: { fontSize: 12, color: '#A3A3A3', marginTop: 4 },
    imagePreview: { width: 100, height: 100, borderRadius: 50 },
    imageHint: { fontSize: 12, color: '#A3A3A3' },
    fieldGroup: { marginBottom: 24 },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: '#525252', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FAFAFA', borderRadius: 12,
        borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 14, height: 52
    },
    inputError: { borderColor: '#EF4444' },
    input: { flex: 1, fontSize: 15, color: '#171717' },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
    typeCard: {
        width: '30%', margin: '1.5%',
        alignItems: 'center', paddingVertical: 14, borderRadius: 14,
        borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FAFAFA'
    },
    typeCardActive: { borderColor: ORANGE, backgroundColor: '#FFF7ED' },
    typeIcon: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginBottom: 6
    },
    typeIconActive: { backgroundColor: ORANGE },
    typeLabel: { fontSize: 12, fontWeight: '600', color: '#525252' },
    typeLabelActive: { color: ORANGE },
});

// ─── Group Card ───────────────────────────────────────────────────────────────
const GroupCard = ({ group, onPress }) => {
    const memberCount = group.members?.length || 0;
    const type = GROUP_TYPES.find((t) => t.id === group.type) || GROUP_TYPES[5];
    return (
        <TouchableOpacity style={gcStyles.card} onPress={onPress} activeOpacity={0.75}>
            <GroupIcon group={group} size={52} />
            <View style={gcStyles.info}>
                <Text style={gcStyles.name} numberOfLines={1}>{group.name}</Text>
                <Text style={gcStyles.meta}>
                    <Ionicons name={type.icon} size={11} color="#A3A3A3" /> {type.label} · {memberCount} member{memberCount !== 1 ? 's' : ''}
                </Text>
                <Text style={gcStyles.activity}>
                    Active {formatDate(group.lastActivityAt || group.updatedAt)}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D4D4D4" />
        </TouchableOpacity>
    );
};

const gcStyles = StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', padding: 16, borderRadius: 14, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
    },
    info: { flex: 1, marginLeft: 14 },
    name: { fontSize: 16, fontWeight: '700', color: '#171717', marginBottom: 3 },
    meta: { fontSize: 12, color: '#A3A3A3', marginBottom: 2 },
    activity: { fontSize: 11, color: '#BDBDBD' },
});

// ─── Main Groups Screen ───────────────────────────────────────────────────────
const GroupsScreen = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await getGroups();
            setGroups(res.data || []);
        } catch { }
        finally { setLoading(false); setRefreshing(false); }
    }, []);

    React.useEffect(() => { fetchGroups(); }, [fetchGroups]);

    if (selectedGroup) {
        return (
            <GroupDetailScreen
                group={selectedGroup}
                onBack={() => setSelectedGroup(null)}
                currentUser={user}
                onGroupUpdated={(updated) => {
                    setGroups((prev) => prev.map((g) => g._id === updated._id ? updated : g));
                    setSelectedGroup(updated);
                }}
                onGroupLeft={(id) => {
                    setGroups((prev) => prev.filter((g) => g._id !== id));
                    setSelectedGroup(null);
                }}
                onGroupDeleted={(id) => {
                    setGroups((prev) => prev.filter((g) => g._id !== id));
                    setSelectedGroup(null);
                }}
            />
        );
    }

    return (
        <SafeAreaView style={glStyles.container}>
            <View style={glStyles.header}>
                <Text style={glStyles.headerTitle}>Groups</Text>
                <TouchableOpacity style={glStyles.addBtn} onPress={() => setShowCreate(true)}>
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 60 }} />
            ) : groups.length === 0 ? (
                <View style={glStyles.emptyWrap}>
                    <Ionicons name="people-outline" size={64} color="#E5E5E5" />
                    <Text style={glStyles.emptyTitle}>No groups yet</Text>
                    <Text style={glStyles.emptySubtitle}>Create a group to split expenses together</Text>
                    <TouchableOpacity style={glStyles.emptyBtn} onPress={() => setShowCreate(true)}>
                        <Ionicons name="add" size={18} color="#FFF" />
                        <Text style={glStyles.emptyBtnText}>Create Group</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={groups}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <GroupCard group={item} onPress={() => setSelectedGroup(item)} />
                    )}
                    contentContainerStyle={glStyles.list}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchGroups(); }}
                            tintColor={ORANGE}
                        />
                    }
                />
            )}

            <CreateGroupModal
                visible={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={(group) => setGroups((prev) => [group, ...prev])}
                currentUser={user}
            />
        </SafeAreaView>
    );
};

const glStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F8F8' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingVertical: 16,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F5'
    },
    headerTitle: { fontSize: 28, fontWeight: '700', color: '#171717' },
    addBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center'
    },
    list: { padding: 16, paddingTop: 12 },
    emptyWrap: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#A3A3A3', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#BDBDBD', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
    emptyBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: ORANGE, paddingHorizontal: 20, paddingVertical: 12,
        borderRadius: 24, marginTop: 24
    },
    emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15, marginLeft: 6 },
});

export default GroupsScreen;

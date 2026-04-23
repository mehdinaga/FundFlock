// src/screens/friends/AddFriendScreen.js
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, ActivityIndicator, Share, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { searchUserByEmail, sendFriendRequest } from '../../api/friends';
import { useAuth } from '../../context/AuthContext';

const COLORS = {
    primary: '#F97316',
    background: '#FFFFFF',
    text: '#171717',
    textSecondary: '#737373',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    inputBg: '#FAFAFA',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
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

const AddFriendScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState(null);
    const [requestSent, setRequestSent] = useState(false);

    const isValidEmail = (e) => /^\S+@\S+\.\S+$/.test(e);

    const handleSearch = async () => {
        if (!email.trim()) {
            setSearchError('Please enter an email address');
            return;
        }
        if (!isValidEmail(email.trim())) {
            setSearchError('Please enter a valid email address');
            return;
        }

        setSearching(true);
        setSearchError(null);
        setSearchResult(null);
        setRequestSent(false);

        try {
            const result = await searchUserByEmail(email.trim());
            if (result.success) {
                setSearchResult(result.data);
            }
        } catch (error) {
            const errorCode = error?.error?.code;
            if (errorCode === 'USER_NOT_FOUND') {
                setSearchError('No user found with this email on FundFlock');
            } else if (errorCode === 'SELF_SEARCH') {
                setSearchError('This is your own email address');
            } else {
                setSearchError(error?.error?.message || 'Search failed');
            }
        } finally {
            setSearching(false);
        }
    };

    const handleSendRequest = async () => {
        if (!searchResult?.user?.email) return;

        setSending(true);
        try {
            const result = await sendFriendRequest(searchResult.user.email);
            if (result.success) {
                setRequestSent(true);
                Alert.alert('Success', result.message || 'Friend request sent!');
            }
        } catch (error) {
            Alert.alert('Error', error?.error?.message || 'Failed to send friend request');
        } finally {
            setSending(false);
        }
    };

    const handleInviteLink = async () => {
        try {
            const link = Linking.createURL(`invite/${user?._id}`);
            await Clipboard.setStringAsync(link);
            Alert.alert(
                'Link Copied!',
                'Invite link has been copied to your clipboard. Share it with your friends!',
                [
                    { text: 'OK' },
                    {
                        text: 'Share',
                        onPress: () => {
                            Share.share({
                                message: `Join me on FundFlock! Add me as a friend: ${link}`,
                                title: 'FundFlock Invite',
                            });
                        }
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to generate invite link');
        }
    };

    const getStatusBadge = () => {
        if (requestSent) {
            return { text: 'Request Sent', color: COLORS.success, bgColor: '#ECFDF5' };
        }
        if (!searchResult?.friendshipStatus) return null;

        switch (searchResult.friendshipStatus) {
            case 'accepted':
                return { text: 'Already Friends', color: COLORS.success, bgColor: '#ECFDF5' };
            case 'pending':
                return { text: 'Request Pending', color: COLORS.warning, bgColor: '#FFFBEB' };
            default:
                return null;
        }
    };

    const statusBadge = getStatusBadge();
    const canSendRequest = searchResult && !searchResult.friendshipStatus && !requestSent;

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
                <Text style={styles.headerTitle}>Add Friend</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Invite Options */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Invite to FundFlock</Text>

                        <TouchableOpacity
                            style={styles.optionRow}
                            onPress={handleInviteLink}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="link-outline" size={22} color="#3B82F6" />
                            </View>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionTitle}>Invite via link</Text>
                                <Text style={styles.optionSubtitle}>Copy or share your invite link</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.optionRow}
                            onPress={() => navigation.navigate('QRInvite')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: '#F5F3FF' }]}>
                                <Ionicons name="qr-code-outline" size={22} color="#8B5CF6" />
                            </View>
                            <View style={styles.optionInfo}>
                                <Text style={styles.optionTitle}>Scan QR code</Text>
                                <Text style={styles.optionSubtitle}>Generate or scan a QR code</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Search by Email */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Add by email</Text>

                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter email address"
                                placeholderTextColor={COLORS.textMuted}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setSearchError(null);
                                    setSearchResult(null);
                                    setRequestSent(false);
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.searchButton, (!email.trim() || searching) && styles.searchButtonDisabled]}
                            onPress={handleSearch}
                            disabled={!email.trim() || searching}
                            activeOpacity={0.8}
                        >
                            {searching ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="search" size={20} color="#FFFFFF" />
                                    <Text style={styles.searchButtonText}>Search</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Search Error */}
                    {searchError && (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                            <Text style={styles.errorText}>{searchError}</Text>
                        </View>
                    )}

                    {/* Search Result */}
                    {searchResult && (
                        <View style={styles.resultCard}>
                            <View style={styles.resultUser}>
                                <View style={[styles.resultAvatar, { backgroundColor: getAvatarColor(searchResult.user.fullName) }]}>
                                    <Text style={styles.resultAvatarText}>
                                        {getInitials(searchResult.user.fullName)}
                                    </Text>
                                </View>
                                <View style={styles.resultInfo}>
                                    <Text style={styles.resultName}>{searchResult.user.fullName}</Text>
                                    <Text style={styles.resultEmail}>{searchResult.user.email}</Text>
                                </View>
                            </View>

                            {statusBadge && (
                                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                                    <Ionicons
                                        name={requestSent || searchResult.friendshipStatus === 'accepted' ? 'checkmark-circle' : 'time'}
                                        size={16}
                                        color={statusBadge.color}
                                    />
                                    <Text style={[styles.statusText, { color: statusBadge.color }]}>
                                        {statusBadge.text}
                                    </Text>
                                </View>
                            )}

                            {canSendRequest && (
                                <TouchableOpacity
                                    style={styles.sendRequestButton}
                                    onPress={handleSendRequest}
                                    disabled={sending}
                                    activeOpacity={0.8}
                                >
                                    {sending ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="person-add" size={18} color="#FFFFFF" />
                                            <Text style={styles.sendRequestText}>Send Request</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
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
        paddingHorizontal: 24,
    },
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    optionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionInfo: {
        flex: 1,
        marginLeft: 14,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    optionSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    divider: {
        height: 8,
        backgroundColor: '#F5F5F5',
        marginHorizontal: -24,
        marginTop: 24,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 56,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 12,
        marginTop: 12,
    },
    searchButtonDisabled: {
        opacity: 0.5,
    },
    searchButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        padding: 16,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorText: {
        fontSize: 14,
        color: COLORS.danger,
        flex: 1,
    },
    resultCard: {
        marginTop: 16,
        padding: 20,
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    resultUser: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    resultAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    resultInfo: {
        flex: 1,
        marginLeft: 14,
    },
    resultName: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    resultEmail: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginTop: 16,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    sendRequestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        height: 48,
        borderRadius: 12,
        marginTop: 16,
    },
    sendRequestText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default AddFriendScreen;

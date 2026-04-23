// src/screens/profile/ProfileScreen.js
import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, Alert, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { generateInviteLink } from '../../api/friends';

const COLORS = {
    primary: '#F97316',
    background: '#FFFFFF',
    text: '#171717',
    textSecondary: '#737373',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    danger: '#EF4444',
};

const AVATAR_COLORS = [
    '#F97316', '#3B82F6', '#10B981', '#8B5CF6',
    '#EF4444', '#EC4899', '#14B8A6', '#F59E0B',
];

const getAvatarColor = (name) => {
    if (!name) return AVATAR_COLORS[0];
    const index = name.charCodeAt(0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
};

const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
};

const ProfileScreen = ({ navigation }) => {
    const { user, logout } = useAuth();

    const handleInviteLink = async () => {
        try {
            const result = await generateInviteLink();
            if (result.success) {
                const link = result.data.inviteLink;
                await Clipboard.setStringAsync(link);
                Alert.alert(
                    'Link Copied!',
                    'Invite link copied to clipboard.',
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
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to generate invite link');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: () => logout()
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Info */}
                <View style={styles.profileSection}>
                    <View style={[styles.avatar, { backgroundColor: getAvatarColor(user?.fullName) }]}>
                        <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>
                    </View>
                    <Text style={styles.profileName}>{user?.fullName}</Text>
                    <Text style={styles.profileEmail}>{user?.email}</Text>
                </View>

                {/* Add Friends Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Add Friends</Text>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleInviteLink}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="link-outline" size={20} color="#3B82F6" />
                        </View>
                        <View style={styles.menuInfo}>
                            <Text style={styles.menuTitle}>Invite via link</Text>
                            <Text style={styles.menuSubtitle}>Copy or share your invite link</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate('QRInviteFromProfile')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: '#F5F3FF' }]}>
                            <Ionicons name="qr-code-outline" size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.menuInfo}>
                            <Text style={styles.menuTitle}>Show my QR code</Text>
                            <Text style={styles.menuSubtitle}>Let friends scan to add you</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate('EditProfile')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: '#FFF7ED' }]}>
                            <Ionicons name="person-outline" size={20} color={COLORS.primary} />
                        </View>
                        <View style={styles.menuInfo}>
                            <Text style={styles.menuTitle}>Edit Profile</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => navigation.navigate('EditProfile')}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: '#F0FDF4' }]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#10B981" />
                        </View>
                        <View style={styles.menuInfo}>
                            <Text style={styles.menuTitle}>Change Password</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Logout */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
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
    content: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 32,
        borderBottomWidth: 8,
        borderBottomColor: '#F5F5F5',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.text,
    },
    profileEmail: {
        fontSize: 15,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    section: {
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuInfo: {
        flex: 1,
        marginLeft: 14,
    },
    menuTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    menuSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    logoutButton: {
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
    logoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.danger,
    },
});

export default ProfileScreen;

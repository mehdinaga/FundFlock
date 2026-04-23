// src/screens/profile/EditProfileScreen.js
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, ActivityIndicator, ScrollView,
    KeyboardAvoidingView, Platform, Image, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { changePassword, updateProfile, deleteAccount } from '../../api/auth';

const COLORS = {
    primary: '#F97316',
    background: '#FFFFFF',
    text: '#171717',
    textSecondary: '#737373',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    inputBg: '#FAFAFA',
    danger: '#EF4444',
    dangerDark: '#DC2626',
};

const EditProfileScreen = ({ navigation }) => {
    const { user, logout, updateUser } = useAuth();
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [deletePasswordInput, setDeletePasswordInput] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [profileImage, setProfileImage] = useState(user?.avatar || null);

    // Edit mode states
    const [editingField, setEditingField] = useState(null);

    // Convert the picked asset to a self-contained data URI so it can be
    // stored on the user record and survive logout/reinstall. A raw
    // `file://` URI only exists on the originating device — which is why
    // the avatar used to "disappear" after signing back in. Groups already
    // use this base64 pattern, so we mirror it here.
    const toDataUri = (asset) =>
        asset?.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset?.uri;

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a profile picture.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            setProfileImage(toDataUri(result.assets[0]));
        }
    };

    const handleSave = async () => {
        const newErrors = {};
        if (!fullName.trim()) newErrors.fullName = 'Full name is required';
        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Please enter a valid email';

        // Password validation
        if (newPassword || currentPassword) {
            if (!currentPassword) newErrors.currentPassword = 'Current password is required';
            if (!newPassword) newErrors.newPassword = 'New password is required';
            else if (newPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters';
            else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
                newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
            }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setLoading(true);
        try {
            // Change password if provided
            if (currentPassword && newPassword) {
                await changePassword(currentPassword, newPassword);
                setCurrentPassword('');
                setNewPassword('');
                setEditingField(null);
            }

            // Update profile (fullName, email, avatar)
            const profileData = {
                fullName: fullName.trim(),
                email: email.trim(),
                avatar: profileImage || null
            };

            const response = await updateProfile(profileData);

            // Update user in context
            if (response?.data) {
                updateUser(response.data);
            }

            Alert.alert('Success', 'Profile updated successfully!');
            navigation.goBack();
        } catch (error) {
            console.log('Save error:', error);
            if (error.error?.code === 'INVALID_PASSWORD') {
                setErrors({ currentPassword: 'Current password is incorrect' });
            } else if (error.error?.code === 'EMAIL_EXISTS') {
                setErrors({ email: 'This email is already in use' });
            } else if (error.error?.message) {
                Alert.alert('Error', error.error.message);
            } else {
                Alert.alert('Error', 'Failed to update profile');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => setShowDeleteConfirm(true)
                }
            ]
        );
    };

    const confirmDeleteAccount = async () => {
        if (!deletePasswordInput) {
            Alert.alert('Error', 'Please enter your password to confirm deletion');
            return;
        }

        setDeleting(true);
        try {
            await deleteAccount(deletePasswordInput);
            Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
            logout();
        } catch (error) {
            console.log('Delete error:', error);
            if (error.error?.code === 'INVALID_PASSWORD') {
                Alert.alert('Error', 'Password is incorrect');
            } else {
                Alert.alert('Error', error.error?.message || 'Failed to delete account');
            }
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
            setDeletePasswordInput('');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {/* Profile Image */}
                    <View style={styles.imageSection}>
                        <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={styles.profileImage} />
                            ) : (
                                <View style={styles.imagePlaceholder}>
                                    <Text style={styles.imageText}>{user?.fullName?.charAt(0)?.toUpperCase()}</Text>
                                </View>
                            )}
                            <View style={styles.imageOverlay}>
                                <Ionicons name="camera" size={20} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.imageHint}>Tap to change photo</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>

                        {/* Full Name Field */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Full Name</Text>
                                <TouchableOpacity onPress={() => setEditingField(editingField === 'name' ? null : 'name')} style={styles.editButton}>
                                    <Ionicons name="pencil" size={16} color={COLORS.primary} />
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                            {editingField === 'name' ? (
                                <View style={[styles.inputWrapper, errors.fullName && styles.inputError]}>
                                    <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
                                    <TextInput
                                        style={styles.input}
                                        value={fullName}
                                        onChangeText={(text) => { setFullName(text); if (errors.fullName) setErrors({ ...errors, fullName: null }); }}
                                        placeholder="Enter your full name"
                                        placeholderTextColor={COLORS.textMuted}
                                        autoFocus
                                    />
                                </View>
                            ) : (
                                <View style={styles.displayValue}>
                                    <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
                                    <Text style={styles.displayText}>{fullName || 'Not set'}</Text>
                                </View>
                            )}
                            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                        </View>

                        {/* Email Field */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Email</Text>
                                <TouchableOpacity onPress={() => setEditingField(editingField === 'email' ? null : 'email')} style={styles.editButton}>
                                    <Ionicons name="pencil" size={16} color={COLORS.primary} />
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                            {editingField === 'email' ? (
                                <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                                    <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
                                    <TextInput
                                        style={styles.input}
                                        value={email}
                                        onChangeText={(text) => { setEmail(text); if (errors.email) setErrors({ ...errors, email: null }); }}
                                        placeholder="Enter your email"
                                        placeholderTextColor={COLORS.textMuted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoFocus
                                    />
                                </View>
                            ) : (
                                <View style={styles.displayValue}>
                                    <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
                                    <Text style={styles.displayText}>{email || 'Not set'}</Text>
                                </View>
                            )}
                            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                        </View>

                        {/* Phone Number - Coming Soon */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>Phone Number</Text>
                            </View>
                            <View style={styles.displayValue}>
                                <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                                <Text style={styles.displayText}>Coming soon</Text>
                            </View>
                        </View>

                        {/* Change Password Section */}
                        <View style={styles.fieldContainer}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 0 }]}>Change Password</Text>
                                <TouchableOpacity onPress={() => setEditingField(editingField === 'password' ? null : 'password')} style={styles.editButton}>
                                    <Ionicons name="pencil" size={16} color={COLORS.primary} />
                                    <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            {editingField === 'password' ? (
                                <View style={{ marginTop: 12 }}>
                                    <Text style={[styles.label, { marginBottom: 8 }]}>Current Password</Text>
                                    <View style={[styles.inputWrapper, errors.currentPassword && styles.inputError, { marginBottom: 4 }]}>
                                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
                                        <TextInput
                                            style={styles.input}
                                            value={currentPassword}
                                            onChangeText={setCurrentPassword}
                                            placeholder="Enter current password"
                                            placeholderTextColor={COLORS.textMuted}
                                            secureTextEntry={!showCurrentPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 8 }}>
                                            <Ionicons name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                    {errors.currentPassword && <Text style={[styles.errorText, { marginBottom: 8 }]}>{errors.currentPassword}</Text>}

                                    <Text style={[styles.label, { marginBottom: 8, marginTop: 12 }]}>New Password</Text>
                                    <View style={[styles.inputWrapper, errors.newPassword && styles.inputError]}>
                                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
                                        <TextInput
                                            style={styles.input}
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            placeholder="Enter new password"
                                            placeholderTextColor={COLORS.textMuted}
                                            secureTextEntry={!showNewPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 8 }}>
                                            <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                    {errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}

                                    <Text style={styles.passwordHint}>
                                        Password must be at least 8 characters with uppercase, lowercase, and number
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[styles.saveButton, loading && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                    </TouchableOpacity>

                    {/* Delete Account */}
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDeleteAccount}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={20} color={COLORS.dangerDark} />
                        <Text style={styles.deleteButtonText}>Delete Account</Text>
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* Delete Confirmation Modal */}
                <Modal
                    visible={showDeleteConfirm}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        setShowDeleteConfirm(false);
                        setDeletePasswordInput('');
                    }}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Confirm Deletion</Text>
                            <Text style={styles.modalDescription}>
                                Enter your password to confirm account deletion.
                            </Text>
                            <View style={[styles.inputWrapper, { marginTop: 16 }]}>
                                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
                                <TextInput
                                    style={styles.input}
                                    value={deletePasswordInput}
                                    onChangeText={setDeletePasswordInput}
                                    placeholder="Enter your password"
                                    placeholderTextColor={COLORS.textMuted}
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalCancelButton}
                                    onPress={() => {
                                        setShowDeleteConfirm(false);
                                        setDeletePasswordInput('');
                                    }}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalDeleteButton, deleting && styles.buttonDisabled]}
                                    onPress={confirmDeleteAccount}
                                    disabled={deleting}
                                >
                                    {deleting ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={styles.modalDeleteText}>Delete</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
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
        paddingHorizontal: 16,
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
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    // Profile Image
    imageSection: {
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 24,
    },
    imageContainer: {
        position: 'relative',
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    imagePlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageText: {
        fontSize: 40,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.text,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    imageHint: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 12,
    },
    // Form
    form: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 16,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#525252',
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    editButtonText: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '500',
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 16,
        height: 52,
    },
    inputError: {
        borderColor: COLORS.danger,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        marginLeft: 12,
        paddingVertical: 8,
    },
    displayValue: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 52,
    },
    displayText: {
        fontSize: 16,
        color: COLORS.text,
        marginLeft: 12,
    },
    errorText: {
        color: COLORS.danger,
        fontSize: 13,
        marginTop: 6,
        marginLeft: 4,
    },
    passwordHint: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 12,
    },
    // Save Button
    saveButton: {
        backgroundColor: COLORS.primary,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    // Delete Account
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    deleteButtonText: {
        color: COLORS.dangerDark,
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 8,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    modalDescription: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        height: 48,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#525252',
    },
    modalDeleteButton: {
        flex: 1,
        height: 48,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.dangerDark,
    },
    modalDeleteText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default EditProfileScreen;

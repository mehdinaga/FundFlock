// frontend/src/screens/auth/ResetPasswordScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resetPassword } from '../../api/auth';

const ResetPasswordScreen = ({ navigation, route }) => {
    const { email } = route.params || {};
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Password strength calculation
    const getPasswordStrength = () => {
        if (newPassword.length === 0) return { strength: 0, label: '', color: '#E5E5E5' };

        let strength = 0;
        if (newPassword.length >= 8) strength += 25;
        if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength += 25;
        if (/\d/.test(newPassword)) strength += 25;
        if (/[^a-zA-Z0-9]/.test(newPassword)) strength += 25;

        if (strength <= 25) return { strength, label: 'Weak 😕', color: '#EF4444' };
        if (strength <= 50) return { strength, label: 'Fair 🙂', color: '#F59E0B' };
        if (strength <= 75) return { strength, label: 'Good 😊', color: '#10B981' };
        return { strength, label: 'Strong 💪', color: '#10B981' };
    };

    const passwordStrength = getPasswordStrength();

    const validateForm = () => {
        const newErrors = {};

        if (!resetCode.trim()) {
            newErrors.resetCode = 'Reset code is required';
        }

        if (!newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters';
        } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleResetPassword = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            await resetPassword(resetCode.trim(), newPassword);

            // Show success message
            Alert.alert(
                'Success! 🎉',
                'Your password has been reset successfully.',
                [
                    {
                        text: 'Login Now',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Reset password error:', error);

            if (error.error?.code === 'INVALID_TOKEN') {
                setErrors({ resetCode: 'Invalid or expired reset code' });
            } else {
                Alert.alert('Error', error.error?.message || 'Failed to reset password');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#262626" />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Reset Password 🔐</Text>
                    <Text style={styles.subtitle}>
                        Enter the code we sent to {email}
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    {/* Reset Code Input */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Reset Code</Text>
                        <View style={[styles.inputWrapper, errors.resetCode && styles.inputError]}>
                            <Ionicons name="key-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter 6-digit code"
                                placeholderTextColor="#A3A3A3"
                                value={resetCode}
                                onChangeText={(text) => {
                                    setResetCode(text);
                                    if (errors.resetCode) setErrors({ ...errors, resetCode: null });
                                }}
                                keyboardType="number-pad"
                                maxLength={64}
                                returnKeyType="next"
                            />
                        </View>
                        {errors.resetCode && (
                            <Text style={styles.errorText}>{errors.resetCode}</Text>
                        )}
                    </View>

                    {/* New Password Input */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>New Password</Text>
                        <View style={[styles.inputWrapper, errors.newPassword && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Enter new password"
                                placeholderTextColor="#A3A3A3"
                                value={newPassword}
                                onChangeText={(text) => {
                                    setNewPassword(text);
                                    if (errors.newPassword) setErrors({ ...errors, newPassword: null });
                                }}
                                secureTextEntry={!showPassword}
                                returnKeyType="next"
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#737373"
                                />
                            </TouchableOpacity>
                        </View>
                        {errors.newPassword && (
                            <Text style={styles.errorText}>{errors.newPassword}</Text>
                        )}
                    </View>

                    {/* Password Strength Meter */}
                    {newPassword.length > 0 && (
                        <View style={styles.passwordStrengthContainer}>
                            <View style={styles.passwordStrengthBar}>
                                <View
                                    style={[
                                        styles.passwordStrengthFill,
                                        {
                                            width: `${passwordStrength.strength}%`,
                                            backgroundColor: passwordStrength.color,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                                {passwordStrength.label}
                            </Text>
                        </View>
                    )}

                    {/* Confirm Password Input */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Confirm Password</Text>
                        <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm new password"
                                placeholderTextColor="#A3A3A3"
                                value={confirmPassword}
                                onChangeText={(text) => {
                                    setConfirmPassword(text);
                                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null });
                                }}
                                secureTextEntry={!showConfirmPassword}
                                returnKeyType="done"
                                onSubmitEditing={handleResetPassword}
                            />
                            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                <Ionicons
                                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#737373"
                                />
                            </TouchableOpacity>
                        </View>
                        {errors.confirmPassword && (
                            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                        )}
                        {newPassword && confirmPassword && newPassword === confirmPassword && (
                            <View style={styles.matchIndicator}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.matchText}>Passwords match</Text>
                            </View>
                        )}
                    </View>

                    {/* Reset Button */}
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleResetPassword}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Reset Password</Text>
                        )}
                    </TouchableOpacity>

                    {/* Back to Login */}
                    <TouchableOpacity
                        style={styles.backToLogin}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Ionicons name="arrow-back" size={16} color="#F97316" />
                        <Text style={styles.backToLoginText}>Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    header: {
        marginTop: 60,
        marginBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    titleContainer: {
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#171717',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#737373',
        lineHeight: 22,
    },
    form: {
        flex: 1,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#525252',
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        paddingHorizontal: 16,
        height: 56,
    },
    inputError: {
        borderColor: '#EF4444',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#171717',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        marginTop: 6,
        marginLeft: 4,
    },
    passwordStrengthContainer: {
        marginBottom: 12,
    },
    passwordStrengthBar: {
        height: 4,
        backgroundColor: '#E5E5E5',
        borderRadius: 2,
        marginBottom: 6,
    },
    passwordStrengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    passwordStrengthText: {
        fontSize: 13,
        fontWeight: '600',
    },
    matchIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    matchText: {
        fontSize: 13,
        color: '#10B981',
        marginLeft: 6,
    },
    button: {
        backgroundColor: '#F97316',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    backToLogin: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    backToLoginText: {
        fontSize: 15,
        color: '#F97316',
        fontWeight: '600',
        marginLeft: 6,
    },
});

export default ResetPasswordScreen;
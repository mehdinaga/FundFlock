// app/index.js - Expo Router entry point
import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, Image, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { StripeProvider } from '@stripe/stripe-react-native';
import { login as apiLogin, register as apiRegister, forgotPassword as apiForgotPassword, resetPassword as apiResetPassword, changePassword as apiChangePassword, deleteAccount as apiDeleteAccount, updateProfile as apiUpdateProfile, uploadAvatar as apiUploadAvatar } from '../src/api/auth';
import { acceptInvite } from '../src/api/friends';
import { getUnreadCount } from '../src/api/notifications';
import ExpensesScreen from '../src/screens/expenses/ExpensesScreen';
import GroupsScreen from '../src/screens/groups/GroupsScreen';
import DashboardScreen from '../src/screens/dashboard/DashboardScreen';

// Login Screen Component
const LoginScreen = ({ onSwitchToRegister, onSwitchToForgotPassword }) => {
    const { login: authLogin } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleLogin = async () => {
        const newErrors = {};
        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Please enter a valid email';
        if (!password) newErrors.password = 'Password is required';
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setLoading(true);
        try {
            const response = await apiLogin(email.trim(), password);
            if (response.data?.user) {
                authLogin(response.data.user);
            }
        } catch (error) {
            console.log('Login error:', error);
            if (error.error?.code === 'UNAUTHORIZED') {
                setErrors({ general: 'Invalid email or password' });
            } else if (error.message === 'Network Error') {
                Alert.alert('Connection Error', 'Cannot connect to server. Make sure the backend is running.');
            } else {
                Alert.alert('Error', error.error?.message || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.logo}>🦜</Text>
                    <Text style={styles.appName}>FundFlock</Text>
                </View>

                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Welcome Back!</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>
                </View>

                {errors.general && (
                    <View style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                        <Text style={styles.errorBannerText}>{errors.general}</Text>
                    </View>
                )}

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                            <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#A3A3A3"
                                value={email}
                                onChangeText={(text) => { setEmail(text); setErrors({}); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#A3A3A3"
                                value={password}
                                onChangeText={(text) => { setPassword(text); setErrors({}); }}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                            </TouchableOpacity>
                        </View>
                        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                    </View>

                    <TouchableOpacity onPress={onSwitchToForgotPassword} style={styles.forgotPasswordLink}>
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Login</Text>}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={onSwitchToRegister}>
                            <Text style={styles.link}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// Register Screen Component
const RegisterScreen = ({ onSwitchToLogin }) => {
    const { login: authLogin } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleRegister = async () => {
        const newErrors = {};
        if (!fullName.trim()) newErrors.fullName = 'Full name is required';
        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Please enter a valid email';
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!agreeToTerms) newErrors.terms = 'You must agree to the terms';
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setLoading(true);
        try {
            const response = await apiRegister(fullName.trim(), email.trim(), password);
            if (response.data?.user) {
                authLogin(response.data.user);
            }
            Alert.alert('Welcome!', 'Your account has been created successfully.');
        } catch (error) {
            console.log('Registration error:', error);
            if (error.error?.code === 'EMAIL_EXISTS') {
                setErrors({ email: 'This email is already registered' });
            } else if (error.message === 'Network Error') {
                Alert.alert('Connection Error', 'Cannot connect to server. Make sure the backend is running.');
            } else {
                Alert.alert('Error', error.error?.message || 'Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.logo}>🦜</Text>
                    <Text style={styles.appName}>FundFlock</Text>
                </View>

                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join FundFlock today</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.fullName && styles.inputError]}>
                            <Ionicons name="person-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                placeholderTextColor="#A3A3A3"
                                value={fullName}
                                onChangeText={(text) => { setFullName(text); if (errors.fullName) setErrors({ ...errors, fullName: null }); }}
                                autoCapitalize="words"
                            />
                        </View>
                        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                            <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#A3A3A3"
                                value={email}
                                onChangeText={(text) => { setEmail(text); if (errors.email) setErrors({ ...errors, email: null }); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#A3A3A3"
                                value={password}
                                onChangeText={(text) => { setPassword(text); if (errors.password) setErrors({ ...errors, password: null }); }}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                            </TouchableOpacity>
                        </View>
                        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                placeholderTextColor="#A3A3A3"
                                value={confirmPassword}
                                onChangeText={(text) => { setConfirmPassword(text); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null }); }}
                                secureTextEntry
                            />
                        </View>
                        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                    </View>

                    <TouchableOpacity style={styles.termsContainer} onPress={() => setAgreeToTerms(!agreeToTerms)}>
                        <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                            {agreeToTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.termsText}>I agree to the Terms of Service</Text>
                    </TouchableOpacity>
                    {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Create Account</Text>}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={onSwitchToLogin}>
                            <Text style={styles.link}>Sign In</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// Forgot Password Screen Component
const ForgotPasswordScreen = ({ onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState('email'); // 'email', 'code', 'password', 'success'
    const [error, setError] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});

    const handleSendCode = async () => {
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            setError('Please enter a valid email');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await apiForgotPassword(email.trim());
            setStep('code');
        } catch (error) {
            console.log('Forgot password error:', error);
            if (error.error?.code === 'NOT_FOUND') {
                setError('No account found with this email');
            } else if (error.message === 'Network Error') {
                Alert.alert('Connection Error', 'Cannot connect to server.');
            } else {
                Alert.alert('Error', error.error?.message || 'Failed to send reset email');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = () => {
        if (!resetCode.trim()) {
            setErrors({ code: 'Reset code is required' });
            return;
        }
        if (resetCode.length !== 6) {
            setErrors({ code: 'Code must be 6 digits' });
            return;
        }
        setErrors({});
        setStep('password');
    };

    const handleResetPassword = async () => {
        const newErrors = {};
        if (!newPassword) newErrors.password = 'New password is required';
        else if (newPassword.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (newPassword !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setLoading(true);

        try {
            await apiResetPassword(resetCode.trim(), newPassword);
            setStep('success');
        } catch (error) {
            console.log('Reset password error:', error);
            if (error.error?.code === 'INVALID_CODE') {
                setStep('code');
                setErrors({ code: 'Invalid or expired reset code' });
            } else if (error.message === 'Network Error') {
                Alert.alert('Connection Error', 'Cannot connect to server.');
            } else {
                Alert.alert('Error', error.error?.message || 'Failed to reset password');
            }
        } finally {
            setLoading(false);
        }
    };

    // Success screen after password reset
    if (step === 'success') {
        return (
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.logo}>✅</Text>
                        <Text style={styles.appName}>Password Reset!</Text>
                    </View>

                    <View style={styles.successContainer}>
                        <Text style={styles.successText}>
                            Your password has been reset successfully.
                        </Text>
                        <Text style={styles.subtitle}>
                            You can now sign in with your new password.
                        </Text>

                        <TouchableOpacity style={styles.button} onPress={onSwitchToLogin}>
                            <Text style={styles.buttonText}>Go to Login</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    // New password screen (step 3)
    if (step === 'password') {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={{ marginTop: 40, marginBottom: 20 }}>
                        <TouchableOpacity onPress={() => setStep('code')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#262626" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>Create New Password</Text>
                        <Text style={styles.subtitle}>Your new password must be at least 8 characters</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>New Password</Text>
                            <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter new password"
                                    placeholderTextColor="#A3A3A3"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={true}
                                    pointerEvents="auto"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Confirm Password</Text>
                            <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#A3A3A3"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={true}
                                    pointerEvents="auto"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleResetPassword}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Reset Password</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    // Code entry screen (step 2)
    if (step === 'code') {
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setStep('email')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#262626" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>Enter Reset Code</Text>
                        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <View style={[styles.inputWrapper, errors.code && styles.inputError]}>
                                <Ionicons name="keypad-outline" size={20} color="#737373" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.codeInput]}
                                    placeholder="000000"
                                    placeholderTextColor="#A3A3A3"
                                    value={resetCode}
                                    onChangeText={(text) => {
                                        const numericText = text.replace(/[^0-9]/g, '').slice(0, 6);
                                        setResetCode(numericText);
                                        if (errors.code) setErrors({ ...errors, code: null });
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                            </View>
                            {errors.code && <Text style={styles.errorText}>{errors.code}</Text>}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleVerifyCode}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>Verify Code</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleSendCode} style={styles.resendLink}>
                            <Text style={styles.resendText}>Didn't receive the code? </Text>
                            <Text style={styles.link}>Resend</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    // Email entry screen (initial)
    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <TouchableOpacity onPress={onSwitchToLogin} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#262626" />
                    </TouchableOpacity>
                </View>

                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>No worries, we'll send you a reset code</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, error && styles.inputError]}>
                            <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#A3A3A3"
                                value={email}
                                onChangeText={(text) => { setEmail(text); setError(''); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        {error && <Text style={styles.errorText}>{error}</Text>}
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSendCode}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send Reset Code</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onSwitchToLogin} style={styles.backToLoginLink}>
                        <Ionicons name="arrow-back" size={16} color="#F97316" />
                        <Text style={styles.backToLoginText}>Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// Dashboard Screen
// DashboardScreen, GroupsScreen and ExpensesScreen are imported from src/screens/ at the top.

// Friends Screen (Blank - Coming Soon)
const FriendsScreen = () => {
    const [screen, setScreen] = useState('FriendsList');
    const [screenParams, setScreenParams] = useState({});
    const [history, setHistory] = useState([]);

    // Create a navigation-like object for child screens
    const navigation = {
        navigate: (name, params = {}) => {
            setHistory(prev => [...prev, { screen, params: screenParams }]);
            setScreen(name);
            setScreenParams(params);
        },
        goBack: () => {
            if (history.length > 0) {
                const prev = history[history.length - 1];
                setHistory(h => h.slice(0, -1));
                setScreen(prev.screen);
                setScreenParams(prev.params);
            }
        },
    };

    const route = { params: screenParams };

    // Lazy imports from src/screens/friends
    const FriendsListScreen = require('../src/screens/friends/FriendsListScreen').default;
    const AddFriendScreen = require('../src/screens/friends/AddFriendScreen').default;
    const FriendDetailScreen = require('../src/screens/friends/FriendDetailScreen').default;
    const PendingRequestsScreen = require('../src/screens/friends/PendingRequestsScreen').default;
    const QRInviteScreen = require('../src/screens/friends/QRInviteScreen').default;
    const SettleUpScreen = require('../src/screens/payments/SettleUpScreen').default;
    const WalletSetupScreen = require('../src/screens/payments/WalletSetupScreen').default;

    switch (screen) {
        case 'AddFriend':
            return <AddFriendScreen navigation={navigation} route={route} />;
        case 'FriendDetail':
            return <FriendDetailScreen navigation={navigation} route={route} />;
        case 'PendingRequests':
            return <PendingRequestsScreen navigation={navigation} route={route} />;
        case 'QRInvite':
            return <QRInviteScreen navigation={navigation} route={route} />;
        case 'SettleUp':
            return <SettleUpScreen navigation={navigation} route={route} />;
        case 'WalletSetup':
            return <WalletSetupScreen navigation={navigation} route={route} />;
        default:
            return <FriendsListScreen navigation={navigation} route={route} />;
    }
};

// Country codes data
const COUNTRY_CODES = [
    { code: '+1', country: 'US', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+91', country: 'IN', flag: '🇮🇳' },
    { code: '+86', country: 'CN', flag: '🇨🇳' },
    { code: '+81', country: 'JP', flag: '🇯🇵' },
    { code: '+49', country: 'DE', flag: '🇩🇪' },
    { code: '+33', country: 'FR', flag: '🇫🇷' },
    { code: '+39', country: 'IT', flag: '🇮🇹' },
    { code: '+34', country: 'ES', flag: '🇪🇸' },
    { code: '+61', country: 'AU', flag: '🇦🇺' },
    { code: '+55', country: 'BR', flag: '🇧🇷' },
    { code: '+52', country: 'MX', flag: '🇲🇽' },
    { code: '+7', country: 'RU', flag: '🇷🇺' },
    { code: '+82', country: 'KR', flag: '🇰🇷' },
    { code: '+971', country: 'AE', flag: '🇦🇪' },
    { code: '+966', country: 'SA', flag: '🇸🇦' },
    { code: '+20', country: 'EG', flag: '🇪🇬' },
    { code: '+27', country: 'ZA', flag: '🇿🇦' },
    { code: '+234', country: 'NG', flag: '🇳🇬' },
    { code: '+254', country: 'KE', flag: '🇰🇪' },
];

// Edit Profile Screen
const EditProfileScreen = ({ onBack, profileImage, onImageChange }) => {
    const { user, logout, updateUser } = useAuth();
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Edit mode states
    const [editingField, setEditingField] = useState(null);

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
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            // Local URI for preview; the actual upload happens on Save.
            onImageChange(result.assets[0].uri);
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
                await apiChangePassword(currentPassword, newPassword);
                // Clear password fields after successful change
                setCurrentPassword('');
                setNewPassword('');
                setEditingField(null);
            }

            // If the user picked a new image (local file URI), upload it first.
            // Firebase Storage returns a permanent URL that other users can load.
            const isLocalFile = profileImage && /^(file:|content:|ph:|assets-library:)/.test(profileImage);
            if (isLocalFile) {
                const uploadRes = await apiUploadAvatar(profileImage);
                if (uploadRes?.data) {
                    updateUser(uploadRes.data);
                }
            }

            // Update profile (fullName, email, and clear avatar if removed)
            const profileData = {
                fullName: fullName.trim(),
                email: email.trim(),
            };
            if (profileImage === null) {
                profileData.avatar = null;
            }

            const response = await apiUpdateProfile(profileData);

            // Update user in context
            if (response?.data) {
                updateUser(response.data);
            }

            Alert.alert('Success', 'Profile updated successfully!');
            onBack();
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
        if (!deletePassword) {
            Alert.alert('Error', 'Please enter your password to confirm deletion');
            return;
        }

        setDeleting(true);
        try {
            await apiDeleteAccount(deletePassword);
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
            setDeletePassword('');
        }
    };

    return (
        <SafeAreaView style={styles.editProfileContainer}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.editProfileHeaderFixed}>
                <TouchableOpacity onPress={onBack} style={styles.editProfileBackButton}>
                    <Ionicons name="arrow-back" size={24} color="#171717" />
                </TouchableOpacity>
                <Text style={styles.editProfileTitle}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.editProfileContent} keyboardShouldPersistTaps="handled">
                <View style={styles.editProfileImageSection}>
                    <TouchableOpacity onPress={pickImage} style={styles.editProfileImageContainer}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.editProfileImage} />
                        ) : (
                            <View style={styles.editProfileImagePlaceholder}>
                                <Text style={styles.editProfileImageText}>{user?.fullName?.charAt(0)?.toUpperCase()}</Text>
                            </View>
                        )}
                        <View style={styles.editProfileImageOverlay}>
                            <Ionicons name="camera" size={20} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.editProfileImageHint}>Tap to change photo</Text>
                </View>

                <View style={styles.editProfileForm}>
                    <Text style={styles.editProfileSectionTitle}>Personal Information</Text>

                    {/* Full Name Field */}
                    <View style={styles.editProfileInputContainer}>
                        <View style={styles.editProfileLabelRow}>
                            <Text style={styles.editProfileLabel}>Full Name</Text>
                            <TouchableOpacity onPress={() => setEditingField(editingField === 'name' ? null : 'name')} style={styles.editIconButton}>
                                <Ionicons name="pencil" size={16} color="#F97316" />
                                <Text style={styles.editIconText}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                        {editingField === 'name' ? (
                            <View style={[styles.editProfileInputWrapper, errors.fullName && styles.inputError]}>
                                <Ionicons name="person-outline" size={20} color="#737373" />
                                <TextInput
                                    style={styles.editProfileInput}
                                    value={fullName}
                                    onChangeText={(text) => { setFullName(text); if (errors.fullName) setErrors({ ...errors, fullName: null }); }}
                                    placeholder="Enter your full name"
                                    placeholderTextColor="#A3A3A3"
                                    autoFocus
                                />
                            </View>
                        ) : (
                            <View style={styles.editProfileDisplayValue}>
                                <Ionicons name="person-outline" size={20} color="#737373" />
                                <Text style={styles.editProfileDisplayText}>{fullName || 'Not set'}</Text>
                            </View>
                        )}
                        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                    </View>

                    {/* Email Field */}
                    <View style={styles.editProfileInputContainer}>
                        <View style={styles.editProfileLabelRow}>
                            <Text style={styles.editProfileLabel}>Email</Text>
                            <TouchableOpacity onPress={() => setEditingField(editingField === 'email' ? null : 'email')} style={styles.editIconButton}>
                                <Ionicons name="pencil" size={16} color="#F97316" />
                                <Text style={styles.editIconText}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                        {editingField === 'email' ? (
                            <View style={[styles.editProfileInputWrapper, errors.email && styles.inputError]}>
                                <Ionicons name="mail-outline" size={20} color="#737373" />
                                <TextInput
                                    style={styles.editProfileInput}
                                    value={email}
                                    onChangeText={(text) => { setEmail(text); if (errors.email) setErrors({ ...errors, email: null }); }}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#A3A3A3"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoFocus
                                />
                            </View>
                        ) : (
                            <View style={styles.editProfileDisplayValue}>
                                <Ionicons name="mail-outline" size={20} color="#737373" />
                                <Text style={styles.editProfileDisplayText}>{email || 'Not set'}</Text>
                            </View>
                        )}
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                    </View>

                    {/* Phone Number Field - Coming Soon */}
                    <View style={styles.editProfileInputContainer}>
                        <View style={styles.editProfileLabelRow}>
                            <Text style={styles.editProfileLabel}>Phone Number</Text>
                        </View>
                        <View style={styles.editProfileDisplayValue}>
                            <Ionicons name="call-outline" size={20} color="#737373" />
                            <Text style={styles.editProfileDisplayText}>Coming soon</Text>
                        </View>
                    </View>

                    {/* Change Password Section */}
                    <View style={styles.editProfileInputContainer}>
                        <View style={styles.editProfileLabelRow}>
                            <Text style={[styles.editProfileSectionTitle, { marginTop: 8, marginBottom: 0 }]}>Change Password</Text>
                            <TouchableOpacity onPress={() => setEditingField(editingField === 'password' ? null : 'password')} style={styles.editIconButton}>
                                <Ionicons name="pencil" size={16} color="#F97316" />
                                <Text style={styles.editIconText}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        {editingField === 'password' ? (
                            <View style={{ marginTop: 12 }}>
                                {/* Current Password Field */}
                                <Text style={[styles.editProfileLabel, { marginBottom: 8 }]}>Current Password</Text>
                                <View style={[styles.editProfileInputWrapper, errors.currentPassword && styles.inputError, { marginBottom: 4 }]}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#737373" />
                                    <TextInput
                                        style={styles.editProfileInput}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        placeholder="Enter current password"
                                        placeholderTextColor="#A3A3A3"
                                        secureTextEntry={!showCurrentPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={true}
                                    />
                                    <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 8 }}>
                                        <Ionicons name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                                    </TouchableOpacity>
                                </View>
                                {errors.currentPassword && <Text style={[styles.errorText, { marginBottom: 8 }]}>{errors.currentPassword}</Text>}

                                {/* New Password Field */}
                                <Text style={[styles.editProfileLabel, { marginBottom: 8, marginTop: 12 }]}>New Password</Text>
                                <View style={[styles.editProfileInputWrapper, errors.newPassword && styles.inputError]}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#737373" />
                                    <TextInput
                                        style={styles.editProfileInput}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#A3A3A3"
                                        secureTextEntry={!showNewPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={true}
                                    />
                                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 8 }}>
                                        <Ionicons name={showNewPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                                    </TouchableOpacity>
                                </View>
                                {errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}

                                <Text style={[styles.editProfileHint, { marginTop: 12 }]}>Password must be at least 8 characters with uppercase, lowercase, and number</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, loading && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>

                {/* Delete Account */}
                <TouchableOpacity
                    style={styles.deleteAccountButton}
                    onPress={handleDeleteAccount}
                >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                    <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
                </TouchableOpacity>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Confirm Deletion</Text>
                            <Text style={styles.modalDescription}>
                                Enter your password to confirm account deletion.
                            </Text>
                            <View style={[styles.editProfileInputWrapper, { marginTop: 16 }]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#737373" />
                                <TextInput
                                    style={styles.editProfileInput}
                                    value={deletePassword}
                                    onChangeText={setDeletePassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#A3A3A3"
                                    secureTextEntry
                                    autoCapitalize="none"
                                />
                            </View>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={styles.modalCancelButton}
                                    onPress={() => {
                                        setShowDeleteConfirm(false);
                                        setDeletePassword('');
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
                )}
            </ScrollView>
        </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Profile Screen
const ProfileScreen = ({
    onEditProfile,
    onOpenWallet,
    onOpenNotifications,
    onOpenReceipts,
    profileImage,
    unreadCount = 0,
}) => {
    const { user, logout } = useAuth();
    const [showEmailSheet, setShowEmailSheet] = useState(false);
    const EmailAppSheet = require('../src/components/EmailAppSheet').default;
    return (
        <ScrollView style={styles.screenContainer}>
            <View style={styles.profileHeader}>
                {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.profileAvatar} />
                ) : (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                )}
                <Text style={styles.profileName}>{user?.fullName}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
            <View style={styles.profileMenu}>
                <TouchableOpacity style={styles.profileMenuItem} onPress={onEditProfile}>
                    <Ionicons name="person-outline" size={22} color="#525252" />
                    <Text style={styles.profileMenuText}>Edit Profile</Text>
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuItem} onPress={onOpenNotifications}>
                    <Ionicons name="notifications-outline" size={22} color="#525252" />
                    <Text style={styles.profileMenuText}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={styles.menuBadge}>
                            <Text style={styles.menuBadgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuItem} onPress={onOpenReceipts}>
                    <Ionicons name="receipt-outline" size={22} color="#525252" />
                    <Text style={styles.profileMenuText}>Receipts</Text>
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuItem} onPress={onOpenWallet}>
                    <Ionicons name="wallet-outline" size={22} color="#525252" />
                    <Text style={styles.profileMenuText}>Wallet & Payouts</Text>
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuItem} onPress={() => setShowEmailSheet(true)}>
                    <Ionicons name="help-circle-outline" size={22} color="#525252" />
                    <Text style={styles.profileMenuText}>Help & Support</Text>
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuItem}>
                    <Ionicons name="settings-outline" size={22} color="#525252" />
                    <Text style={styles.profileMenuText}>Settings</Text>
                    <Ionicons name="chevron-forward" size={20} color="#A3A3A3" />
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <EmailAppSheet
                visible={showEmailSheet}
                onClose={() => setShowEmailSheet(false)}
                to="support@fundflock.com"
                subject="FundFlock Support"
                body={`\n\n\n--- Account info ---\nName: ${user?.fullName || ''}\nEmail: ${user?.email || ''}`}
            />
        </ScrollView>
    );
};

// Main App (after login)
const MainApp = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showWallet, setShowWallet] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showReceipts, setShowReceipts] = useState(false);
    const [settleTarget, setSettleTarget] = useState(null); // { friend, maxAmount } | null
    const [unreadCount, setUnreadCount] = useState(0);
    const { user } = useAuth();
    const [profileImage, setProfileImage] = useState(user?.avatar || null);

    // Lightweight poll of the unread count so the badge is roughly live
    // without needing websockets. 30s is a decent sweet spot for a splitting
    // app — not so fast as to hammer the API, not so slow as to feel stale.
    const refreshUnread = useCallback(async () => {
        try {
            const res = await getUnreadCount();
            const n = Number(res?.data?.count ?? 0);
            setUnreadCount(Number.isFinite(n) ? n : 0);
        } catch {
            // stay silent — we don't want to surface network blips here
        }
    }, []);

    useEffect(() => {
        refreshUnread();
        const id = setInterval(refreshUnread, 30000);
        return () => clearInterval(id);
    }, [refreshUnread]);

    const openSettle = useCallback((friend, maxAmount) => {
        if (!friend) return;
        setSettleTarget({ friend, maxAmount: Number(maxAmount) || 0 });
    }, []);

    // Keep profileImage in sync with the authenticated user's avatar
    // so it survives sign-out / sign-in and profile updates.
    useEffect(() => {
        setProfileImage(user?.avatar || null);
    }, [user?.avatar]);

    // Deep link handler for invite links
    const handleDeepLink = useCallback(async (url) => {
        if (!url) return;
        // Match any URL format: fundflock://invite/{id}, exp://...--/invite/{id}, etc.
        const match = url.match(/\/invite\/([a-fA-F0-9]{24})/);
        if (!match) return;

        const inviterId = match[1];

        if (inviterId === user?._id) {
            Alert.alert('Oops', 'You cannot add yourself as a friend!');
            return;
        }

        try {
            const result = await acceptInvite(inviterId);
            if (result.success) {
                Alert.alert('Success!', result.message || 'You are now friends!', [
                    { text: 'OK', onPress: () => setActiveTab('friends') }
                ]);
            }
        } catch (error) {
            const msg = error?.error?.message || 'Failed to process invite';
            Alert.alert('Invite Error', msg);
        }
    }, [user]);

    useEffect(() => {
        // Handle link that opened the app
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink(url);
        });

        // Handle links while app is open
        const subscription = Linking.addEventListener('url', (event) => {
            handleDeepLink(event.url);
        });

        return () => subscription?.remove();
    }, [handleDeepLink]);

    if (showEditProfile) {
        return (
            <EditProfileScreen
                onBack={() => setShowEditProfile(false)}
                profileImage={profileImage}
                onImageChange={setProfileImage}
            />
        );
    }

    if (showWallet) {
        const WalletSetupScreen = require('../src/screens/payments/WalletSetupScreen').default;
        return (
            <WalletSetupScreen
                navigation={{ goBack: () => setShowWallet(false) }}
            />
        );
    }

    if (settleTarget) {
        const SettleUpScreen = require('../src/screens/payments/SettleUpScreen').default;
        return (
            <SettleUpScreen
                navigation={{ goBack: () => setSettleTarget(null) }}
                route={{ params: settleTarget }}
            />
        );
    }

    if (showNotifications) {
        const NotificationsScreen = require('../src/screens/notifications/NotificationsScreen').default;
        return (
            <NotificationsScreen
                navigation={{
                    goBack: () => {
                        setShowNotifications(false);
                        // Re-sync the badge when the user leaves the screen —
                        // they probably opened some items.
                        refreshUnread();
                    },
                }}
            />
        );
    }

    if (showReceipts) {
        const ReceiptsScreen = require('../src/screens/receipts/ReceiptsScreen').default;
        return (
            <ReceiptsScreen
                navigation={{ goBack: () => setShowReceipts(false) }}
            />
        );
    }

    const renderScreen = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <DashboardScreen
                        onOpenNotifications={() => setShowNotifications(true)}
                        unreadCount={unreadCount}
                    />
                );
            case 'groups': return <GroupsScreen />;
            case 'expenses': return <ExpensesScreen onOpenSettle={openSettle} />;
            case 'friends': return <FriendsScreen />;
            case 'profile':
                return (
                    <ProfileScreen
                        onEditProfile={() => setShowEditProfile(true)}
                        onOpenWallet={() => setShowWallet(true)}
                        onOpenNotifications={() => setShowNotifications(true)}
                        onOpenReceipts={() => setShowReceipts(true)}
                        profileImage={profileImage}
                        unreadCount={unreadCount}
                    />
                );
            default: return <DashboardScreen />;
        }
    };

    return (
        <View style={styles.mainAppContainer}>
            <View style={styles.screenContent}>
                {renderScreen()}
            </View>
            <View style={styles.tabBar}>
                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('dashboard')}>
                    <Ionicons name={activeTab === 'dashboard' ? 'home' : 'home-outline'} size={24} color={activeTab === 'dashboard' ? '#F97316' : '#737373'} />
                    <Text style={[styles.tabLabel, activeTab === 'dashboard' && styles.tabLabelActive]}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('groups')}>
                    <Ionicons name={activeTab === 'groups' ? 'people' : 'people-outline'} size={24} color={activeTab === 'groups' ? '#F97316' : '#737373'} />
                    <Text style={[styles.tabLabel, activeTab === 'groups' && styles.tabLabelActive]}>Groups</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItemCenter} onPress={() => setActiveTab('expenses')}>
                    <View style={styles.tabCenterButton}>
                        <Ionicons name="add" size={28} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('friends')}>
                    <Ionicons name={activeTab === 'friends' ? 'person' : 'person-outline'} size={24} color={activeTab === 'friends' ? '#F97316' : '#737373'} />
                    <Text style={[styles.tabLabel, activeTab === 'friends' && styles.tabLabelActive]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('profile')}>
                    <Ionicons name={activeTab === 'profile' ? 'settings' : 'settings-outline'} size={24} color={activeTab === 'profile' ? '#F97316' : '#737373'} />
                    <Text style={[styles.tabLabel, activeTab === 'profile' && styles.tabLabelActive]}>Profile</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// App Content with auth check
const AppContent = () => {
    const { isLoggedIn, loading } = useAuth();
    const [screen, setScreen] = useState('login'); // 'login', 'register', 'forgotPassword'

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    if (isLoggedIn) return <MainApp />;

    switch (screen) {
        case 'register':
            return <RegisterScreen onSwitchToLogin={() => setScreen('login')} />;
        case 'forgotPassword':
            return <ForgotPasswordScreen onSwitchToLogin={() => setScreen('login')} />;
        default:
            return (
                <LoginScreen
                    onSwitchToRegister={() => setScreen('register')}
                    onSwitchToForgotPassword={() => setScreen('forgotPassword')}
                />
            );
    }
};

// Main Page component
export default function Page() {
    const publishableKey = Constants.expoConfig?.extra?.stripePublishableKey || '';
    return (
        <StripeProvider
            publishableKey={publishableKey}
            merchantIdentifier="merchant.com.fundflock"
            urlScheme="fundflock"
        >
            <AuthProvider>
                <StatusBar style="dark" />
                <AppContent />
            </AuthProvider>
        </StripeProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
    header: { marginTop: 40, marginBottom: 20, alignItems: 'center' },
    logo: { fontSize: 48, marginBottom: 8 },
    appName: { fontSize: 24, fontWeight: '700', color: '#F97316' },
    titleContainer: { marginBottom: 32 },
    title: { fontSize: 28, fontWeight: '700', color: '#171717', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#737373' },
    form: { flex: 1 },
    inputContainer: { marginBottom: 16 },
    inputLabel: { fontSize: 14, fontWeight: '500', color: '#525252', marginBottom: 8 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 16, height: 56 },
    inputError: { borderColor: '#EF4444' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#171717', paddingVertical: 8 },
    errorText: { color: '#EF4444', fontSize: 13, marginTop: 6, marginLeft: 4 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 8, marginBottom: 16 },
    errorBannerText: { color: '#EF4444', fontSize: 14, marginLeft: 8, flex: 1 },
    button: { backgroundColor: '#F97316', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
    footerText: { fontSize: 14, color: '#737373' },
    link: { fontSize: 14, color: '#F97316', fontWeight: '600' },
    termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#D4D4D4', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#F97316', borderColor: '#F97316' },
    termsText: { fontSize: 14, color: '#525252' },
    forgotPasswordLink: { alignSelf: 'flex-end', marginBottom: 8 },
    forgotPasswordText: { fontSize: 14, color: '#F97316', fontWeight: '600' },
    backButton: { alignSelf: 'flex-start', padding: 8 },
    backToLoginLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    backToLoginText: { fontSize: 15, color: '#F97316', fontWeight: '600', marginLeft: 6 },
    successContainer: { flex: 1, alignItems: 'center', paddingTop: 40 },
    successText: { fontSize: 16, color: '#171717', textAlign: 'center', marginBottom: 16 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#737373' },
    mainContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
    welcomeText: { fontSize: 28, fontWeight: '700', color: '#171717', marginBottom: 16 },
    userText: { fontSize: 18, fontWeight: '600', color: '#525252', marginBottom: 8 },
    emailText: { fontSize: 15, color: '#737373', marginBottom: 32 },
    infoText: { fontSize: 14, color: '#A3A3A3', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
    logoutButton: { backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginHorizontal: 20, marginTop: 20, marginBottom: 40 },
    logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    codeInput: { fontSize: 24, fontWeight: '600', letterSpacing: 8, textAlign: 'center' },
    resendLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    resendText: { fontSize: 14, color: '#737373' },
    // Main App Styles
    mainAppContainer: { flex: 1, backgroundColor: '#F5F5F5' },
    screenContent: { flex: 1 },
    screenContainer: { flex: 1, backgroundColor: '#F5F5F5' },
    screenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, backgroundColor: '#FFFFFF' },
    screenTitle: { fontSize: 28, fontWeight: '700', color: '#171717' },
    screenSubtitle: { fontSize: 14, color: '#737373', marginTop: 4 },
    greeting: { fontSize: 24, fontWeight: '700', color: '#171717' },
    addButton: { backgroundColor: '#F97316', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    // Balance Card
    balanceCard: { backgroundColor: '#FFFFFF', margin: 20, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    balanceLabel: { fontSize: 14, color: '#737373', marginBottom: 8 },
    balanceAmount: { fontSize: 36, fontWeight: '700', color: '#171717', marginBottom: 20 },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between' },
    balanceItem: { flex: 1 },
    balanceItemLabel: { fontSize: 13, color: '#737373', marginBottom: 4 },
    balanceItemAmount: { fontSize: 18, fontWeight: '600' },
    // Section
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#171717', paddingHorizontal: 20, marginBottom: 12 },
    // Empty State
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
    emptyStateText: { fontSize: 18, fontWeight: '600', color: '#525252', marginTop: 16 },
    emptyStateSubtext: { fontSize: 14, color: '#A3A3A3', marginTop: 8, textAlign: 'center' },
    // Profile
    profileHeader: { alignItems: 'center', paddingTop: 40, paddingBottom: 30, backgroundColor: '#FFFFFF' },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    avatarText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
    profileName: { fontSize: 22, fontWeight: '700', color: '#171717', marginBottom: 4 },
    profileEmail: { fontSize: 14, color: '#737373' },
    profileMenu: { backgroundColor: '#FFFFFF', marginTop: 20, paddingVertical: 8 },
    profileMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    profileMenuText: { flex: 1, fontSize: 16, color: '#171717', marginLeft: 16 },
    menuBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#F97316', paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    menuBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    // Tab Bar
    tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingBottom: 30, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E5E5' },
    tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    tabItemCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -30 },
    tabCenterButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    tabLabel: { fontSize: 11, color: '#737373', marginTop: 4 },
    tabLabelActive: { color: '#F97316', fontWeight: '600' },
    // Blank Screens
    blankScreenContainer: { flex: 1, backgroundColor: '#FFFFFF' },
    blankScreenHeader: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    // Profile Avatar Image
    profileAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 16 },
    // Edit Profile Styles
    editProfileContainer: { flex: 1, backgroundColor: '#FFFFFF' },
    editProfileHeaderFixed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', backgroundColor: '#FFFFFF' },
    editProfileBackButton: { padding: 8 },
    editProfileTitle: { fontSize: 28, fontWeight: '700', color: '#171717' },
    editProfileContent: { flex: 1, padding: 20 },
    editProfileImageSection: { alignItems: 'center', marginBottom: 24 },
    editProfileImageContainer: { position: 'relative' },
    editProfileImage: { width: 100, height: 100, borderRadius: 50 },
    editProfileImagePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center' },
    editProfileImageText: { fontSize: 40, fontWeight: '700', color: '#FFFFFF' },
    editProfileImageOverlay: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: '#171717', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
    editProfileImageHint: { fontSize: 14, color: '#737373', marginTop: 12 },
    editProfileForm: { marginBottom: 20 },
    editProfileSectionTitle: { fontSize: 16, fontWeight: '600', color: '#171717', marginBottom: 16 },
    editProfileHint: { fontSize: 13, color: '#A3A3A3', marginBottom: 16, marginTop: -8 },
    editProfileInputContainer: { marginBottom: 20 },
    editProfileLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    editProfileLabel: { fontSize: 14, fontWeight: '500', color: '#525252' },
    editIconButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 },
    editIconText: { fontSize: 13, color: '#F97316', fontWeight: '500', marginLeft: 4 },
    editProfileInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 16, height: 52 },
    editProfileInput: { flex: 1, fontSize: 16, color: '#171717', marginLeft: 12, paddingVertical: 8 },
    editProfileDisplayValue: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 16, height: 52 },
    editProfileDisplayText: { fontSize: 16, color: '#171717', marginLeft: 12 },
    // Phone verification styles
    phoneInputRow: { flexDirection: 'row', gap: 10 },
    countryCodeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 12, height: 52, minWidth: 100 },
    countryFlag: { fontSize: 20, marginRight: 6 },
    countryCodeText: { fontSize: 15, color: '#171717', fontWeight: '500' },
    phoneNumberInput: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 16, height: 52 },
    countryPickerDropdown: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', marginTop: 8, maxHeight: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    countryPickerScroll: { padding: 8 },
    countryPickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
    countryPickerItemSelected: { backgroundColor: '#FFF7ED' },
    countryName: { flex: 1, fontSize: 15, color: '#171717', marginLeft: 8 },
    verifyPhoneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F97316', borderRadius: 10, paddingVertical: 12, marginTop: 12 },
    verifyPhoneButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },
    phoneVerifyHint: { fontSize: 13, color: '#737373', marginBottom: 12 },
    smsCodeInput: { fontSize: 20, fontWeight: '600', letterSpacing: 6, textAlign: 'center' },
    phoneVerifyButtons: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
    phoneVerifyButton: { flex: 1, backgroundColor: '#F97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    phoneVerifyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    resendCodeButton: { paddingVertical: 12, paddingHorizontal: 8 },
    resendCodeText: { color: '#F97316', fontSize: 14, fontWeight: '500' },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 'auto', marginLeft: 8 },
    verifiedText: { fontSize: 12, color: '#22C55E', fontWeight: '500', marginLeft: 4 },
    saveButton: { backgroundColor: '#F97316', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    // Delete Account Styles
    deleteAccountButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', marginBottom: 40 },
    deleteAccountButtonText: { color: '#DC2626', fontSize: 15, fontWeight: '600', marginLeft: 8 },
    // Modal Styles
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#171717', marginBottom: 8 },
    modalDescription: { fontSize: 14, color: '#737373', marginBottom: 8 },
    modalButtons: { flexDirection: 'row', marginTop: 20, gap: 12 },
    modalCancelButton: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: '#525252' },
    modalDeleteButton: { flex: 1, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#DC2626' },
    modalDeleteText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});

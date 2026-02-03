// src/screens/auth/LoginScreen.js
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
import { login } from '../../api/auth';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateForm()) return;

        setLoading(true);
        setErrors({});

        try {
            const response = await login(email.trim(), password);

            // Navigate to main app
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainApp' }],
            });
        } catch (error) {
            console.error('Login error:', error);

            if (error.error?.code === 'UNAUTHORIZED') {
                setErrors({
                    general: 'Invalid email or password. Please try again.'
                });
            } else {
                Alert.alert('Error', error.error?.message || 'Login failed. Please try again.');
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
                    <View style={styles.logoContainer}>
                        <Text style={styles.logo}>🦜</Text>
                        <Text style={styles.appName}>FundFlock</Text>
                    </View>
                </View>

                {/* Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Welcome Back! 👋</Text>
                    <Text style={styles.subtitle}>We missed you</Text>
                </View>

                {/* General Error Message */}
                {errors.general && (
                    <View style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                        <Text style={styles.errorBannerText}>{errors.general}</Text>
                    </View>
                )}

                {/* Form */}
                <View style={styles.form}>
                    {/* Email Input */}
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                            <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#A3A3A3"
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (errors.email || errors.general) {
                                        setErrors({ ...errors, email: null, general: null });
                                    }
                                }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                returnKeyType="next"
                            />
                        </View>
                        {errors.email && (
                            <Text style={styles.errorText}>{errors.email}</Text>
                        )}
                    </View>

                    {/* Password Input */}
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#A3A3A3"
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    if (errors.password || errors.general) {
                                        setErrors({ ...errors, password: null, general: null });
                                    }
                                }}
                                secureTextEntry={!showPassword}
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#737373"
                                />
                            </TouchableOpacity>
                        </View>
                        {errors.password && (
                            <Text style={styles.errorText}>{errors.password}</Text>
                        )}
                    </View>

                    {/* Remember Me & Forgot Password */}
                    <View style={styles.optionsRow}>
                        <TouchableOpacity
                            style={styles.rememberMeContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                        >
                            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                                {rememberMe && (
                                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                )}
                            </View>
                            <Text style={styles.rememberMeText}>Remember me</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                            <Text style={styles.forgotPassword}>Forgot?</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Login 🎯</Text>
                        )}
                    </TouchableOpacity>

                    {/* Sign Up Link */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.link}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Social Login Buttons */}
                    <TouchableOpacity style={styles.socialButton}>
                        <Ionicons name="logo-apple" size={20} color="#000000" />
                        <Text style={styles.socialButtonText}>Sign in with Apple</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.socialButton, styles.googleButton]}>
                        <Ionicons name="logo-google" size={20} color="#DB4437" />
                        <Text style={styles.socialButtonText}>Sign in with Google</Text>
                    </TouchableOpacity>

                    {/* Security Badge */}
                    <View style={styles.securityBadge}>
                        <Ionicons name="lock-closed" size={16} color="#10B981" />
                        <Text style={styles.securityText}>Your data is encrypted</Text>
                    </View>
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
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
    },
    logo: {
        fontSize: 48,
        marginBottom: 8,
    },
    appName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#F97316',
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
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorBannerText: {
        color: '#EF4444',
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    form: {
        flex: 1,
    },
    inputContainer: {
        marginBottom: 16,
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
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    rememberMeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#D4D4D4',
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#F97316',
        borderColor: '#F97316',
    },
    rememberMeText: {
        fontSize: 14,
        color: '#525252',
    },
    forgotPassword: {
        fontSize: 14,
        color: '#F97316',
        fontWeight: '600',
    },
    button: {
        backgroundColor: '#F97316',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 24,
    },
    footerText: {
        fontSize: 14,
        color: '#737373',
    },
    link: {
        fontSize: 14,
        color: '#F97316',
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E5E5',
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 14,
        color: '#A3A3A3',
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    googleButton: {
        marginBottom: 24,
    },
    socialButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#171717',
        marginLeft: 12,
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 32,
    },
    securityText: {
        fontSize: 13,
        color: '#10B981',
        marginLeft: 6,
    },
});

export default LoginScreen;
// frontend/src/screens/auth/ForgotPasswordScreen.js
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
import { forgotPassword } from '../../api/auth';

const ForgotPasswordScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSendReset = async () => {
        // Validate email
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
            await forgotPassword(email.trim());
            setSent(true);
        } catch (error) {
            console.error('Forgot password error:', error);

            if (error.error?.code === 'NOT_FOUND') {
                setError('No account found with this email');
            } else {
                Alert.alert('Error', error.error?.message || 'Failed to send reset email');
            }
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={24} color="#262626" />
                        </TouchableOpacity>
                    </View>

                    {/* Success State */}
                    <View style={styles.successContainer}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="mail-outline" size={64} color="#F97316" />
                        </View>

                        <Text style={styles.successTitle}>Check Your Email 📧</Text>
                        <Text style={styles.successMessage}>
                            We've sent a password reset code to{'\n'}
                            <Text style={styles.emailText}>{email}</Text>
                        </Text>

                        <View style={styles.instructionsContainer}>
                            <View style={styles.instruction}>
                                <View style={styles.stepNumber}>
                                    <Text style={styles.stepNumberText}>1</Text>
                                </View>
                                <Text style={styles.instructionText}>Check your email inbox</Text>
                            </View>

                            <View style={styles.instruction}>
                                <View style={styles.stepNumber}>
                                    <Text style={styles.stepNumberText}>2</Text>
                                </View>
                                <Text style={styles.instructionText}>Copy the reset code</Text>
                            </View>

                            <View style={styles.instruction}>
                                <View style={styles.stepNumber}>
                                    <Text style={styles.stepNumberText}>3</Text>
                                </View>
                                <Text style={styles.instructionText}>Enter it on the next screen</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => navigation.navigate('ResetPassword', { email })}
                        >
                            <Text style={styles.buttonText}>I Have the Code</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.resendButton}
                            onPress={() => setSent(false)}
                        >
                            <Text style={styles.resendText}>Didn't receive it? Send again</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

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
                    <Text style={styles.title}>Forgot Password? 🔒</Text>
                    <Text style={styles.subtitle}>
                        No worries, we'll send you reset instructions
                    </Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, error && styles.inputError]}>
                            <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor="#A3A3A3"
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    setError('');
                                }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                returnKeyType="done"
                                onSubmitEditing={handleSendReset}
                            />
                            {email && /^\S+@\S+\.\S+$/.test(email) && (
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            )}
                        </View>
                        {error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSendReset}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Send Reset Code</Text>
                        )}
                    </TouchableOpacity>

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
        marginBottom: 24,
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
    // Success State Styles
    successContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 40,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#171717',
        marginBottom: 12,
    },
    successMessage: {
        fontSize: 15,
        color: '#737373',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    emailText: {
        color: '#F97316',
        fontWeight: '600',
    },
    instructionsContainer: {
        width: '100%',
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        padding: 20,
        marginBottom: 32,
    },
    instruction: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F97316',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    stepNumberText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    instructionText: {
        fontSize: 15,
        color: '#525252',
        flex: 1,
    },
    resendButton: {
        padding: 12,
    },
    resendText: {
        fontSize: 14,
        color: '#737373',
    },
});

export default ForgotPasswordScreen;
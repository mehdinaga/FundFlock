// frontend/src/screens/auth/RegisterScreen.js
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
import { register } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';

const RegisterScreen = ({ navigation }) => {
    const { login: authLogin } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const getPasswordStrength = () => {
        if (password.length === 0) return { strength: 0, label: '', color: '#E5E5E5' };
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 25;
        if (strength <= 25) return { strength, label: 'Weak', color: '#EF4444' };
        if (strength <= 50) return { strength, label: 'Fair', color: '#F59E0B' };
        if (strength <= 75) return { strength, label: 'Good', color: '#10B981' };
        return { strength, label: 'Strong', color: '#10B981' };
    };

    const passwordStrength = getPasswordStrength();

    const validateForm = () => {
        const newErrors = {};
        if (!fullName.trim()) newErrors.fullName = 'Full name is required';
        else if (fullName.trim().length < 2) newErrors.fullName = 'Name must be at least 2 characters';
        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = 'Please enter a valid email';
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
        else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!agreeToTerms) newErrors.terms = 'You must agree to the terms';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        if (!validateForm()) return;
        setLoading(true);
        setErrors({});
        try {
            const response = await register(fullName.trim(), email.trim(), password);
            if (response.data?.user) authLogin(response.data.user);
            Alert.alert('Welcome!', 'Your account has been created successfully.', [{ text: 'OK' }]);
        } catch (error) {
            console.error('Registration error:', error);
            if (error.error?.code === 'EMAIL_EXISTS') setErrors({ email: 'This email is already registered' });
            else Alert.alert('Error', error.error?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#262626" />
                    </TouchableOpacity>
                </View>

                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join FundFlock and start splitting expenses</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.fullName && styles.inputError]}>
                            <Ionicons name="person-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#A3A3A3" value={fullName}
                                onChangeText={(text) => { setFullName(text); if (errors.fullName) setErrors({ ...errors, fullName: null }); }}
                                autoCapitalize="words" returnKeyType="next" />
                        </View>
                        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                            <Ionicons name="mail-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor="#A3A3A3" value={email}
                                onChangeText={(text) => { setEmail(text); if (errors.email) setErrors({ ...errors, email: null }); }}
                                autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
                        </View>
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#A3A3A3" value={password}
                                onChangeText={(text) => { setPassword(text); if (errors.password) setErrors({ ...errors, password: null }); }}
                                secureTextEntry={!showPassword} returnKeyType="next" />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                            </TouchableOpacity>
                        </View>
                        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                    </View>

                    {password.length > 0 && (
                        <View style={styles.passwordStrengthContainer}>
                            <View style={styles.passwordStrengthBar}>
                                <View style={[styles.passwordStrengthFill, { width: `${passwordStrength.strength}%`, backgroundColor: passwordStrength.color }]} />
                            </View>
                            <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>{passwordStrength.label}</Text>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                            <Ionicons name="lock-closed-outline" size={20} color="#737373" style={styles.inputIcon} />
                            <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#A3A3A3" value={confirmPassword}
                                onChangeText={(text) => { setConfirmPassword(text); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: null }); }}
                                secureTextEntry={!showConfirmPassword} returnKeyType="done" />
                            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#737373" />
                            </TouchableOpacity>
                        </View>
                        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                        {password && confirmPassword && password === confirmPassword && (
                            <View style={styles.matchIndicator}>
                                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                                <Text style={styles.matchText}>Passwords match</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity style={styles.termsContainer} onPress={() => { setAgreeToTerms(!agreeToTerms); if (errors.terms) setErrors({ ...errors, terms: null }); }}>
                        <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked, errors.terms && styles.checkboxError]}>
                            {agreeToTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.termsText}>I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text></Text>
                    </TouchableOpacity>
                    {errors.terms && <Text style={[styles.errorText, { marginTop: -8, marginBottom: 16 }]}>{errors.terms}</Text>}

                    <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
                        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Create Account</Text>}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={styles.link}>Sign In</Text></TouchableOpacity>
                    </View>

                    <View style={styles.securityBadge}>
                        <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                        <Text style={styles.securityText}>Your data is encrypted and secure</Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
    header: { marginTop: 60, marginBottom: 20 },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    titleContainer: { marginBottom: 32 },
    title: { fontSize: 28, fontWeight: '700', color: '#171717', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#737373' },
    form: { flex: 1 },
    inputContainer: { marginBottom: 16 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5', paddingHorizontal: 16, height: 56 },
    inputError: { borderColor: '#EF4444' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, color: '#171717' },
    errorText: { color: '#EF4444', fontSize: 13, marginTop: 6, marginLeft: 4 },
    passwordStrengthContainer: { marginBottom: 16 },
    passwordStrengthBar: { height: 4, backgroundColor: '#E5E5E5', borderRadius: 2, marginBottom: 6 },
    passwordStrengthFill: { height: '100%', borderRadius: 2 },
    passwordStrengthText: { fontSize: 13, fontWeight: '600' },
    matchIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    matchText: { fontSize: 13, color: '#10B981', marginLeft: 6 },
    termsContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#D4D4D4', marginRight: 12, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#F97316', borderColor: '#F97316' },
    checkboxError: { borderColor: '#EF4444' },
    termsText: { flex: 1, fontSize: 14, color: '#525252', lineHeight: 20 },
    termsLink: { color: '#F97316', fontWeight: '600' },
    button: { backgroundColor: '#F97316', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
    footerText: { fontSize: 14, color: '#737373' },
    link: { fontSize: 14, color: '#F97316', fontWeight: '600' },
    securityBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 32 },
    securityText: { fontSize: 13, color: '#10B981', marginLeft: 6 },
});

export default RegisterScreen;

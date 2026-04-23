// src/screens/payments/WalletSetupScreen.js
// Lets a user set up their Stripe Connect Express account so they can
// RECEIVE payments from friends. Stripe hosts the onboarding form.
import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
    ActivityIndicator, Alert, ScrollView, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { getConnectAccount, createOnboardingLink, createLoginLink } from '../../api/connect';

const COLORS = {
    primary: '#F97316',
    bg: '#FFFFFF',
    text: '#171717',
    textMuted: '#737373',
    success: '#10B981',
    danger: '#EF4444',
    card: '#FAFAFA',
    border: '#E5E5E5'
};

const StatusRow = ({ label, ok }) => (
    <View style={styles.statusRow}>
        <Ionicons
            name={ok ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={ok ? COLORS.success : COLORS.textMuted}
        />
        <Text style={[styles.statusText, !ok && { color: COLORS.textMuted }]}>{label}</Text>
    </View>
);

const WalletSetupScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [status, setStatus] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getConnectAccount();
            setStatus(res.data);
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Could not load wallet');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const startOnboarding = async () => {
        try {
            setWorking(true);
            const res = await createOnboardingLink();
            const url = res.data?.url;
            if (!url) throw new Error('No onboarding URL returned');
            // openAuthSessionAsync reliably returns control to the app on iOS/Android
            await WebBrowser.openAuthSessionAsync(url);
            // Re-fetch status once the browser closes
            await load();
        } catch (e) {
            Alert.alert('Error', e.error?.message || e.message || 'Could not start onboarding');
        } finally {
            setWorking(false);
        }
    };

    const openDashboard = async () => {
        try {
            setWorking(true);
            const res = await createLoginLink();
            const url = res.data?.url;
            if (url) await Linking.openURL(url);
        } catch (e) {
            Alert.alert('Error', e.error?.message || 'Could not open dashboard');
        } finally {
            setWorking(false);
        }
    };

    const ready = status?.chargesEnabled && status?.payoutsEnabled;
    const inProgress = status?.hasAccount && !ready;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Wallet & Payouts</Text>
                <View style={{ width: 32 }} />
            </View>

            {loading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.body}>
                    <View style={styles.heroCard}>
                        <Ionicons
                            name={ready ? 'shield-checkmark' : 'wallet-outline'}
                            size={48}
                            color={COLORS.primary}
                        />
                        <Text style={styles.heroTitle}>
                            {ready ? 'You\'re all set' : 'Set up payments'}
                        </Text>
                        <Text style={styles.heroBody}>
                            {ready
                                ? 'Friends can send you money and it\'ll arrive in your bank account.'
                                : 'To receive payments from friends, verify your identity with Stripe. It takes a couple of minutes and is bank-grade secure.'}
                        </Text>
                    </View>

                    <View style={styles.statusCard}>
                        <Text style={styles.sectionTitle}>Account status</Text>
                        <StatusRow label="Account created" ok={status?.hasAccount} />
                        <StatusRow label="Details submitted" ok={status?.detailsSubmitted} />
                        <StatusRow label="Receive payments" ok={status?.chargesEnabled} />
                        <StatusRow label="Payouts to bank" ok={status?.payoutsEnabled} />
                        {status?.requirements?.length > 0 && (
                            <View style={styles.requirementsBox}>
                                <Text style={styles.requirementsTitle}>Still needs:</Text>
                                {status.requirements.map((r) => (
                                    <Text key={r} style={styles.requirementsItem}>• {r.replace(/_/g, ' ')}</Text>
                                ))}
                            </View>
                        )}
                    </View>

                    {!ready && (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={startOnboarding}
                            disabled={working}
                            activeOpacity={0.85}
                        >
                            {working ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name="lock-closed" size={18} color="#FFF" />
                                    <Text style={styles.primaryBtnText}>
                                        {inProgress ? 'Continue setup' : 'Get started'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {ready && (
                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={openDashboard}
                            disabled={working}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="open-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.secondaryBtnText}>Manage in Stripe</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={load} style={styles.refreshLink}>
                        <Ionicons name="refresh" size={16} color={COLORS.textMuted} />
                        <Text style={styles.refreshText}>Refresh status</Text>
                    </TouchableOpacity>

                    <View style={styles.trustRow}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.trustText}>Payments processed by Stripe. FundFlock never sees your card or bank details.</Text>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: COLORS.border
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    body: { padding: 24, paddingBottom: 40 },
    heroCard: {
        backgroundColor: '#FFF7ED', padding: 24, borderRadius: 16,
        alignItems: 'center', marginBottom: 20
    },
    heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 12 },
    heroBody: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    statusCard: {
        backgroundColor: COLORS.card, padding: 20, borderRadius: 14,
        marginBottom: 20, borderWidth: 1, borderColor: COLORS.border
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    statusText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
    requirementsBox: { marginTop: 10, padding: 10, backgroundColor: '#FEF3C7', borderRadius: 10 },
    requirementsTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 4 },
    requirementsItem: { fontSize: 12, color: '#92400E', marginTop: 2 },
    primaryBtn: {
        backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 12,
        marginBottom: 10
    },
    primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary,
        marginBottom: 10
    },
    secondaryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
    refreshLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
    refreshText: { color: COLORS.textMuted, fontSize: 13 },
    trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 16, paddingHorizontal: 4 },
    trustText: { flex: 1, fontSize: 12, color: COLORS.textMuted, lineHeight: 18 }
});

export default WalletSetupScreen;

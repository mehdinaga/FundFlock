// src/screens/payments/SettleUpScreen.js
// Opens Stripe PaymentSheet so the current user can pay their friend
// (card / Apple Pay / Google Pay). Never touches raw card data.
//
// Requires the `@stripe/stripe-react-native` native module — only works
// in a custom dev build, not Expo Go.
import React, { useState, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
    TextInput, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { createSettlementIntent, cancelSettlement } from '../../api/payments';

const COLORS = {
    primary: '#F97316',
    bg: '#FFFFFF',
    text: '#171717',
    textMuted: '#737373',
    border: '#E5E5E5',
    danger: '#EF4444',
    success: '#10B981',
    card: '#FAFAFA'
};

const SettleUpScreen = ({ route, navigation }) => {
    const { friend, maxAmount } = route.params || {};
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    const [amountStr, setAmountStr] = useState(
        maxAmount ? maxAmount.toFixed(2) : ''
    );
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const amount = useMemo(() => parseFloat(amountStr), [amountStr]);
    const validAmount = Number.isFinite(amount) && amount >= 0.5;

    const pay = async () => {
        if (!validAmount) {
            Alert.alert('Invalid amount', 'Amount must be at least £0.50');
            return;
        }
        if (maxAmount && amount > maxAmount + 0.01) {
            Alert.alert('Amount too high', `You only owe £${maxAmount.toFixed(2)}`);
            return;
        }

        setBusy(true);
        let settlementId = null;
        try {
            // 1. Ask the backend to create a PaymentIntent
            const res = await createSettlementIntent({
                recipientId: friend._id,
                amount,
                note: note.trim() || undefined
            });
            const {
                paymentIntentClientSecret,
                ephemeralKeySecret,
                customerId,
                settlementId: sId
            } = res.data;
            settlementId = sId;

            // 2. Initialize the Payment Sheet (card, Apple Pay, Google Pay)
            const init = await initPaymentSheet({
                merchantDisplayName: 'FundFlock',
                customerId,
                customerEphemeralKeySecret: ephemeralKeySecret,
                paymentIntentClientSecret,
                allowsDelayedPaymentMethods: false,
                applePay: { merchantCountryCode: 'GB' },
                googlePay: {
                    merchantCountryCode: 'GB',
                    testEnv: __DEV__,
                    currencyCode: 'GBP'
                },
                defaultBillingDetails: {
                    name: friend?.fullName || undefined
                },
                returnURL: 'fundflock://stripe-redirect'
            });

            if (init.error) {
                throw new Error(init.error.message);
            }

            // 3. Present the sheet
            const sheet = await presentPaymentSheet();
            if (sheet.error) {
                if (sheet.error.code === 'Canceled') {
                    try { await cancelSettlement(settlementId); } catch (_) {}
                    return;
                }
                throw new Error(sheet.error.message);
            }

            Alert.alert(
                'Payment sent',
                `You paid ${friend.fullName || 'your friend'} £${amount.toFixed(2)}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (e) {
            const msg = e.error?.message || e.message || 'Payment failed';
            Alert.alert('Payment failed', msg);
            if (settlementId) {
                try { await cancelSettlement(settlementId); } catch (_) {}
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={26} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settle Up</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={styles.body}>
                <View style={styles.recipientCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {(friend?.fullName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.recipientName}>{friend?.fullName}</Text>
                    {maxAmount > 0 && (
                        <Text style={styles.owedText}>You owe £{maxAmount.toFixed(2)}</Text>
                    )}
                </View>

                <View style={styles.amountWrap}>
                    <Text style={styles.currencySign}>£</Text>
                    <TextInput
                        style={styles.amountInput}
                        value={amountStr}
                        onChangeText={setAmountStr}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#D4D4D4"
                        autoFocus
                    />
                </View>

                <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Add a note (optional)"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={280}
                />

                <TouchableOpacity
                    style={[styles.payBtn, (!validAmount || busy) && { opacity: 0.5 }]}
                    disabled={!validAmount || busy}
                    onPress={pay}
                    activeOpacity={0.85}
                >
                    {busy ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="lock-closed" size={18} color="#FFF" />
                            <Text style={styles.payBtnText}>
                                Pay £{validAmount ? amount.toFixed(2) : '0.00'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.trustRow}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.trustText}>
                        Encrypted by Stripe. Supports Apple Pay, Google Pay, and cards.
                    </Text>
                </View>
            </View>
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
    body: { padding: 24, flex: 1 },
    recipientCard: {
        alignItems: 'center', marginBottom: 24, padding: 20,
        backgroundColor: COLORS.card, borderRadius: 16
    },
    avatar: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#FED7AA', justifyContent: 'center', alignItems: 'center',
        marginBottom: 10
    },
    avatarText: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
    recipientName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    owedText: { fontSize: 13, color: COLORS.danger, marginTop: 4, fontWeight: '600' },
    amountWrap: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20
    },
    currencySign: { fontSize: 36, fontWeight: '300', color: COLORS.textMuted },
    amountInput: {
        fontSize: 56, fontWeight: '800', color: COLORS.text,
        minWidth: 160, textAlign: 'center'
    },
    noteInput: {
        borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
        paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text,
        marginBottom: 20
    },
    payBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12
    },
    payBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
    trustText: { fontSize: 12, color: COLORS.textMuted }
});

export default SettleUpScreen;

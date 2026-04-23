// src/components/ReceiptDetailModal.js
//
// A FundFlock-branded receipt rendered natively inside the app. We used to
// bounce users out to Stripe's hosted receipt page, but those URLs are only
// minted once Stripe's async charge.succeeded webhook has fired — which can
// lag the payment by several seconds, producing a confusing "Receipt not
// ready" dialog. Everything we actually need to draw a receipt already
// lives on the Settlement document (payer, recipient, amount, timestamps,
// reference IDs), so we render it locally and skip the Stripe round-trip.
//
// Tap "Share" to forward the receipt as plain text via the OS share sheet
// (Messages, Mail, Copy, etc). No extra native deps required.
import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Share,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STATUS_META = {
    succeeded: { label: 'Paid', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' },
    processing: { label: 'Processing', color: '#F59E0B', bg: '#FEF3C7', icon: 'time' },
    pending: { label: 'Pending', color: '#A3A3A3', bg: '#F5F5F5', icon: 'ellipsis-horizontal-circle' },
    failed: { label: 'Failed', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' },
    canceled: { label: 'Canceled', color: '#737373', bg: '#F5F5F5', icon: 'ban' },
    refunded: { label: 'Refunded', color: '#6366F1', bg: '#E0E7FF', icon: 'return-down-back' },
};

const fmtMoney = (cents, currency = 'gbp') => {
    const n = (cents || 0) / 100;
    try {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: (currency || 'gbp').toUpperCase(),
        }).format(n);
    } catch {
        return `£${n.toFixed(2)}`;
    }
};

const fmtDateLong = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

// Compact "FF-A1B2C3D4" style — the last 8 chars of any identifier make it
// readable without revealing the full Stripe/Mongo IDs in the UI.
const shortId = (id, prefix = '') => {
    if (!id) return '—';
    const s = String(id);
    const tail = s.length > 8 ? s.slice(-8) : s;
    return `${prefix}${tail.toUpperCase()}`;
};

const Row = ({ label, value, mono }) => (
    <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>{label}</Text>
        <Text
            style={[styles.kvValue, mono && styles.kvMono]}
            numberOfLines={2}
            selectable
        >
            {value}
        </Text>
    </View>
);

const ReceiptDetailModal = ({ visible, onClose, settlement, myId }) => {
    if (!settlement) return null;

    const isPayer = settlement.payer?._id?.toString() === myId;
    const meta = STATUS_META[settlement.status] || STATUS_META.pending;

    const payerName =
        settlement.payer?.fullName || settlement.payer?.email || 'Unknown payer';
    const recipientName =
        settlement.recipient?.fullName ||
        settlement.recipient?.email ||
        'Unknown recipient';

    const receiptNumber = shortId(settlement._id, 'FF-');
    const txnRef = shortId(
        settlement.stripePaymentIntentId || settlement.stripeChargeId
    );
    const issuedAt = fmtDateLong(
        settlement.completedAt || settlement.createdAt
    );

    const gross = settlement.amount || 0;
    const fee = settlement.applicationFeeAmount || 0;
    const net = Math.max(0, gross - fee);

    const sharePlain = async () => {
        const lines = [
            `FundFlock — Payment Receipt`,
            ``,
            `Receipt:   ${receiptNumber}`,
            `Status:    ${meta.label}`,
            `Date:      ${issuedAt}`,
            ``,
            `From:      ${payerName}${
                settlement.payer?.email ? ` (${settlement.payer.email})` : ''
            }`,
            `To:        ${recipientName}${
                settlement.recipient?.email ? ` (${settlement.recipient.email})` : ''
            }`,
            ``,
            `Amount:    ${fmtMoney(gross, settlement.currency)}`,
            ...(fee > 0
                ? [
                      `Platform fee: ${fmtMoney(fee, settlement.currency)}`,
                      `Net to recipient: ${fmtMoney(net, settlement.currency)}`,
                  ]
                : []),
            ...(settlement.note ? [``, `Note: ${settlement.note}`] : []),
            ``,
            `Transaction ref: ${txnRef}`,
            ``,
            `Thank you for using FundFlock.`,
        ];
        try {
            await Share.share({ message: lines.join('\n') });
        } catch (err) {
            Alert.alert('Share failed', err?.message || 'Could not share receipt.');
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header bar */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close" size={26} color="#171717" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Receipt</Text>
                    <TouchableOpacity
                        onPress={sharePlain}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={Platform.OS === 'ios' ? 'share-outline' : 'share-social'}
                            size={22}
                            color="#F97316"
                        />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.body}>
                    {/* Branding */}
                    <View style={styles.brandBlock}>
                        <View style={styles.brandMark}>
                            <Ionicons name="layers" size={22} color="#FFFFFF" />
                        </View>
                        <Text style={styles.brandName}>FundFlock</Text>
                        <Text style={styles.brandSub}>Payment Receipt</Text>
                    </View>

                    {/* Status + amount hero */}
                    <View style={styles.hero}>
                        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                            <Ionicons name={meta.icon} size={14} color={meta.color} />
                            <Text style={[styles.statusPillText, { color: meta.color }]}>
                                {meta.label}
                            </Text>
                        </View>
                        <Text style={styles.heroAmount}>
                            {isPayer ? '-' : '+'}
                            {fmtMoney(gross, settlement.currency)}
                        </Text>
                        <Text style={styles.heroSub}>
                            {isPayer
                                ? `Paid to ${recipientName}`
                                : `Received from ${payerName}`}
                        </Text>
                    </View>

                    {/* Parties */}
                    <View style={styles.card}>
                        <Text style={styles.sectionLabel}>Parties</Text>
                        <Row label="From" value={payerName} />
                        {!!settlement.payer?.email && (
                            <Row label="" value={settlement.payer.email} />
                        )}
                        <View style={styles.divider} />
                        <Row label="To" value={recipientName} />
                        {!!settlement.recipient?.email && (
                            <Row label="" value={settlement.recipient.email} />
                        )}
                    </View>

                    {/* Amount breakdown */}
                    <View style={styles.card}>
                        <Text style={styles.sectionLabel}>Payment</Text>
                        <Row label="Amount" value={fmtMoney(gross, settlement.currency)} />
                        {fee > 0 && (
                            <>
                                <Row
                                    label="Platform fee"
                                    value={`- ${fmtMoney(fee, settlement.currency)}`}
                                />
                                <View style={styles.divider} />
                                <Row
                                    label="Net to recipient"
                                    value={fmtMoney(net, settlement.currency)}
                                />
                            </>
                        )}
                        <View style={styles.divider} />
                        <Row
                            label="Currency"
                            value={(settlement.currency || 'gbp').toUpperCase()}
                        />
                    </View>

                    {/* Note */}
                    {!!settlement.note && (
                        <View style={styles.card}>
                            <Text style={styles.sectionLabel}>Note</Text>
                            <Text style={styles.noteBody}>“{settlement.note}”</Text>
                        </View>
                    )}

                    {/* Reference block */}
                    <View style={styles.card}>
                        <Text style={styles.sectionLabel}>Reference</Text>
                        <Row label="Receipt #" value={receiptNumber} mono />
                        <Row label="Transaction" value={txnRef} mono />
                        <Row label="Issued" value={issuedAt} />
                        {settlement.createdAt &&
                            settlement.completedAt &&
                            settlement.createdAt !== settlement.completedAt && (
                                <Row
                                    label="Initiated"
                                    value={fmtDateLong(settlement.createdAt)}
                                />
                            )}
                    </View>

                    {/* Legal / footer */}
                    <Text style={styles.footer}>
                        This receipt is generated by FundFlock for your records.
                        Payments are processed securely via Stripe.
                    </Text>
                </ScrollView>

                {/* Sticky share CTA */}
                <View style={styles.ctaBar}>
                    <TouchableOpacity style={styles.ctaBtn} onPress={sharePlain}>
                        <Ionicons name="share-social" size={16} color="#FFFFFF" />
                        <Text style={styles.ctaText}>Share receipt</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#171717' },

    body: { padding: 16, paddingBottom: 120 },

    brandBlock: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
    brandMark: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#F97316',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    brandName: { fontSize: 18, fontWeight: '800', color: '#171717' },
    brandSub: { fontSize: 13, color: '#737373', marginTop: 2 },

    hero: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        marginBottom: 14,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 12,
    },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    heroAmount: {
        fontSize: 34,
        fontWeight: '800',
        color: '#171717',
        letterSpacing: -0.5,
    },
    heroSub: { fontSize: 13, color: '#525252', marginTop: 4 },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        marginBottom: 12,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#A3A3A3',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 10,
    },

    kvRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 4,
    },
    kvLabel: { fontSize: 13, color: '#737373', flexShrink: 0 },
    kvValue: {
        flex: 1,
        fontSize: 13,
        color: '#171717',
        fontWeight: '600',
        textAlign: 'right',
    },
    kvMono: {
        fontFamily: Platform.select({
            ios: 'Menlo',
            android: 'monospace',
            default: 'monospace',
        }),
        fontSize: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#F5F5F5',
        marginVertical: 8,
    },
    noteBody: {
        fontSize: 14,
        color: '#171717',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    footer: {
        fontSize: 11,
        color: '#A3A3A3',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 16,
    },

    ctaBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingBottom: Platform.OS === 'ios' ? 28 : 14,
        backgroundColor: 'rgba(250,250,250,0.95)',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F97316',
        paddingVertical: 14,
        borderRadius: 12,
    },
    ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default ReceiptDetailModal;

// src/components/EmailAppSheet.js
//
// A cross-platform action-sheet that lets the user pick which mail app to
// compose an email in — mirrors the native iOS action-sheet look (matching
// e.g. Splitwise's "Please choose an email app" dialog). We roll our own
// instead of leaning on ActionSheetIOS so the experience is identical on
// Android and iOS, and so we can deep-link straight into each vendor's
// custom URL scheme.
import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Alert,
    Platform,
} from 'react-native';

// Each option carries the vendor scheme we try first plus a mailto fallback.
// If the vendor app isn't installed, canOpenURL returns false and we fall
// back to the OS default handler.
const buildOptions = ({ to, subject, body }) => {
    const q = (params) =>
        Object.entries(params)
            .filter(([, v]) => !!v)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');

    const mailto = `mailto:${to}?${q({ subject, body })}`;

    return [
        {
            id: 'apple',
            label: 'Apple Mail',
            // Apple Mail owns the mailto: scheme when it's the default client.
            url: `message://?${q({ to, subject, body })}`,
            fallback: mailto,
        },
        {
            id: 'gmail',
            label: 'Gmail',
            // Official Gmail iOS scheme; Android uses the Android intent
            // system via mailto which Gmail registers for.
            url: Platform.select({
                ios: `googlegmail://co?${q({ to, subject, body })}`,
                android: mailto,
                default: mailto,
            }),
            fallback: mailto,
        },
        {
            id: 'outlook',
            label: 'Microsoft Outlook',
            url: `ms-outlook://compose?${q({ to, subject, body })}`,
            fallback: mailto,
        },
        {
            id: 'yahoo',
            label: 'Yahoo Mail',
            url: `ymail://mail/compose?${q({ to, subject, body })}`,
            fallback: mailto,
        },
        {
            id: 'default',
            label: 'System Default',
            url: mailto,
            fallback: mailto,
        },
    ];
};

const EmailAppSheet = ({
    visible,
    onClose,
    to = 'support@fundflock.com',
    subject = '',
    body = '',
    title = 'Please choose an email app',
}) => {
    const options = buildOptions({ to, subject, body });

    const openWith = async (opt) => {
        // canOpenURL on iOS requires the scheme to be whitelisted in
        // LSApplicationQueriesSchemes. We still attempt openURL blindly so
        // users who haven't updated the Info.plist yet can still send mail
        // via the System Default option.
        const attempts = [opt.url, opt.fallback].filter(Boolean);
        let opened = false;
        for (const url of attempts) {
            try {
                const supported = await Linking.canOpenURL(url);
                if (supported) {
                    await Linking.openURL(url);
                    opened = true;
                    break;
                }
            } catch {
                // try next
            }
        }
        if (!opened) {
            // Final fallback — some Android OEMs lie about canOpenURL.
            try {
                await Linking.openURL(opt.fallback);
                opened = true;
            } catch {
                // ignore
            }
        }
        if (!opened) {
            Alert.alert(
                'No email app found',
                'Please install an email app or set one as your system default.'
            );
        }
        onClose?.();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.sheetWrap}>
                    <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                        <View style={styles.card}>
                            <Text style={styles.title}>{title}</Text>
                            {options.map((opt, i) => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        styles.row,
                                        i === options.length - 1 && styles.rowLast,
                                    ]}
                                    onPress={() => openWith(opt)}
                                >
                                    <Text style={styles.rowText}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.cancelCard}
                            onPress={onClose}
                        >
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
    },
    sheetWrap: {
        paddingHorizontal: 10,
        paddingBottom: 28,
    },
    card: {
        backgroundColor: 'rgba(242,242,242,0.98)',
        borderRadius: 14,
        overflow: 'hidden',
    },
    title: {
        textAlign: 'center',
        paddingVertical: 14,
        fontSize: 13,
        color: '#8E8E93',
        backgroundColor: 'rgba(242,242,242,0.98)',
        borderBottomWidth: 0.5,
        borderBottomColor: '#C6C6C8',
    },
    row: {
        paddingVertical: 16,
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#C6C6C8',
    },
    rowLast: { borderBottomWidth: 0 },
    rowText: { color: '#007AFF', fontSize: 18, fontWeight: '500' },

    cancelCard: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    cancelText: { color: '#007AFF', fontSize: 18, fontWeight: '700' },
});

export default EmailAppSheet;

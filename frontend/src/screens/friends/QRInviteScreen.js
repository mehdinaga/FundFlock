// src/screens/friends/QRInviteScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, Share, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../context/AuthContext';
import { acceptInvite } from '../../api/friends';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
    primary: '#F97316',
    background: '#FFFFFF',
    text: '#171717',
    textSecondary: '#737373',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    success: '#10B981',
};

// Helper to extract userId from any invite URL format
const parseInviteUrl = (url) => {
    if (!url) return null;
    // Match fundflock://invite/{id} OR exp://..../--/invite/{id} OR any URL with /invite/{id}
    const match = url.match(/\/invite\/([a-fA-F0-9]{24})/);
    return match ? match[1] : null;
};

const QRInviteScreen = ({ navigation }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('qr'); // 'qr' or 'scan'
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Linking.createURL generates the correct URL for the current environment:
    // - In Expo Go: exp://10.x.x.x:8081/--/invite/{userId}
    // - In standalone build: fundflock://invite/{userId}
    const inviteLink = Linking.createURL(`invite/${user?._id}`);

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(inviteLink);
        Alert.alert('Copied!', 'Invite link copied to clipboard');
    };

    const handleShareLink = async () => {
        try {
            await Share.share({
                message: `Join me on FundFlock! Add me as a friend: ${inviteLink}`,
                title: 'FundFlock Invite',
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned || processing) return;
        setScanned(true);
        setProcessing(true);

        try {
            const userId = parseInviteUrl(data);

            if (!userId) {
                Alert.alert('Invalid QR Code', 'This QR code is not a valid FundFlock invite.', [
                    { text: 'OK', onPress: () => setScanned(false) }
                ]);
                setProcessing(false);
                return;
            }

            if (userId === user?._id) {
                Alert.alert('Oops', 'You cannot add yourself as a friend!', [
                    { text: 'OK', onPress: () => setScanned(false) }
                ]);
                setProcessing(false);
                return;
            }

            const result = await acceptInvite(userId);

            if (result.success) {
                Alert.alert('Success!', result.message || 'You are now friends!', [
                    { text: 'OK', onPress: () => navigation.goBack() }
                ]);
            }
        } catch (error) {
            const msg = error?.error?.message || 'Failed to process invite';
            Alert.alert('Error', msg, [
                { text: 'OK', onPress: () => setScanned(false) }
            ]);
        } finally {
            setProcessing(false);
        }
    };

    const renderQRTab = () => (
        <View style={styles.qrContainer}>
            <View style={styles.qrCard}>
                <QRCode
                    value={inviteLink}
                    size={SCREEN_WIDTH * 0.55}
                    color="#171717"
                    backgroundColor="#FFFFFF"
                />
            </View>
            <Text style={styles.qrName}>{user?.fullName}</Text>
            <Text style={styles.qrSubtitle}>Scan this code to add me as a friend</Text>

            <View style={styles.qrActions}>
                <TouchableOpacity
                    style={styles.qrActionButton}
                    onPress={handleCopyLink}
                    activeOpacity={0.7}
                >
                    <Ionicons name="copy-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.qrActionText}>Copy link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.qrActionButton, styles.qrActionButtonFilled]}
                    onPress={handleShareLink}
                    activeOpacity={0.7}
                >
                    <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                    <Text style={[styles.qrActionText, { color: '#FFFFFF' }]}>Share</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderScanTab = () => {
        if (!permission) {
            return (
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>Requesting camera permission...</Text>
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View style={styles.permissionContainer}>
                    <Ionicons name="camera-outline" size={48} color={COLORS.textMuted} />
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionText}>
                        We need camera access to scan QR codes from your friends
                    </Text>
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={requestPermission}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.scanContainer}>
                <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                >
                    {/* Viewfinder overlay */}
                    <View style={styles.overlay}>
                        <View style={styles.overlayTop} />
                        <View style={styles.overlayMiddle}>
                            <View style={styles.overlaySide} />
                            <View style={styles.viewfinder}>
                                <View style={[styles.corner, styles.cornerTL]} />
                                <View style={[styles.corner, styles.cornerTR]} />
                                <View style={[styles.corner, styles.cornerBL]} />
                                <View style={[styles.corner, styles.cornerBR]} />
                            </View>
                            <View style={styles.overlaySide} />
                        </View>
                        <View style={styles.overlayBottom}>
                            <Text style={styles.scanHint}>
                                Point your camera at a FundFlock QR code
                            </Text>
                        </View>
                    </View>
                </CameraView>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>QR Code</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Tab Toggle */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
                    onPress={() => setActiveTab('qr')}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="qr-code-outline"
                        size={18}
                        color={activeTab === 'qr' ? '#FFFFFF' : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>
                        My QR Code
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
                    onPress={() => { setActiveTab('scan'); setScanned(false); }}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="scan-outline"
                        size={18}
                        color={activeTab === 'scan' ? '#FFFFFF' : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
                        Scan
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'qr' ? renderQRTab() : renderScanTab()}
        </SafeAreaView>
    );
};

const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.65;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
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
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 24,
        marginTop: 16,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    tabActive: {
        backgroundColor: COLORS.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    // QR Tab
    qrContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 24,
    },
    qrCard: {
        padding: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    qrName: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 24,
    },
    qrSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    qrActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 32,
        width: '100%',
    },
    qrActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    qrActionButtonFilled: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    qrActionText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
    },
    // Scan Tab
    scanContainer: {
        flex: 1,
        marginTop: 16,
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    overlayMiddle: {
        flexDirection: 'row',
        height: VIEWFINDER_SIZE,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    viewfinder: {
        width: VIEWFINDER_SIZE,
        height: VIEWFINDER_SIZE,
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderColor: COLORS.primary,
    },
    cornerTL: {
        top: 0, left: 0,
        borderTopWidth: 3, borderLeftWidth: 3,
        borderTopLeftRadius: 4,
    },
    cornerTR: {
        top: 0, right: 0,
        borderTopWidth: 3, borderRightWidth: 3,
        borderTopRightRadius: 4,
    },
    cornerBL: {
        bottom: 0, left: 0,
        borderBottomWidth: 3, borderLeftWidth: 3,
        borderBottomLeftRadius: 4,
    },
    cornerBR: {
        bottom: 0, right: 0,
        borderBottomWidth: 3, borderRightWidth: 3,
        borderBottomRightRadius: 4,
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        paddingTop: 24,
    },
    scanHint: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    // Permission
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    permissionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginTop: 16,
    },
    permissionText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    permissionButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    permissionButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default QRInviteScreen;

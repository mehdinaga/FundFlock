// frontend/App.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Temporary placeholder for main app (after login)
const MainApp = () => {
    const { user, logout } = useAuth();

    return (
        <View style={styles.mainContainer}>
            <Text style={styles.welcomeText}>Welcome to FundFlock! 🎉</Text>
            <Text style={styles.userText}>Logged in as: {user?.fullName}</Text>
            <Text style={styles.emailText}>{user?.email}</Text>
            <Text style={styles.infoText}>
                Main app screens will go here{'\n'}(Dashboard, Groups, Expenses, etc.)
            </Text>
        </View>
    );
};

// App content with auth check
const AppContent = () => {
    const { isLoggedIn, loading } = useAuth();

    // Show loading screen while checking auth
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            {isLoggedIn ? <MainApp /> : <AuthNavigator />}
        </NavigationContainer>
    );
};

// Main App component
export default function App() {
    return (
        <AuthProvider>
            <StatusBar style="dark" />
            <AppContent />
        </AuthProvider>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#737373',
    },
    mainContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 24,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#171717',
        marginBottom: 16,
    },
    userText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#525252',
        marginBottom: 8,
    },
    emailText: {
        fontSize: 15,
        color: '#737373',
        marginBottom: 32,
    },
    infoText: {
        fontSize: 14,
        color: '#A3A3A3',
        textAlign: 'center',
        lineHeight: 20,
    },
});
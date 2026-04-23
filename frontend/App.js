// frontend/App.js
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

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
            {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
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
});
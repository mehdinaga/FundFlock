// frontend/src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { isAuthenticated, getStoredUser, logout as logoutApi } from '../api/auth';

const AuthContext = createContext({
    user: null,
    loading: true,
    isLoggedIn: false,
    login: (userData) => {},
    logout: async () => {},
    updateUser: (userData) => {},
    checkAuthStatus: async () => {},
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Check if user is authenticated on app start
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const authenticated = await isAuthenticated();
            setIsLoggedIn(authenticated);

            if (authenticated) {
                const storedUser = await getStoredUser();
                setUser(storedUser);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = (userData) => {
        setUser(userData);
        setIsLoggedIn(true);
    };

    const logout = async () => {
        try {
            await logoutApi();
            setUser(null);
            setIsLoggedIn(false);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const updateUser = (userData) => {
        setUser(userData);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isLoggedIn,
                login,
                logout,
                updateUser,
                checkAuthStatus,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export default AuthContext;

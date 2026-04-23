// src/navigation/AppNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

// Friends screens
import FriendsListScreen from '../screens/friends/FriendsListScreen';
import AddFriendScreen from '../screens/friends/AddFriendScreen';
import FriendDetailScreen from '../screens/friends/FriendDetailScreen';
import PendingRequestsScreen from '../screens/friends/PendingRequestsScreen';
import QRInviteScreen from '../screens/friends/QRInviteScreen';

// Profile screens
import ProfileScreen from '../screens/profile/ProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';

const Tab = createBottomTabNavigator();
const FriendsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

// Placeholder screens for tabs not yet built
const DashboardPlaceholder = () => (
    <View style={styles.placeholder}>
        <Ionicons name="home-outline" size={48} color="#A3A3A3" />
        <Text style={styles.placeholderTitle}>Dashboard</Text>
        <Text style={styles.placeholderText}>Coming soon</Text>
    </View>
);

const GroupsPlaceholder = () => (
    <View style={styles.placeholder}>
        <Ionicons name="layers-outline" size={48} color="#A3A3A3" />
        <Text style={styles.placeholderTitle}>Groups</Text>
        <Text style={styles.placeholderText}>Coming soon</Text>
    </View>
);

// Friends tab stack navigator
const FriendsStackNavigator = () => (
    <FriendsStack.Navigator
        screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
        }}
    >
        <FriendsStack.Screen name="FriendsList" component={FriendsListScreen} />
        <FriendsStack.Screen name="AddFriend" component={AddFriendScreen} />
        <FriendsStack.Screen name="FriendDetail" component={FriendDetailScreen} />
        <FriendsStack.Screen name="PendingRequests" component={PendingRequestsScreen} />
        <FriendsStack.Screen name="QRInvite" component={QRInviteScreen} />
    </FriendsStack.Navigator>
);

// Profile tab stack navigator
const ProfileStackNavigator = () => (
    <ProfileStack.Navigator
        screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
        }}
    >
        <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
        <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
        <ProfileStack.Screen name="QRInviteFromProfile" component={QRInviteScreen} />
    </ProfileStack.Navigator>
);

const AppNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Dashboard') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Friends') {
                        iconName = focused ? 'people' : 'people-outline';
                    } else if (route.name === 'Groups') {
                        iconName = focused ? 'layers' : 'layers-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#F97316',
                tabBarInactiveTintColor: '#A3A3A3',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E5E5E5',
                    borderTopWidth: 1,
                    paddingTop: 4,
                    height: 60,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                    marginBottom: 4,
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardPlaceholder} />
            <Tab.Screen name="Friends" component={FriendsStackNavigator} />
            <Tab.Screen name="Groups" component={GroupsPlaceholder} />
            <Tab.Screen name="Profile" component={ProfileStackNavigator} />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    placeholderTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#171717',
        marginTop: 16,
    },
    placeholderText: {
        fontSize: 14,
        color: '#A3A3A3',
        marginTop: 8,
    },
});

export default AppNavigator;

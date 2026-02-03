// config/firebase.js
const admin = require('firebase-admin');

const initializeFirebase = () => {
    try {
        // Check if already initialized
        if (admin.apps.length > 0) {
            console.log('✅ Firebase already initialized');
            return;
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });

        console.log('Firebase Admin SDK initialized');
    } catch (error) {
        console.error('Firebase initialization error:', error.message);
    }
};

// Get Firebase Storage bucket
const getBucket = () => {
    return admin.storage().bucket();
};

// Get Firebase Messaging
const getMessaging = () => {
    return admin.messaging();
};

module.exports = {
    admin,
    initializeFirebase,
    getBucket,
    getMessaging
};
// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'new_expense',
            'payment_reminder',
            'payment_received',
            'added_to_group',
            'expense_updated',
            'expense_deleted',
            'friend_request',
            'friend_accepted',
            // Settlement / Stripe flow
            'settlement_received',
            'settlement_sent',
            'settlement_failed',
            'settlement_refunded',
            // Stripe Connect onboarding
            'payout_account_ready',
            'payout_account_issue'
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    body: {
        type: String,
        required: true,
        trim: true
    },
    data: {
        expenseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Expense'
        },
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Group'
        },
        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction'
        },
        fromUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        friendshipId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Friendship'
        },
        settlementId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Settlement'
        }
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isSent: {
        type: Boolean,
        default: false
    },
    sentAt: {
        type: Date,
        default: null
    },
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
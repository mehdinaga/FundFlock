// models/Settlement.js
// Tracks a single debt-settlement payment from one user to another.
const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
    payer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Amount in the smallest currency unit (cents). Always an integer.
    amount: {
        type: Number,
        required: true,
        min: 50 // Stripe minimum ~$0.50 USD
    },
    currency: {
        type: String,
        default: 'gbp',
        lowercase: true
    },
    // Optional platform fee in cents, kept for audit.
    applicationFeeAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'],
        default: 'pending',
        index: true
    },
    // Stripe object references — never re-derive amounts from these.
    stripePaymentIntentId: {
        type: String,
        default: null,
        index: true
    },
    stripeChargeId: {
        type: String,
        default: null
    },
    stripeTransferId: {
        type: String,
        default: null
    },
    failureCode: { type: String, default: null },
    failureMessage: { type: String, default: null },
    // Stripe-hosted receipt URL captured after the charge succeeds.
    // Opening this in a browser shows a fully formatted receipt the user
    // can save or print. Null until the webhook finalises the payment.
    receiptUrl: { type: String, default: null },
    // Optional human note shown in the feed.
    note: {
        type: String,
        trim: true,
        maxlength: 280,
        default: null
    },
    completedAt: { type: Date, default: null },
    // Users who have hidden this settlement from their own receipts list.
    // A settlement is never hard-deleted (it's a financial record) — when
    // one participant taps Delete on their side, we just add their id here
    // so it disappears from their feed without affecting the other party.
    hiddenFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, { timestamps: true });

settlementSchema.index({ payer: 1, recipient: 1, status: 1 });

module.exports = mongoose.model('Settlement', settlementSchema);

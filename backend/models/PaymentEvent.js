// models/PaymentEvent.js
// Append-only audit log of every Stripe webhook event processed.
// Acts as (a) idempotency table — the unique index on stripeEventId
// blocks duplicate processing if Stripe redelivers, and (b) a forensic
// trail for disputes.
const mongoose = require('mongoose');

const paymentEventSchema = new mongoose.Schema({
    stripeEventId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    type: { type: String, required: true, index: true },
    relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    relatedSettlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
    // Raw payload stored as-is for later analysis. Do NOT index its contents.
    payload: { type: mongoose.Schema.Types.Mixed },
    processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PaymentEvent', paymentEventSchema);

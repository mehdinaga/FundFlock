// controllers/webhookController.js
const stripe = require('../config/stripe');
const Settlement = require('../models/Settlement');
const PaymentEvent = require('../models/PaymentEvent');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Wrap all DB mutations in try/catch and always ack webhook 2xx once we've
// *recorded* the event, so Stripe won't keep retrying. Retryable failures
// are left with no PaymentEvent row so a future redelivery re-runs.

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set');
        return res.status(500).send('Webhook secret not configured');
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
        console.error('Stripe signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotency: if we've already processed this event id, ack & bail.
    const existing = await PaymentEvent.findOne({ stripeEventId: event.id }).lean();
    if (existing) return res.status(200).json({ received: true, dedup: true });

    try {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await onPaymentIntentSucceeded(event.data.object);
                break;
            case 'payment_intent.payment_failed':
                await onPaymentIntentFailed(event.data.object);
                break;
            case 'payment_intent.canceled':
                await onPaymentIntentCanceled(event.data.object);
                break;
            case 'charge.refunded':
                await onChargeRefunded(event.data.object);
                break;

            // Connect account lifecycle
            case 'account.updated':
                await onAccountUpdated(event.data.object);
                break;

            default:
                // Known-but-unhandled types are fine — just record & move on.
                break;
        }

        await PaymentEvent.create({
            stripeEventId: event.id,
            type: event.type,
            payload: event.data.object
        });

        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Webhook handler error:', err);
        // Do NOT record PaymentEvent — Stripe will retry.
        res.status(500).send('Internal error');
    }
};

// ─── Handlers ────────────────────────────────────────────────────────────────

const findSettlementFromPI = async (pi) => {
    const bySettlementId = pi.metadata?.settlementId;
    if (bySettlementId) {
        const s = await Settlement.findById(bySettlementId);
        if (s) return s;
    }
    return Settlement.findOne({ stripePaymentIntentId: pi.id });
};

async function onPaymentIntentSucceeded(pi) {
    const settlement = await findSettlementFromPI(pi);
    if (!settlement) return;
    if (settlement.status === 'succeeded') return;

    settlement.status = 'succeeded';
    settlement.stripeChargeId = pi.latest_charge || null;
    settlement.stripeTransferId = pi.transfer_data?.destination
        ? (pi.charges?.data?.[0]?.transfer || null)
        : null;
    settlement.completedAt = new Date();

    // Pull the Stripe-hosted receipt URL. Non-fatal on failure; we'll still
    // mark the settlement succeeded and the UI will show "Receipt pending".
    if (pi.latest_charge) {
        try {
            const charge = await stripe.charges.retrieve(pi.latest_charge);
            if (charge?.receipt_url) {
                settlement.receiptUrl = charge.receipt_url;
            }
        } catch (err) {
            console.error('Failed to fetch Stripe charge for receipt URL:', err.message);
        }
    }

    await settlement.save();

    const amountStr = `£${(settlement.amount / 100).toFixed(2)}`;

    // Notify both sides so they each see a receipt-bearing feed item.
    await Notification.insertMany([
        {
            userId: settlement.recipient,
            type: 'settlement_received',
            title: 'You received a payment',
            body: `${amountStr} was paid to settle a balance`,
            data: { settlementId: settlement._id, fromUserId: settlement.payer }
        },
        {
            userId: settlement.payer,
            type: 'settlement_sent',
            title: 'Payment sent',
            body: `Your ${amountStr} payment went through. Receipt available.`,
            data: { settlementId: settlement._id }
        }
    ]);
}

async function onPaymentIntentFailed(pi) {
    const settlement = await findSettlementFromPI(pi);
    if (!settlement) return;
    settlement.status = 'failed';
    settlement.failureCode = pi.last_payment_error?.code || null;
    settlement.failureMessage = pi.last_payment_error?.message || null;
    await settlement.save();

    // Tell the payer their attempt didn't go through so they can retry.
    await Notification.create({
        userId: settlement.payer,
        type: 'settlement_failed',
        title: 'Payment failed',
        body: settlement.failureMessage || 'Your settlement could not be processed. Please try again.',
        data: { settlementId: settlement._id }
    });
}

async function onPaymentIntentCanceled(pi) {
    const settlement = await findSettlementFromPI(pi);
    if (!settlement) return;
    if (settlement.status !== 'canceled') {
        settlement.status = 'canceled';
        await settlement.save();
    }
}

async function onChargeRefunded(charge) {
    const settlement = await Settlement.findOne({ stripeChargeId: charge.id });
    if (!settlement) return;
    settlement.status = 'refunded';
    await settlement.save();

    const amountStr = `£${(settlement.amount / 100).toFixed(2)}`;
    await Notification.insertMany([
        {
            userId: settlement.payer,
            type: 'settlement_refunded',
            title: 'Payment refunded',
            body: `Your ${amountStr} settlement was refunded.`,
            data: { settlementId: settlement._id }
        },
        {
            userId: settlement.recipient,
            type: 'settlement_refunded',
            title: 'A payment was refunded',
            body: `${amountStr} you received was refunded to the sender.`,
            data: { settlementId: settlement._id }
        }
    ]);
}

async function onAccountUpdated(account) {
    const user = await User.findOne({ stripeAccountId: account.id });
    if (!user) return;

    const wasReady = !!(user.stripeAccountStatus?.chargesEnabled && user.stripeAccountStatus?.payoutsEnabled);
    const nowReady = !!(account.charges_enabled && account.payouts_enabled);

    user.stripeAccountStatus = {
        chargesEnabled: !!account.charges_enabled,
        payoutsEnabled: !!account.payouts_enabled,
        detailsSubmitted: !!account.details_submitted,
        updatedAt: new Date()
    };
    await user.save();

    // Transition notifications: only fire on the edge, not on every account.updated ping.
    if (!wasReady && nowReady) {
        await Notification.create({
            userId: user._id,
            type: 'payout_account_ready',
            title: 'Payouts are ready',
            body: 'Your payout account is fully set up. You can now receive settlements.',
            data: {}
        });
    } else if (wasReady && !nowReady) {
        await Notification.create({
            userId: user._id,
            type: 'payout_account_issue',
            title: 'Action needed on your payout account',
            body: 'Stripe flagged your payout account. Tap to review and fix.',
            data: {}
        });
    }
}

module.exports = { handleStripeWebhook };

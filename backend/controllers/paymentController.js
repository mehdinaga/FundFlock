// controllers/paymentController.js
const User = require('../models/User');
const Settlement = require('../models/Settlement');
const stripeSvc = require('../services/stripeService');
const { computeNetBalance, toCents } = require('../services/balanceService');

// Stripe API version the iOS/Android SDK expects. Pin this; bumping has
// breaking implications.
const MOBILE_API_VERSION = '2024-06-20';

// @desc    Create a PaymentIntent to settle a debt with a friend
// @route   POST /api/v1/payments/settle
// @access  Private
// Body:    { recipientId, amount, note? }  amount is dollars, e.g. 12.34
const createSettlementIntent = async (req, res, next) => {
    try {
        const { recipientId, amount, note } = req.body;
        const payer = req.user;

        // ─── Input validation ─────────────────────────────────────────
        if (!recipientId || recipientId === payer._id.toString()) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_RECIPIENT', message: 'Invalid recipient' }
            });
        }
        const amountCents = toCents(amount);
        if (!Number.isFinite(amountCents) || amountCents < 50) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_AMOUNT', message: 'Amount must be at least $0.50' }
            });
        }
        if (amountCents > 500000) {
            // Per-transaction safety cap (configurable). 500000 cents = $5,000.
            return res.status(400).json({
                success: false,
                error: { code: 'AMOUNT_TOO_LARGE', message: 'Amount exceeds per-transaction limit' }
            });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Recipient not found' }
            });
        }

        // ─── Recipient must be able to accept money ───────────────────
        if (!recipient.stripeAccountId || !recipient.stripeAccountStatus?.chargesEnabled) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'RECIPIENT_NOT_READY',
                    message: 'Recipient has not finished setting up payments yet'
                }
            });
        }

        // ─── Re-derive the real debt server-side; never trust client ──
        const netBalance = await computeNetBalance(
            payer._id.toString(),
            recipient._id.toString()
        );
        // Negative netBalance => payer owes recipient. We only allow payments
        // up to what is actually owed, plus a tiny tolerance for rounding.
        const owedDollars = Math.max(0, -netBalance);
        const owedCents = toCents(owedDollars);
        if (amountCents > owedCents + 1) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'AMOUNT_EXCEEDS_DEBT',
                    message: 'Amount is greater than what you owe this friend',
                    meta: { maxDollars: owedDollars }
                }
            });
        }

        // ─── Ensure payer has a Stripe Customer ───────────────────────
        if (!payer.stripeCustomerId) {
            const customer = await stripeSvc.createCustomer({
                email: payer.email,
                name: payer.fullName,
                userId: payer._id
            });
            payer.stripeCustomerId = customer.id;
            await payer.save();
        }

        // ─── Create a Settlement record FIRST (pending) ───────────────
        const settlement = await Settlement.create({
            payer: payer._id,
            recipient: recipient._id,
            amount: amountCents,
            currency: 'gbp',
            status: 'pending',
            note: note?.trim() || null
        });

        // ─── Create the PaymentIntent + Ephemeral Key ─────────────────
        const paymentIntent = await stripeSvc.createSettlementPaymentIntent({
            settlementId: settlement._id,
            amount: amountCents,
            currency: 'gbp',
            payerCustomerId: payer.stripeCustomerId,
            recipientAccountId: recipient.stripeAccountId,
            metadata: {
                payerId: payer._id.toString(),
                recipientId: recipient._id.toString()
            }
        });

        settlement.stripePaymentIntentId = paymentIntent.id;
        settlement.status = 'processing';
        await settlement.save();

        const ephemeralKey = await stripeSvc.createEphemeralKey({
            customerId: payer.stripeCustomerId,
            apiVersion: MOBILE_API_VERSION
        });

        // ─── Return ONLY what the mobile SDK needs ────────────────────
        res.status(201).json({
            success: true,
            data: {
                settlementId: settlement._id,
                paymentIntentClientSecret: paymentIntent.client_secret,
                ephemeralKeySecret: ephemeralKey.secret,
                customerId: payer.stripeCustomerId,
                publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
                amount: amountCents,
                currency: 'gbp'
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel a still-unconfirmed settlement
// @route   POST /api/v1/payments/settlements/:id/cancel
// @access  Private
const cancelSettlement = async (req, res, next) => {
    try {
        const settlement = await Settlement.findById(req.params.id);
        if (!settlement) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Settlement not found' }
            });
        }
        if (settlement.payer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only the payer can cancel' }
            });
        }
        if (!['pending', 'processing'].includes(settlement.status)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_STATE', message: 'Settlement cannot be canceled in its current state' }
            });
        }
        if (settlement.stripePaymentIntentId) {
            try { await stripeSvc.cancelPaymentIntent(settlement.stripePaymentIntentId); }
            catch (e) { /* If Stripe already finalized, ignore — webhook will reconcile */ }
        }
        settlement.status = 'canceled';
        await settlement.save();
        res.json({ success: true, data: settlement });
    } catch (error) {
        next(error);
    }
};

// @desc    List the current user's settlements (sent & received)
// @route   GET /api/v1/payments/settlements
// @access  Private
const listSettlements = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const settlements = await Settlement.find({
            $or: [{ payer: userId }, { recipient: userId }],
            // Exclude anything this user has hidden from their own feed.
            hiddenFor: { $ne: userId }
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('payer', 'fullName avatar email')
            .populate('recipient', 'fullName avatar email');
        res.json({ success: true, data: settlements });
    } catch (error) {
        next(error);
    }
};

// @desc    Hide a settlement from the current user's receipts list
// @route   DELETE /api/v1/payments/settlements/:id
// @access  Private
// Settlements are financial records — we never hard-delete them. We simply
// add the requesting user to hiddenFor so it disappears from their feed
// while the other party still sees it.
const deleteSettlement = async (req, res, next) => {
    try {
        const settlement = await Settlement.findById(req.params.id);
        if (!settlement) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Settlement not found' }
            });
        }
        const userId = req.user._id.toString();
        const isParty =
            settlement.payer.toString() === userId ||
            settlement.recipient.toString() === userId;
        if (!isParty) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Not your settlement' }
            });
        }
        await Settlement.updateOne(
            { _id: settlement._id },
            { $addToSet: { hiddenFor: req.user._id } }
        );
        res.json({ success: true, message: 'Settlement hidden' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createSettlementIntent,
    cancelSettlement,
    listSettlements,
    deleteSettlement
};

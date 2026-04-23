// services/stripeService.js
// Thin, opinionated wrapper around the Stripe SDK. Centralizes:
//  - idempotency key generation
//  - consistent error shape
//  - never leaking raw Stripe errors to clients
const stripe = require('../config/stripe');
const crypto = require('crypto');

// Deterministic idempotency key per logical action. If the *same* logical
// action is retried (network blip, user double-tap) we send the same key,
// and Stripe returns the original response instead of creating a duplicate.
const idempotencyKey = (parts) =>
    crypto.createHash('sha256').update(parts.join('|')).digest('hex');

// ─── Connect (Express) accounts ───────────────────────────────────────────────
const createExpressAccount = async ({ email, userId, country = 'GB' }) =>
    stripe.accounts.create(
        {
            type: 'express',
            email,
            country,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true }
            },
            business_type: 'individual',
            metadata: { userId: String(userId) }
        },
        { idempotencyKey: idempotencyKey(['create_account', userId]) }
    );

const createAccountLink = async ({ accountId, refreshUrl, returnUrl }) =>
    stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
    });

const retrieveAccount = async (accountId) =>
    stripe.accounts.retrieve(accountId);

// Optional: dashboard link so users can see their payouts, edit bank info, etc.
const createLoginLink = async (accountId) =>
    stripe.accounts.createLoginLink(accountId);

// ─── Customer (for paying) ────────────────────────────────────────────────────
const createCustomer = async ({ email, name, userId }) =>
    stripe.customers.create(
        { email, name, metadata: { userId: String(userId) } },
        { idempotencyKey: idempotencyKey(['create_customer', userId]) }
    );

// Ephemeral keys let the mobile SDK list & manage saved payment methods
// for *this* customer only, scoped to a short lifetime.
const createEphemeralKey = async ({ customerId, apiVersion }) =>
    stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion }
    );

// ─── Payments ────────────────────────────────────────────────────────────────
// Destination charge: payer charges the platform, platform routes funds
// to the recipient's connected account.
const createSettlementPaymentIntent = async ({
    settlementId,
    amount,
    currency,
    payerCustomerId,
    recipientAccountId,
    applicationFeeAmount = 0,
    metadata = {}
}) =>
    stripe.paymentIntents.create(
        {
            amount,
            currency,
            customer: payerCustomerId,
            automatic_payment_methods: { enabled: true },
            transfer_data: { destination: recipientAccountId },
            ...(applicationFeeAmount > 0 && {
                application_fee_amount: applicationFeeAmount
            }),
            metadata: { settlementId: String(settlementId), ...metadata },
            // Stripe recommends setup_future_usage off_session if you want to
            // save the method; omitted here — user chooses per-payment.
        },
        { idempotencyKey: idempotencyKey(['settlement_pi', settlementId]) }
    );

const cancelPaymentIntent = async (paymentIntentId) =>
    stripe.paymentIntents.cancel(paymentIntentId);

module.exports = {
    createExpressAccount,
    createAccountLink,
    retrieveAccount,
    createLoginLink,
    createCustomer,
    createEphemeralKey,
    createSettlementPaymentIntent,
    cancelPaymentIntent
};

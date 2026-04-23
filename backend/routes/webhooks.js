// routes/webhooks.js
const express = require('express');
const { handleStripeWebhook } = require('../controllers/webhookController');

const router = express.Router();

// IMPORTANT: raw body is required for Stripe signature verification.
// This must run BEFORE express.json() can touch the request body.
router.post(
    '/stripe',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook
);

module.exports = router;

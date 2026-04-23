// routes/connect.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middlewares/auth');
const {
    getAccountStatus,
    createOnboardingLink,
    createLoginLink,
    onboardingReturn,
    onboardingRefresh
} = require('../controllers/connectController');

const router = express.Router();

// Heavier rate limit on onboarding — each call hits Stripe.
const connectLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

router.get('/account', protect, connectLimiter, getAccountStatus);
router.post('/onboarding-link', protect, connectLimiter, createOnboardingLink);
router.post('/login-link', protect, connectLimiter, createLoginLink);

// Stripe redirect targets — public (no auth).
router.get('/onboarding/return', onboardingReturn);
router.get('/onboarding/refresh', onboardingRefresh);

module.exports = router;

// controllers/connectController.js
const User = require('../models/User');
const stripeSvc = require('../services/stripeService');

// Absolute URLs that Stripe redirects to after hosted onboarding.
// These should ideally deep-link back into the app; for now point them at
// a simple in-app screen that polls account status.
const buildOnboardingUrls = () => {
    const base = process.env.BASE_URL || 'http://localhost:3000';
    return {
        refreshUrl: `${base}/api/v1/connect/onboarding/refresh`,
        returnUrl: `${base}/api/v1/connect/onboarding/return`
    };
};

// @desc    Get the current user's Connect account status
// @route   GET /api/v1/connect/account
// @access  Private
const getAccountStatus = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user.stripeAccountId) {
            return res.json({
                success: true,
                data: {
                    hasAccount: false,
                    chargesEnabled: false,
                    payoutsEnabled: false,
                    detailsSubmitted: false
                }
            });
        }
        const account = await stripeSvc.retrieveAccount(user.stripeAccountId);
        // Cache the flags locally
        user.stripeAccountStatus = {
            chargesEnabled: !!account.charges_enabled,
            payoutsEnabled: !!account.payouts_enabled,
            detailsSubmitted: !!account.details_submitted,
            updatedAt: new Date()
        };
        await user.save();

        res.json({
            success: true,
            data: {
                hasAccount: true,
                chargesEnabled: account.charges_enabled,
                payoutsEnabled: account.payouts_enabled,
                detailsSubmitted: account.details_submitted,
                requirements: account.requirements?.currently_due || []
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Start or resume Express onboarding
// @route   POST /api/v1/connect/onboarding-link
// @access  Private
const createOnboardingLink = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user.stripeAccountId) {
            const account = await stripeSvc.createExpressAccount({
                email: user.email,
                userId: user._id
            });
            user.stripeAccountId = account.id;
            await user.save();
        }

        const { refreshUrl, returnUrl } = buildOnboardingUrls();
        const link = await stripeSvc.createAccountLink({
            accountId: user.stripeAccountId,
            refreshUrl,
            returnUrl
        });

        res.json({
            success: true,
            data: { url: link.url, expiresAt: link.expires_at }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    One-time Stripe-hosted Express dashboard link
// @route   POST /api/v1/connect/login-link
// @access  Private
const createLoginLink = async (req, res, next) => {
    try {
        if (!req.user.stripeAccountId) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_ACCOUNT', message: 'No Connect account exists for this user' }
            });
        }
        const link = await stripeSvc.createLoginLink(req.user.stripeAccountId);
        res.json({ success: true, data: { url: link.url } });
    } catch (error) {
        next(error);
    }
};

// Very simple HTML responses for the Stripe return URLs — the mobile client
// sees these only briefly while it polls /connect/account for the real status.
const onboardingReturn = (req, res) => {
    res.send('<html><body><h3>All set.</h3><p>You can return to FundFlock.</p></body></html>');
};
const onboardingRefresh = (req, res) => {
    res.send('<html><body><h3>Session expired.</h3><p>Please restart onboarding from the app.</p></body></html>');
};

module.exports = {
    getAccountStatus,
    createOnboardingLink,
    createLoginLink,
    onboardingReturn,
    onboardingRefresh
};

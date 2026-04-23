// routes/payments.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../middlewares/auth');
const {
    createSettlementIntent,
    cancelSettlement,
    listSettlements,
    deleteSettlement
} = require('../controllers/paymentController');

const router = express.Router();

// Strict limit on payment creation to frustrate abuse (e.g. card testing).
// These numbers can be tuned; an authenticated user rarely needs more than
// a handful of payment attempts per minute.
const paymentCreateLimiter = rateLimit({ windowMs: 60 * 1000, max: 6 });
const paymentReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

router.post('/settle', protect, paymentCreateLimiter, createSettlementIntent);
router.post('/settlements/:id/cancel', protect, paymentCreateLimiter, cancelSettlement);
router.delete('/settlements/:id', protect, paymentReadLimiter, deleteSettlement);
router.get('/settlements', protect, paymentReadLimiter, listSettlements);

module.exports = router;

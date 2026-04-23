// services/balanceService.js
// Computes the net monetary balance between two users based on expenses
// AND any succeeded settlements. This is the SOURCE OF TRUTH for "how
// much can Alice pay Bob right now". Never trust the client.
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');

// Returns a number in *dollars* (float, rounded to 2dp).
// Positive => `friendId` owes `userId` (you are owed)
// Negative => `userId` owes `friendId` (you owe)
const computeNetBalance = async (userIdStr, friendIdStr) => {
    // Use the same query as getExpenses() on the frontend — all expenses where
    // the user is a member — then check splits for the friend's involvement.
    // The previous $all query missed expenses where the friend was in splits
    // but not explicitly in the members array, causing a frontend/backend
    // balance mismatch that triggered AMOUNT_EXCEEDS_DEBT errors.
    const expenses = await Expense.find({
        members: userIdStr
    }).lean();

    let balance = 0;
    for (const expense of expenses) {
        const payer = (expense.paidBy?._id || expense.paidBy || '').toString();
        const splits = expense.splits || [];
        const findShare = (uid) => {
            const s = splits.find((sp) => (sp.user?._id || sp.user || '').toString() === uid);
            return s?.amount || 0;
        };
        if (payer === userIdStr) balance += findShare(friendIdStr);
        else if (payer === friendIdStr) balance -= findShare(userIdStr);
    }

    // Apply succeeded AND processing settlements — matches the frontend's
    // optimistic balance display. Processing means Stripe confirmed the
    // charge but the webhook hasn't fired yet (usually < 3s); counting it
    // here prevents the "amount exceeds debt" error right after a payment.
    const settlements = await Settlement.find({
        status: { $in: ['succeeded', 'processing'] },
        $or: [
            { payer: userIdStr, recipient: friendIdStr },
            { payer: friendIdStr, recipient: userIdStr }
        ]
    }).lean();

    for (const s of settlements) {
        const amountDollars = s.amount / 100;
        if (s.payer.toString() === userIdStr) {
            // user paid friend => reduces what user owes (i.e. raises balance)
            balance += amountDollars;
        } else {
            // friend paid user => reduces what friend owes (i.e. lowers balance)
            balance -= amountDollars;
        }
    }

    return Math.round(balance * 100) / 100;
};

// Convert dollars -> integer cents safely.
const toCents = (dollars) => Math.round(parseFloat(dollars) * 100);

module.exports = { computeNetBalance, toCents };

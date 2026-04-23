// routes/expenses.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    createExpense,
    getExpenses,
    getExpense,
    updateExpense,
    deleteExpense,
    getGroupExpenses,
    getFriendExpenses
} = require('../controllers/expenseController');

router.use(protect);

router.get('/group/:groupId', getGroupExpenses);
router.get('/friend/:friendId', getFriendExpenses);
router.route('/').get(getExpenses).post(createExpense);
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense);

module.exports = router;

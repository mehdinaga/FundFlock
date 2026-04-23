// controllers/expenseController.js
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Notification = require('../models/Notification');

// Helper: create notifications for all expense members except the actor.
const notifyMembers = async ({ expense, type, title, body, excludeUserId }) => {
    const targets = expense.members.filter(
        (id) => id.toString() !== excludeUserId.toString()
    );
    const docs = targets.map((userId) => ({
        userId,
        type,
        title,
        body,
        data: {
            expenseId: expense._id,
            ...(expense.group ? { groupId: expense.group } : {})
        }
    }));
    if (docs.length) await Notification.insertMany(docs);
};

// @desc    Create expense
// @route   POST /api/v1/expenses
// @access  Private
const createExpense = async (req, res, next) => {
    try {
        const { title, amount, category, subcategory, splitType, splits, groupId, members, notes, paidBy, expenseDate } = req.body;

        const memberIds = [req.user._id.toString(), ...(members || [])].filter(
            (v, i, a) => a.indexOf(v) === i
        );

        // Ensure every split participant is in members so balance queries find this expense
        const splitUserIds = (splits || []).map(s => (s.user || '').toString()).filter(Boolean);
        const allMemberIds = [...new Set([...memberIds, ...splitUserIds])];

        // paidBy defaults to creator; if supplied, must be one of the members
        let payerId = req.user._id;
        if (paidBy) {
            const payerStr = paidBy.toString();
            if (!allMemberIds.includes(payerStr)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_PAYER', message: 'paidBy must be one of the expense members' }
                });
            }
            payerId = payerStr;
        }

        let parsedDate = null;
        if (expenseDate) {
            const d = new Date(expenseDate);
            if (!isNaN(d.getTime())) parsedDate = d;
        }

        const expense = await Expense.create({
            title,
            amount,
            category: category || null,
            subcategory: subcategory || null,
            paidBy: payerId,
            splitType,
            splits: splits || [],
            groupId: groupId || null,
            members: allMemberIds,
            notes: notes || null,
            expenseDate: parsedDate
        });

        if (groupId) {
            await Group.findByIdAndUpdate(groupId, { lastActivityAt: new Date() });
        }

        const populated = await Expense.findById(expense._id)
            .populate('paidBy', 'fullName avatar email')
            .populate('members', 'fullName avatar email')
            .populate('splits.user', 'fullName avatar email');

        await notifyMembers({
            expense: populated,
            type: 'new_expense',
            title: 'New Expense Added',
            body: `${req.user.fullName} added "${title}" for $${amount}`,
            excludeUserId: req.user._id
        });

        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all expenses for current user
// @route   GET /api/v1/expenses
// @access  Private
const getExpenses = async (req, res, next) => {
    try {
        const expenses = await Expense.find({ members: req.user._id })
            .sort({ createdAt: -1 })
            .populate('paidBy', 'fullName avatar email')
            .populate('members', 'fullName avatar email')
            .populate('splits.user', 'fullName avatar email')
            .populate('groupId', 'name avatar');

        res.status(200).json({ success: true, data: expenses });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single expense
// @route   GET /api/v1/expenses/:id
// @access  Private
const getExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('paidBy', 'fullName avatar email')
            .populate('members', 'fullName avatar email')
            .populate('splits.user', 'fullName avatar email')
            .populate('groupId', 'name avatar');

        if (!expense) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Expense not found' }
            });
        }

        const isMember = expense.members.some(
            (m) => m._id.toString() === req.user._id.toString()
        );
        if (!isMember) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            });
        }

        res.status(200).json({ success: true, data: expense });
    } catch (error) {
        next(error);
    }
};

// @desc    Update expense (any member can update)
// @route   PUT /api/v1/expenses/:id
// @access  Private
const updateExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Expense not found' }
            });
        }

        const isMember = expense.members.some(
            (m) => m.toString() === req.user._id.toString()
        );
        if (!isMember) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only expense members can update it' }
            });
        }

        const { title, amount, category, subcategory, notes, splits, splitType, paidBy, members, groupId, expenseDate } = req.body;

        if (title !== undefined) expense.title = title;
        if (amount !== undefined) expense.amount = amount;
        if (category !== undefined) expense.category = category;
        if (subcategory !== undefined) expense.subcategory = subcategory || null;
        if (notes !== undefined) expense.notes = notes;
        if (splits !== undefined) expense.splits = splits;
        if (splitType !== undefined) expense.splitType = splitType;

        if (expenseDate !== undefined) {
            if (expenseDate === null || expenseDate === '') {
                expense.expenseDate = null;
            } else {
                const d = new Date(expenseDate);
                if (isNaN(d.getTime())) {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'INVALID_DATE', message: 'expenseDate is not a valid date' }
                    });
                }
                expense.expenseDate = d;
            }
        }

        if (groupId !== undefined) {
            // Allow null / '' to detach from a group
            const next = groupId || null;
            if (next) {
                const group = await Group.findById(next);
                if (!group) {
                    return res.status(404).json({
                        success: false,
                        error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' }
                    });
                }
                const isGroupMember = group.members.some(
                    (m) => m.user.toString() === req.user._id.toString()
                );
                if (!isGroupMember) {
                    return res.status(403).json({
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'You are not a member of that group' }
                    });
                }
                expense.groupId = next;
                await Group.findByIdAndUpdate(next, { lastActivityAt: new Date() });
            } else {
                expense.groupId = null;
            }
        }

        if (members !== undefined) {
            const nextMembers = [...new Set(members.map((id) => id.toString()))];
            // Always keep the current user as a member
            if (!nextMembers.includes(req.user._id.toString())) {
                nextMembers.push(req.user._id.toString());
            }
            // Ensure split participants are also included
            const updatedSplits = splits !== undefined ? splits : expense.splits;
            const splitUids = (updatedSplits || []).map(s => (s.user || '').toString()).filter(Boolean);
            expense.members = [...new Set([...nextMembers, ...splitUids])];
        } else if (splits !== undefined) {
            // splits changed but members wasn't explicitly provided — sync members too
            const splitUids = splits.map(s => (s.user || '').toString()).filter(Boolean);
            const existing = expense.members.map(m => m.toString());
            expense.members = [...new Set([...existing, ...splitUids])];
        }

        if (paidBy !== undefined) {
            const payerStr = paidBy.toString();
            const memberStrs = expense.members.map((m) => m.toString());
            if (!memberStrs.includes(payerStr)) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_PAYER', message: 'paidBy must be one of the expense members' }
                });
            }
            expense.paidBy = payerStr;
        }

        await expense.save();

        const populated = await Expense.findById(expense._id)
            .populate('paidBy', 'fullName avatar email')
            .populate('members', 'fullName avatar email')
            .populate('splits.user', 'fullName avatar email')
            .populate('groupId', 'name avatar');

        await notifyMembers({
            expense: populated,
            type: 'expense_updated',
            title: 'Expense Updated',
            body: `${req.user.fullName} updated "${expense.title}"`,
            excludeUserId: req.user._id
        });

        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete expense (only paidBy can delete)
// @route   DELETE /api/v1/expenses/:id
// @access  Private
const deleteExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Expense not found' }
            });
        }

        if (expense.paidBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only the expense creator can delete it' }
            });
        }

        await notifyMembers({
            expense,
            type: 'expense_deleted',
            title: 'Expense Deleted',
            body: `${req.user.fullName} deleted "${expense.title}"`,
            excludeUserId: req.user._id
        });

        await expense.deleteOne();

        res.status(200).json({ success: true, message: 'Expense deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get expenses for a group
// @route   GET /api/v1/expenses/group/:groupId
// @access  Private
const getGroupExpenses = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Group not found' }
            });
        }

        const isMember = group.members.some(
            (m) => m.user.toString() === req.user._id.toString()
        );
        if (!isMember) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            });
        }

        const expenses = await Expense.find({ groupId: req.params.groupId })
            .sort({ createdAt: -1 })
            .populate('paidBy', 'fullName avatar email')
            .populate('members', 'fullName avatar email')
            .populate('splits.user', 'fullName avatar email');

        res.status(200).json({ success: true, data: expenses });
    } catch (error) {
        next(error);
    }
};

// @desc    Get expenses shared with a specific friend
// @route   GET /api/v1/expenses/friend/:friendId
// @access  Private
const getFriendExpenses = async (req, res, next) => {
    try {
        const { friendId } = req.params;
        const userId = req.user._id;

        const expenses = await Expense.find({
            members: { $all: [userId, friendId] }
        })
            .sort({ createdAt: -1 })
            .populate('paidBy', 'fullName avatar email')
            .populate('members', 'fullName avatar email')
            .populate('splits.user', 'fullName avatar email')
            .populate('groupId', 'name avatar');

        res.status(200).json({ success: true, data: expenses });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createExpense,
    getExpenses,
    getExpense,
    updateExpense,
    deleteExpense,
    getGroupExpenses,
    getFriendExpenses
};

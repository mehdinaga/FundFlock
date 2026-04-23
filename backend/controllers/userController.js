// controllers/userController.js
const User = require('../models/User');

// @desc    Search users by name or email
// @route   GET /api/v1/users/search?q=query
// @access  Private
const searchUsers = async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Search query must be at least 2 characters' }
            });
        }

        const users = await User.find({
            _id: { $ne: req.user._id },
            $or: [
                { fullName: { $regex: q.trim(), $options: 'i' } },
                { email: { $regex: q.trim(), $options: 'i' } }
            ]
        })
            .select('fullName avatar email')
            .limit(20);

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private
const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('fullName avatar email');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

module.exports = { searchUsers, getUser };

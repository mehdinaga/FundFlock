// controllers/notificationController.js
const Notification = require('../models/Notification');

// @desc    Get notifications for current user
// @route   GET /api/v1/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('data.fromUserId', 'fullName avatar');

        res.status(200).json({ success: true, data: notifications });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
const markRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Notification not found' }
            });
        }

        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read-all
// @access  Private
const markAllRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get unread count
// @route   GET /api/v1/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
        res.status(200).json({ success: true, data: { count } });
    } catch (error) {
        next(error);
    }
};

module.exports = { getNotifications, markRead, markAllRead, getUnreadCount };

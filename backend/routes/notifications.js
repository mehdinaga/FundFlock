// routes/notifications.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getNotifications, markRead, markAllRead, getUnreadCount } = require('../controllers/notificationController');

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);

module.exports = router;

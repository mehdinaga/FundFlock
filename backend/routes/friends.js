// routes/friends.js
const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { validate } = require('../middlewares/validator');
const { protect } = require('../middlewares/auth');
const {
    searchUserByEmail,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    getFriends,
    getPendingRequests,
    removeFriend,
    generateInviteLink,
    acceptInviteLink
} = require('../controllers/friendController');

// Validation rules
const emailValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail()
];

const searchValidation = [
    query('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
];

const friendshipIdValidation = [
    param('friendshipId')
        .isMongoId()
        .withMessage('Invalid friendship ID')
];

const inviteAcceptValidation = [
    body('userId')
        .notEmpty()
        .withMessage('User ID is required')
        .isMongoId()
        .withMessage('Invalid user ID')
];

// All routes require authentication
router.use(protect);

// Routes
router.get('/', getFriends);
router.get('/pending', getPendingRequests);
router.get('/search', searchValidation, validate, searchUserByEmail);
router.post('/request', emailValidation, validate, sendFriendRequest);
router.put('/:friendshipId/accept', friendshipIdValidation, validate, acceptFriendRequest);
router.put('/:friendshipId/decline', friendshipIdValidation, validate, declineFriendRequest);
router.delete('/:friendshipId', friendshipIdValidation, validate, removeFriend);
router.post('/invite', generateInviteLink);
router.post('/invite/accept', inviteAcceptValidation, validate, acceptInviteLink);

module.exports = router;

// controllers/friendController.js
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Notification = require('../models/Notification');

// Compute net balance between two users from shared expenses AND settlements.
// Positive result => the friend owes the current user.
// Negative result => the current user owes the friend.
// `settlementsByPair` is a Map keyed by sorted "userA_userB" -> array of succeeded
// settlements between that pair.
const computeBalanceBetween = (userIdStr, friendIdStr, expenses, settlementsByPair) => {
    let balance = 0;
    for (const exp of expenses) {
        const payer = exp.paidBy?.toString();
        const members = (exp.members || []).map((m) => m.toString());
        if (!members.includes(userIdStr) || !members.includes(friendIdStr)) continue;

        const findShare = (uid) => {
            const s = (exp.splits || []).find(
                (sp) => (sp.user?.toString?.() || sp.user) === uid
            );
            return s ? (s.amount || 0) : 0;
        };

        if (payer === userIdStr) {
            // Friend's share is owed to current user
            balance += findShare(friendIdStr);
        } else if (payer === friendIdStr) {
            // Current user's share is owed to friend
            balance -= findShare(userIdStr);
        }
    }

    // Apply succeeded settlements between the two users.
    if (settlementsByPair) {
        const key = [userIdStr, friendIdStr].sort().join('_');
        const list = settlementsByPair.get(key) || [];
        for (const s of list) {
            const amountDollars = (s.amount || 0) / 100; // Settlement.amount is cents
            if (s.payer.toString() === userIdStr) {
                // user paid friend => reduces what user owes (raises balance)
                balance += amountDollars;
            } else {
                // friend paid user => reduces what friend owes (lowers balance)
                balance -= amountDollars;
            }
        }
    }

    // Round to 2 decimals
    return Math.round(balance * 100) / 100;
};

// @desc    Search user by email
// @route   GET /api/v1/friends/search?email=
// @access  Private
const searchUserByEmail = async (req, res, next) => {
    try {
        const { email } = req.query;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'No user found with this email on FundFlock'
                }
            });
        }

        // Don't return self
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'SELF_SEARCH',
                    message: 'This is your own email address'
                }
            });
        }

        // Check existing friendship status
        const existingFriendship = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: user._id },
                { requester: user._id, recipient: req.user.id }
            ]
        });

        let friendshipStatus = null;
        let friendshipId = null;

        if (existingFriendship) {
            friendshipStatus = existingFriendship.status;
            friendshipId = existingFriendship._id;
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    avatar: user.avatar
                },
                friendshipStatus,
                friendshipId
            }
        });
    } catch (error) {
        console.error('Search user error:', error);
        next(error);
    }
};

// @desc    Send friend request
// @route   POST /api/v1/friends/request
// @access  Private
const sendFriendRequest = async (req, res, next) => {
    try {
        const { email } = req.body;

        const recipient = await User.findOne({ email: email.toLowerCase() });

        if (!recipient) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'No user found with this email on FundFlock'
                }
            });
        }

        if (recipient._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'SELF_REQUEST',
                    message: 'You cannot send a friend request to yourself'
                }
            });
        }

        // Check existing friendship
        const existingFriendship = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: recipient._id },
                { requester: recipient._id, recipient: req.user.id }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'ALREADY_FRIENDS',
                        message: 'You are already friends with this user'
                    }
                });
            }

            if (existingFriendship.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'REQUEST_PENDING',
                        message: 'A friend request is already pending with this user'
                    }
                });
            }

            if (existingFriendship.status === 'declined') {
                // Re-send the request
                existingFriendship.requester = req.user.id;
                existingFriendship.recipient = recipient._id;
                existingFriendship.status = 'pending';
                await existingFriendship.save();

                const populated = await Friendship.findById(existingFriendship._id)
                    .populate('requester', 'fullName email avatar')
                    .populate('recipient', 'fullName email avatar');

                await Notification.create({
                    userId: recipient._id,
                    type: 'friend_request',
                    title: 'New Friend Request',
                    body: `${req.user.fullName} sent you a friend request`,
                    data: {
                        fromUserId: req.user.id,
                        friendshipId: existingFriendship._id
                    }
                });

                return res.status(200).json({
                    success: true,
                    data: populated,
                    message: 'Friend request sent'
                });
            }
        }

        // Create new friendship
        const friendship = await Friendship.create({
            requester: req.user.id,
            recipient: recipient._id,
            status: 'pending'
        });

        const populated = await Friendship.findById(friendship._id)
            .populate('requester', 'fullName email avatar')
            .populate('recipient', 'fullName email avatar');

        await Notification.create({
            userId: recipient._id,
            type: 'friend_request',
            title: 'New Friend Request',
            body: `${req.user.fullName} sent you a friend request`,
            data: {
                fromUserId: req.user.id,
                friendshipId: friendship._id
            }
        });

        res.status(201).json({
            success: true,
            data: populated,
            message: 'Friend request sent'
        });
    } catch (error) {
        console.error('Send friend request error:', error);
        next(error);
    }
};

// @desc    Accept friend request
// @route   PUT /api/v1/friends/:friendshipId/accept
// @access  Private
const acceptFriendRequest = async (req, res, next) => {
    try {
        const { friendshipId } = req.params;

        const friendship = await Friendship.findOne({
            _id: friendshipId,
            recipient: req.user.id,
            status: 'pending'
        });

        if (!friendship) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Friend request not found'
                }
            });
        }

        friendship.status = 'accepted';
        await friendship.save();

        const populated = await Friendship.findById(friendship._id)
            .populate('requester', 'fullName email avatar')
            .populate('recipient', 'fullName email avatar');

        await Notification.create({
            userId: friendship.requester,
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            body: `${req.user.fullName} accepted your friend request`,
            data: {
                fromUserId: req.user.id,
                friendshipId: friendship._id
            }
        });

        res.status(200).json({
            success: true,
            data: populated,
            message: 'Friend request accepted'
        });
    } catch (error) {
        console.error('Accept friend request error:', error);
        next(error);
    }
};

// @desc    Decline friend request
// @route   PUT /api/v1/friends/:friendshipId/decline
// @access  Private
const declineFriendRequest = async (req, res, next) => {
    try {
        const { friendshipId } = req.params;

        const friendship = await Friendship.findOne({
            _id: friendshipId,
            recipient: req.user.id,
            status: 'pending'
        });

        if (!friendship) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Friend request not found'
                }
            });
        }

        friendship.status = 'declined';
        await friendship.save();

        res.status(200).json({
            success: true,
            message: 'Friend request declined'
        });
    } catch (error) {
        console.error('Decline friend request error:', error);
        next(error);
    }
};

// @desc    Get all friends
// @route   GET /api/v1/friends
// @access  Private
const getFriends = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const friendships = await Friendship.find({
            $or: [
                { requester: userId, status: 'accepted' },
                { recipient: userId, status: 'accepted' }
            ]
        })
            .populate('requester', 'fullName email avatar')
            .populate('recipient', 'fullName email avatar')
            .sort({ updatedAt: -1 });

        // Load all expenses the user is part of once to compute balances
        const expenses = await Expense.find({ members: userId }).select(
            'paidBy splits members amount'
        );

        // Load all succeeded settlements involving this user. Index by a
        // sorted-pair key so computeBalanceBetween can look them up in O(1).
        const allSettlements = await Settlement.find({
            status: 'succeeded',
            $or: [{ payer: userId }, { recipient: userId }]
        }).select('payer recipient amount');

        const settlementsByPair = new Map();
        for (const s of allSettlements) {
            const key = [s.payer.toString(), s.recipient.toString()].sort().join('_');
            if (!settlementsByPair.has(key)) settlementsByPair.set(key, []);
            settlementsByPair.get(key).push(s);
        }

        const friends = friendships
            // Skip friendships where either side has been deleted.
            // After populate(), a dangling ref returns null, and we would
            // otherwise crash on `f.requester._id`.
            .filter(f => f.requester && f.recipient)
            .map(f => {
                const isRequester = f.requester._id.toString() === userId;
                const friend = isRequester ? f.recipient : f.requester;

                return {
                    friendshipId: f._id,
                    friend: {
                        _id: friend._id,
                        fullName: friend.fullName,
                        email: friend.email,
                        avatar: friend.avatar
                    },
                    since: f.createdAt,
                    balance: computeBalanceBetween(
                        userId,
                        friend._id.toString(),
                        expenses,
                        settlementsByPair
                    )
                };
            });

        res.status(200).json({
            success: true,
            data: {
                friends,
                count: friends.length
            }
        });
    } catch (error) {
        console.error('Get friends error:', error);
        next(error);
    }
};

// @desc    Get pending friend requests
// @route   GET /api/v1/friends/pending
// @access  Private
const getPendingRequests = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const received = await Friendship.find({
            recipient: userId,
            status: 'pending'
        })
            .populate('requester', 'fullName email avatar')
            .sort({ createdAt: -1 });

        const sent = await Friendship.find({
            requester: userId,
            status: 'pending'
        })
            .populate('recipient', 'fullName email avatar')
            .sort({ createdAt: -1 });

        const receivedFormatted = received
            .filter(f => f.requester)
            .map(f => ({
                friendshipId: f._id,
                user: {
                    _id: f.requester._id,
                    fullName: f.requester.fullName,
                    email: f.requester.email,
                    avatar: f.requester.avatar
                },
                createdAt: f.createdAt
            }));

        const sentFormatted = sent
            .filter(f => f.recipient)
            .map(f => ({
                friendshipId: f._id,
                user: {
                    _id: f.recipient._id,
                    fullName: f.recipient.fullName,
                    email: f.recipient.email,
                    avatar: f.recipient.avatar
                },
                createdAt: f.createdAt
            }));

        res.status(200).json({
            success: true,
            data: {
                received: receivedFormatted,
                sent: sentFormatted,
                receivedCount: receivedFormatted.length,
                sentCount: sentFormatted.length
            }
        });
    } catch (error) {
        console.error('Get pending requests error:', error);
        next(error);
    }
};

// @desc    Remove friend
// @route   DELETE /api/v1/friends/:friendshipId
// @access  Private
const removeFriend = async (req, res, next) => {
    try {
        const { friendshipId } = req.params;
        const userId = req.user.id;

        const friendship = await Friendship.findOne({
            _id: friendshipId,
            $or: [
                { requester: userId },
                { recipient: userId }
            ],
            status: 'accepted'
        });

        if (!friendship) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Friendship not found'
                }
            });
        }

        await Friendship.findByIdAndDelete(friendshipId);

        res.status(200).json({
            success: true,
            message: 'Friend removed successfully'
        });
    } catch (error) {
        console.error('Remove friend error:', error);
        next(error);
    }
};

// @desc    Generate invite link
// @route   POST /api/v1/friends/invite
// @access  Private
const generateInviteLink = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const inviteLink = `fundflock://invite/${userId}`;

        res.status(200).json({
            success: true,
            data: {
                inviteLink,
                userId
            }
        });
    } catch (error) {
        console.error('Generate invite link error:', error);
        next(error);
    }
};

// @desc    Accept invite link
// @route   POST /api/v1/friends/invite/accept
// @access  Private
const acceptInviteLink = async (req, res, next) => {
    try {
        const { userId } = req.body;

        const inviter = await User.findById(userId);

        if (!inviter) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'The user who invited you was not found'
                }
            });
        }

        if (inviter._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'SELF_REQUEST',
                    message: 'You cannot add yourself as a friend'
                }
            });
        }

        // Check existing friendship
        const existingFriendship = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: inviter._id },
                { requester: inviter._id, recipient: req.user.id }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'ALREADY_FRIENDS',
                        message: 'You are already friends with this user'
                    }
                });
            }

            // Auto-accept pending or re-activate declined
            existingFriendship.status = 'accepted';
            await existingFriendship.save();

            const populated = await Friendship.findById(existingFriendship._id)
                .populate('requester', 'fullName email avatar')
                .populate('recipient', 'fullName email avatar');

            return res.status(200).json({
                success: true,
                data: populated,
                message: 'You are now friends'
            });
        }

        // Create new auto-accepted friendship
        const friendship = await Friendship.create({
            requester: inviter._id,
            recipient: req.user.id,
            status: 'accepted'
        });

        const populated = await Friendship.findById(friendship._id)
            .populate('requester', 'fullName email avatar')
            .populate('recipient', 'fullName email avatar');

        await Notification.create({
            userId: inviter._id,
            type: 'friend_accepted',
            title: 'New Friend Added',
            body: `${req.user.fullName} joined via your invite link`,
            data: {
                fromUserId: req.user.id,
                friendshipId: friendship._id
            }
        });

        res.status(201).json({
            success: true,
            data: populated,
            message: 'You are now friends'
        });
    } catch (error) {
        console.error('Accept invite link error:', error);
        next(error);
    }
};

module.exports = {
    searchUserByEmail,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    getFriends,
    getPendingRequests,
    removeFriend,
    generateInviteLink,
    acceptInviteLink
};

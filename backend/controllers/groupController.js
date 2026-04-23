// controllers/groupController.js
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const crypto = require('crypto');

const generateInviteCode = () => crypto.randomBytes(6).toString('hex').toUpperCase();

// @desc    Create group
// @route   POST /api/v1/groups
// @access  Private
const createGroup = async (req, res, next) => {
    try {
        const { name, avatar, type } = req.body;

        const group = await Group.create({
            name,
            avatar: avatar || null,
            type,
            createdBy: req.user._id,
            members: [{ user: req.user._id, role: 'admin' }],
            inviteCode: generateInviteCode()
        });

        const populated = await Group.findById(group._id)
            .populate('members.user', 'fullName avatar email')
            .populate('createdBy', 'fullName avatar email');

        res.status(201).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all groups for current user (sorted by lastActivityAt desc)
// @route   GET /api/v1/groups
// @access  Private
const getGroups = async (req, res, next) => {
    try {
        const groups = await Group.find({ 'members.user': req.user._id })
            .sort({ lastActivityAt: -1 })
            .populate('members.user', 'fullName avatar email')
            .populate('createdBy', 'fullName avatar email');

        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single group
// @route   GET /api/v1/groups/:id
// @access  Private
const getGroup = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('members.user', 'fullName avatar email')
            .populate('createdBy', 'fullName avatar email');

        if (!group) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Group not found' }
            });
        }

        const isMember = group.members.some(
            (m) => m.user._id.toString() === req.user._id.toString()
        );
        if (!isMember) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            });
        }

        res.status(200).json({ success: true, data: group });
    } catch (error) {
        next(error);
    }
};

// @desc    Update group (admin only)
// @route   PUT /api/v1/groups/:id
// @access  Private
const updateGroup = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Group not found' }
            });
        }

        const isAdmin = group.members.some(
            (m) => m.user.toString() === req.user._id.toString() && m.role === 'admin'
        );
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Only admins can update the group' }
            });
        }

        const { name, avatar, type } = req.body;
        if (name !== undefined) group.name = name;
        if (avatar !== undefined) group.avatar = avatar;
        if (type !== undefined) group.type = type;

        await group.save();

        const populated = await Group.findById(group._id)
            .populate('members.user', 'fullName avatar email')
            .populate('createdBy', 'fullName avatar email');

        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Add member to group
// @route   POST /api/v1/groups/:id/members
// @access  Private
const addMember = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);

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

        const { userId } = req.body;
        const alreadyMember = group.members.some(
            (m) => m.user.toString() === userId
        );
        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                error: { code: 'ALREADY_MEMBER', message: 'User is already a member' }
            });
        }

        group.members.push({ user: userId, role: 'member' });
        group.lastActivityAt = new Date();
        await group.save();

        await Notification.create({
            userId,
            type: 'added_to_group',
            title: 'Added to Group',
            body: `${req.user.fullName} added you to "${group.name}"`,
            data: { groupId: group._id, fromUserId: req.user._id }
        });

        const populated = await Group.findById(group._id)
            .populate('members.user', 'fullName avatar email')
            .populate('createdBy', 'fullName avatar email');

        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

// @desc    Leave group
// @route   DELETE /api/v1/groups/:id/leave
// @access  Private
const leaveGroup = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Group not found' }
            });
        }

        group.members = group.members.filter(
            (m) => m.user.toString() !== req.user._id.toString()
        );
        await group.save();

        res.status(200).json({ success: true, message: 'Left group successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete group (only creator can delete)
// @route   DELETE /api/v1/groups/:id
// @access  Private
const deleteGroup = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Group not found' }
            });
        }

        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Only the group creator can delete this group'
                }
            });
        }

        await group.deleteOne();

        res.status(200).json({ success: true, message: 'Group deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get invite link for group
// @route   GET /api/v1/groups/:id/invite
// @access  Private
const getInviteLink = async (req, res, next) => {
    try {
        const group = await Group.findById(req.params.id);

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

        if (!group.inviteCode) {
            group.inviteCode = generateInviteCode();
            await group.save();
        }

        res.status(200).json({
            success: true,
            data: { inviteCode: group.inviteCode, inviteLink: `fundflock://join/${group.inviteCode}` }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Join group via invite code
// @route   POST /api/v1/groups/join
// @access  Private
const joinViaInvite = async (req, res, next) => {
    try {
        const { inviteCode } = req.body;
        const group = await Group.findOne({ inviteCode });

        if (!group) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Invalid invite code' }
            });
        }

        const alreadyMember = group.members.some(
            (m) => m.user.toString() === req.user._id.toString()
        );
        if (alreadyMember) {
            return res.status(400).json({
                success: false,
                error: { code: 'ALREADY_MEMBER', message: 'You are already a member' }
            });
        }

        group.members.push({ user: req.user._id, role: 'member' });
        group.lastActivityAt = new Date();
        await group.save();

        const populated = await Group.findById(group._id)
            .populate('members.user', 'fullName avatar email')
            .populate('createdBy', 'fullName avatar email');

        res.status(200).json({ success: true, data: populated });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createGroup,
    getGroups,
    getGroup,
    updateGroup,
    addMember,
    leaveGroup,
    deleteGroup,
    getInviteLink,
    joinViaInvite
};

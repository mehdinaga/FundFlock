// models/Group.js
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Group name is required'],
        trim: true,
        maxlength: [100, 'Group name cannot exceed 100 characters']
    },
    avatar: {
        type: String,
        default: null
    },
    type: {
        type: String,
        enum: ['trip', 'home', 'couple', 'friends', 'work', 'other'],
        required: [true, 'Group type is required']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [memberSchema],
    inviteCode: {
        type: String,
        unique: true,
        sparse: true
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

groupSchema.index({ 'members.user': 1, lastActivityAt: -1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Group', groupSchema);

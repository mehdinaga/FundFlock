// models/Friendship.js
const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Requester is required']
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Recipient is required']
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'blocked'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Compound unique index to prevent duplicate friendships
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Indexes for efficient queries
friendshipSchema.index({ status: 1 });
friendshipSchema.index({ requester: 1, status: 1 });
friendshipSchema.index({ recipient: 1, status: 1 });

// Remove __v from JSON output
friendshipSchema.methods.toJSON = function () {
    const friendship = this.toObject();
    delete friendship.__v;
    return friendship;
};

module.exports = mongoose.model('Friendship', friendshipSchema);

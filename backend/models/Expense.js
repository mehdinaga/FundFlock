// models/Expense.js
const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100, default: null },
    isPaid: { type: Boolean, default: false }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Expense title is required'],
        trim: true,
        maxlength: [150, 'Title cannot exceed 150 characters']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0']
    },
    // Top-level category. New values align with the 7-category UI taxonomy.
    // Legacy values (food, transport, shopping, health, travel, education, other)
    // are retained so historical expenses still load cleanly — the client maps
    // them to their modern equivalents at display time.
    category: {
        type: String,
        enum: [
            // New taxonomy
            'entertainment', 'food_drink', 'home', 'life',
            'transportation', 'utilities', 'general',
            // Legacy (read-only, not selectable from the UI anymore)
            'food', 'transport', 'shopping', 'health', 'travel', 'education', 'other',
        ],
        default: null,
    },
    // Optional finer-grained bucket inside the chosen category
    // (e.g. category = 'food_drink', subcategory = 'coffee').
    subcategory: {
        type: String,
        trim: true,
        maxlength: 40,
        default: null,
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    splitType: {
        type: String,
        enum: ['equal', 'percentage', 'i_owe_full', 'they_owe_full'],
        required: true
    },
    splits: [splitSchema],
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters'],
        default: null
    },
    isSettled: {
        type: Boolean,
        default: false
    },
    expenseDate: {
        type: Date,
        default: null
    }
}, { timestamps: true });

expenseSchema.index({ paidBy: 1, createdAt: -1 });
expenseSchema.index({ members: 1 });
expenseSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);

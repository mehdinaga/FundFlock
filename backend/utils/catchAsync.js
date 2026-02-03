// middlewares/validator.js
const { validationResult } = require('express-validator');

// Middleware to check validation results
exports.validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: errors.array().map(err => ({
                    field: err.param,
                    message: err.msg
                }))
            }
        });
    }

    next();
};
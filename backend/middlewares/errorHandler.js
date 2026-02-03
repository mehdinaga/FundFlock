// middlewares/errorHandler.js

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging
    console.error('Error:', err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = {
            statusCode: 404,
            message,
            code: 'NOT_FOUND'
        };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} already exists`;
        error = {
            statusCode: 409,
            message,
            code: 'CONFLICT'
        };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = {
            statusCode: 400,
            message,
            code: 'VALIDATION_ERROR',
            details: Object.values(err.errors).map(val => ({
                field: val.path,
                message: val.message
            }))
        };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = {
            statusCode: 401,
            message: 'Invalid token',
            code: 'UNAUTHORIZED'
        };
    }

    if (err.name === 'TokenExpiredError') {
        error = {
            statusCode: 401,
            message: 'Token expired',
            code: 'UNAUTHORIZED'
        };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: {
            code: error.code || 'INTERNAL_SERVER_ERROR',
            message: error.message || 'Server Error',
            ...(error.details && { details: error.details })
        }
    });
};

module.exports = errorHandler;
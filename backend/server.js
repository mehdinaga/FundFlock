require('dotenv').config();
const express = require('express');
const cors = require('cors'); // To check origin is allowed
const helmet = require('helmet'); // To set security header
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { initializeFirebase } = require('./config/firebase');
const errorHandler = require('./middlewares/errorHandler');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Initialize Firebase
initializeFirebase();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: '*',
    credentials: true
}));

// Stripe webhooks MUST come before express.json() because signature
// verification needs the raw request body. The router itself uses express.raw.
app.use(`/api/${process.env.API_VERSION || 'v1'}/webhooks`, require('./routes/webhooks'));

// Body parser middleware
// 10mb limit so base64-encoded avatars / group photos can be accepted
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', limiter);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API version
const API_VERSION = process.env.API_VERSION || 'v1';

// API Routes
app.use(`/api/${API_VERSION}/auth`, require('./routes/auth'));
app.use(`/api/${API_VERSION}/users`, require('./routes/users'));
app.use(`/api/${API_VERSION}/groups`, require('./routes/groups'));
app.use(`/api/${API_VERSION}/expenses`, require('./routes/expenses'));
app.use(`/api/${API_VERSION}/payments`, require('./routes/payments'));
app.use(`/api/${API_VERSION}/connect`, require('./routes/connect'));
app.use(`/api/${API_VERSION}/friends`, require('./routes/friends'));
app.use(`/api/${API_VERSION}/notifications`, require('./routes/notifications'));
// app.use(`/api/${API_VERSION}/dashboard`, require('./routes/dashboard'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Route not found'
        }
    });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('   ═══════════════════════════════════════════════════');
    console.log(`   FundFlock API Server`);
    console.log('   ═══════════════════════════════════════════════════');
    console.log(`   Environment: ${process.env.NODE_ENV}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   API Base: http://localhost:${PORT}/api/${API_VERSION}`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log('   ═══════════════════════════════════════════════════');
    console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    server.close(() => process.exit(1));
});
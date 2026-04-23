// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const { getBucket } = require('../config/firebase');

// Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
const register = async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'EMAIL_EXISTS',
                    message: 'An account with this email already exists'
                }
            });
        }

        // Create user
        const user = await User.create({
            fullName,
            email: email.toLowerCase(),
            password
        });

        // Generate token
        const token = generateToken(user._id);

        // Return response (exclude password)
        const userResponse = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt
        };

        res.status(201).json({
            success: true,
            data: {
                user: userResponse,
                token
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user and include password for comparison
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid email or password'
                }
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid email or password'
                }
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        // Return response (exclude password)
        const userResponse = {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt
        };

        res.status(200).json({
            success: true,
            data: {
                user: userResponse,
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        next(error);
    }
};

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'No account found with this email'
                }
            });
        }

        // Generate 6-digit reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Hash code and set to user
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetCode)
            .digest('hex');

        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send email with reset code
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #F97316; margin: 0;">FundFlock</h1>
                </div>
                <h2 style="color: #333;">Password Reset Request</h2>
                <p style="color: #666; font-size: 16px;">
                    You requested to reset your password. Use the code below to reset it:
                </p>
                <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px;">${resetCode}</span>
                </div>
                <p style="color: #666; font-size: 14px;">
                    This code will expire in <strong>10 minutes</strong>.
                </p>
                <p style="color: #666; font-size: 14px;">
                    If you didn't request this, please ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                    FundFlock - Split expenses with friends
                </p>
            </div>
        `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'FundFlock - Password Reset Code',
                message: `Your password reset code is: ${resetCode}. This code expires in 10 minutes.`,
                html
            });

            console.log('Reset code sent to:', user.email);

            res.status(200).json({
                success: true,
                message: 'Password reset code sent to your email'
            });
        } catch (emailError) {
            console.error('Email send error:', emailError);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            return res.status(500).json({
                success: false,
                error: {
                    code: 'EMAIL_ERROR',
                    message: 'Could not send reset email. Please try again.'
                }
            });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        next(error);
    }
};

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
    try {
        const { resetCode, newPassword } = req.body;

        // Validate inputs
        if (!resetCode || !newPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Reset code and new password are required'
                }
            });
        }

        // Hash the code from request
        const hashedCode = crypto
            .createHash('sha256')
            .update(resetCode.toString())
            .digest('hex');

        // Find user with valid code
        const user = await User.findOne({
            resetPasswordToken: hashedCode,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CODE',
                    message: 'Invalid or expired reset code'
                }
            });
        }

        // Set new password
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Generate new auth token
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            data: {
                token
            },
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        next(error);
    }
};

// @desc    Change password
// @route   PUT /api/v1/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate inputs
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Current password and new password are required'
                }
            });
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: 'Current password is incorrect'
                }
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        next(error);
    }
};

// @desc    Delete account
// @route   DELETE /api/v1/auth/delete-account
// @access  Private
const deleteAccount = async (req, res, next) => {
    try {
        const { password } = req.body;

        // Validate password is provided
        if (!password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Password is required to delete account'
                }
            });
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: 'Password is incorrect'
                }
            });
        }

        // Delete user
        await User.findByIdAndDelete(req.user.id);

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        next(error);
    }
};

// @desc    Update profile
// @route   PUT /api/v1/auth/update-profile
// @access  Private
const updateProfile = async (req, res, next) => {
    try {
        const { fullName, email, avatar } = req.body;

        // Find user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Check if email is being changed and if it's already taken
        if (email && email.toLowerCase() !== user.email) {
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'EMAIL_EXISTS',
                        message: 'This email is already in use'
                    }
                });
            }
            user.email = email.toLowerCase();
        }

        // Update fields if provided
        if (fullName) user.fullName = fullName;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt
            },
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Update profile error:', error);
        next(error);
    }
};

// @desc    Get current user
// @route   GET /api/v1/auth/me
// @access  Private
const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        next(error);
    }
};

// @desc    Upload avatar to Firebase Storage
// @route   POST /api/v1/auth/upload-avatar
// @access  Private
const uploadAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_FILE', message: 'No image file provided' }
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        const bucket = getBucket();
        const ext = (req.file.mimetype.split('/')[1] || 'jpg').toLowerCase();
        const filename = `avatars/${user._id}-${Date.now()}.${ext}`;
        const token = crypto.randomUUID();

        const file = bucket.file(filename);
        await file.save(req.file.buffer, {
            metadata: {
                contentType: req.file.mimetype,
                metadata: { firebaseStorageDownloadTokens: token }
            },
            resumable: false
        });

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;

        user.avatar = publicUrl;
        await user.save();

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt
            },
            message: 'Avatar uploaded successfully'
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        next(error);
    }
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
    changePassword,
    deleteAccount,
    updateProfile,
    uploadAvatar,
    getMe
};

const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        enum: ['admin', 'seller', 'customer'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 900 // Token expires after 15 minutes (900 seconds)
    }
});

module.exports = mongoose.model('PasswordReset', passwordResetSchema); 
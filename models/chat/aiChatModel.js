const mongoose = require('mongoose');

const aiChatSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'customers',
        required: true
    },
    messages: [
        {
            role: {
                type: String,
                enum: ['user', 'assistant'],
                required: true
            },
            content: {
                type: String,
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }
    ],
    sessionId: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('aiChat', aiChatSchema); 
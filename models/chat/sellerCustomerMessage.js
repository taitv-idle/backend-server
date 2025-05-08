const mongoose = require('mongoose')

const sellerCustomerMessageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    receverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    file: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('sellerCustomerMessage', sellerCustomerMessageSchema)
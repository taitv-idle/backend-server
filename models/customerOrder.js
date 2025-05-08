const { Schema, model } = require('mongoose')

const customerOrder = new Schema({
    customerId : {
        type : Schema.ObjectId,
        required : true
    },
    products : {
        type : Array,
        required : true
    },
    price : {
        type : Number,
        required : true
    },
    payment_status : {
        type : String,
        required : true
    },
    shippingAddress : {
        name: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        province: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        area: {
            type: String,
            required: true
        },
        post: {
            type: String,
            default: ''
        }
    },
    delivery_status : {
        type : String,
        required : true
    },
    date : {
        type : String,
        required : true
    },
},{timestamps : true})

module.exports = model('customerOrders',customerOrder)
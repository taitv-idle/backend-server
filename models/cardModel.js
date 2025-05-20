const {Schema, model} = require("mongoose");

const cardSchema = new Schema({
    userId: {
        type: Schema.ObjectId,
        required : true
    },
    productId: {
        type: Schema.ObjectId,
        required : true
    },
    quantity: {
        type: Number,
        required : true, 
    },
    color: {
        type: String,
        required: true
    },
    size: {
        type: String,
        required: true
    }
},{ timestamps: true })

// Thêm index để cải thiện hiệu suất truy vấn
cardSchema.index({ userId: 1 });
cardSchema.index({ productId: 1 });
// Cập nhật index để bao gồm color và size
cardSchema.index({ userId: 1, productId: 1, color: 1, size: 1 }, { unique: true });

module.exports = model('cardProducts',cardSchema)
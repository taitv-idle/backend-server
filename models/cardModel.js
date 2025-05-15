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
    } 
},{ timestamps: true })

// Thêm index để cải thiện hiệu suất truy vấn
cardSchema.index({ userId: 1 });
cardSchema.index({ productId: 1 });
cardSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = model('cardProducts',cardSchema)
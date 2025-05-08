const mongoose = require('mongoose');

const shippingFeeSchema = new mongoose.Schema({
    provinceCode: {
        type: String,
        required: true,
        trim: true
    },
    districtCode: {
        type: String,
        required: true,
        trim: true
    },
    wardCode: {
        type: String,
        required: true,
        trim: true
    },
    fee: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

// Index để tối ưu truy vấn
shippingFeeSchema.index({ provinceCode: 1, districtCode: 1, wardCode: 1 }, { unique: true });

const ShippingFee = mongoose.model('ShippingFee', shippingFeeSchema);

module.exports = ShippingFee; 
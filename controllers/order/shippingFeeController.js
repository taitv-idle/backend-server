const ShippingFee = require('../../models/ShippingFee');
const axios = require('axios');

// Tính phí vận chuyển
exports.calculateShippingFee = async (req, res) => {
    try {
        const { price } = req.body; // Lấy giá trị đơn hàng từ trường price

        // Validate dữ liệu đầu vào
        if (!price) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp giá trị đơn hàng'
            });
        }

        // Tính phí vận chuyển
        // Nếu đơn hàng trên 500k thì miễn phí vận chuyển
        // Nếu không thì phí vận chuyển là 40k
        const fee = price >= 500000 ? 0 : 40000;

        res.status(200).json({
            success: true,
            data: {
                fee,
                price,
                isFree: fee === 0
            }
        });
    } catch (error) {
        console.error('Error in calculateShippingFee:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tính phí vận chuyển'
        });
    }
}; 
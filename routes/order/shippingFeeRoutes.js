const shippingFeeController = require('../../controllers/order/shippingFeeController');
const router = require('express').Router();

// Tính phí vận chuyển
router.post('/calculate-shipping', shippingFeeController.calculateShippingFee);

module.exports = router; 
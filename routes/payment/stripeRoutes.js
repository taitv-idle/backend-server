const stripeController = require('../../controllers/payment/stripeController');
const { customerAuthMiddleware } = require('../../middlewares/authMiddleware');
const router = require('express').Router();

// Tạo payment intent
router.post('/payment/create-payment-intent', customerAuthMiddleware, stripeController.create_payment_intent);

// Xác nhận thanh toán
router.patch('/payment/confirm-payment/:orderId', customerAuthMiddleware, stripeController.confirm_payment);

module.exports = router; 
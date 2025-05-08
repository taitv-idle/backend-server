const stripeController = require('../../controllers/payment/stripeController');
const { authMiddleware } = require('../../middlewares/authMiddleware');
const router = require('express').Router();

// Tạo payment intent
router.post('/create-payment-intent', authMiddleware, stripeController.create_payment_intent);

// Xác nhận thanh toán
router.patch('/confirm-payment/:orderId', authMiddleware, stripeController.confirm_payment);

// Webhook endpoint (không cần auth middleware vì Stripe sẽ gọi trực tiếp)
router.post('/webhook', stripeController.handle_webhook);

module.exports = router; 
const router = require('express').Router();
const AIChatController = require('../controllers/chat/AIChatController');
const PublicAIChatController = require('../controllers/chat/PublicAIChatController');
const { customerAuthMiddleware } = require('../middlewares/authMiddleware');

// Routes cần xác thực
router.get('/chat/ai/init', customerAuthMiddleware, AIChatController.initChat);
router.post('/chat/ai/send', customerAuthMiddleware, AIChatController.sendMessage);
router.get('/chat/ai/history/:sessionId', customerAuthMiddleware, AIChatController.getChatHistory);
router.delete('/chat/ai/end/:sessionId', customerAuthMiddleware, AIChatController.endChat);

// Routes công khai (không cần xác thực)
router.get('/chat/ai/public/init', PublicAIChatController.initPublicChat);
router.post('/chat/ai/public/send', PublicAIChatController.sendPublicMessage);

module.exports = router; 
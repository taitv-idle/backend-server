const router = require('express').Router();
const AIChatController = require('../controllers/chat/AIChatController');
const PublicAIChatController = require('../controllers/chat/PublicAIChatController');
const FreeChatController = require('../controllers/chat/FreeChatController');
const GeminiChatController = require('../controllers/chat/GeminiChatController');
const { customerAuthMiddleware, adminAuthMiddleware } = require('../middlewares/authMiddleware');

// Routes cần xác thực
router.get('/chat/ai/init', customerAuthMiddleware, AIChatController.initChat);
router.post('/chat/ai/send', customerAuthMiddleware, AIChatController.sendMessage);
router.get('/chat/ai/history/:sessionId', customerAuthMiddleware, AIChatController.getChatHistory);
router.delete('/chat/ai/:sessionId', customerAuthMiddleware, AIChatController.deleteChat);

// Routes công khai nhưng có giới hạn
router.get('/public/chat/init', PublicAIChatController.initPublicChat);
router.post('/public/chat/send', PublicAIChatController.sendPublicMessage);
router.get('/public/chat/history/:sessionId', PublicAIChatController.getChatHistory);
router.delete('/public/chat/:sessionId', PublicAIChatController.deleteChat);

// Routes cho FreeChat (không cần xác thực)
router.get('/chat/free/init', FreeChatController.initChat);
router.post('/chat/free/send', FreeChatController.sendMessage);
router.get('/chat/free/history/:sessionId', FreeChatController.getChatHistory);
router.delete('/chat/free/:sessionId', FreeChatController.deleteChat);

// Routes quản lý từ khóa FreeChat (cần quyền admin)
router.get('/chat/free/keywords', adminAuthMiddleware, FreeChatController.getAllKeywords);
router.post('/chat/free/keywords', adminAuthMiddleware, FreeChatController.addKeyword);
router.delete('/chat/free/keywords/:keyword', adminAuthMiddleware, FreeChatController.removeKeyword);

// Routes cho Gemini Chat (không cần xác thực)
router.get('/chat/gemini/init', GeminiChatController.initChat);
router.post('/chat/gemini/send', GeminiChatController.sendMessage);
router.get('/chat/gemini/history/:sessionId', GeminiChatController.getChatHistory);
router.delete('/chat/gemini/:sessionId', GeminiChatController.deleteChat);

module.exports = router; 
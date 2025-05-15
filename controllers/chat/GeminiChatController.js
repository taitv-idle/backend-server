/**
 * GeminiChatController.js
 * Controller xử lý tương tác với chatbot Gemini
 */

const { v4: uuidv4 } = require('uuid');
const { responseReturn } = require('../../utils/response');
const geminiAI = require('../../utils/geminiAI');

// Lưu trữ tạm thời cho các phiên chat trong bộ nhớ
const chatSessions = new Map();

// Tin nhắn chào mừng từ chatbot
const WELCOME_MESSAGE = 'Xin chào! Tôi là trợ lý thời trang ảo của cửa hàng. Tôi có thể giúp gì cho bạn về thời trang?';

// Tin nhắn hệ thống mô tả vai trò và nhiệm vụ của chatbot
const SYSTEM_INSTRUCTIONS = 'Bạn là trợ lý thời trang ảo của một cửa hàng thời trang trực tuyến. Bạn cần trả lời các câu hỏi về thời trang, sản phẩm, xu hướng, cách phối đồ, và các thông tin liên quan. Hãy trả lời ngắn gọn, chuyên nghiệp và thân thiện bằng tiếng Việt.';

class GeminiChatController {
    // Khởi tạo một phiên chat mới
    initChat = async (req, res) => {
        try {
            // Tạo ID phiên mới
            const sessionId = uuidv4();
            
            // Tạo phiên chat mới với cấu trúc phù hợp với Gemini
            // Bắt đầu bằng tin nhắn user để đảm bảo format đúng
            const newChat = {
                sessionId,
                messages: [
                    {
                        role: 'user',
                        content: 'Chào bạn, tôi muốn tư vấn về thời trang',
                        timestamp: new Date()
                    },
                    {
                        role: 'assistant',
                        content: WELCOME_MESSAGE,
                        timestamp: new Date(),
                        model: 'gemini-assistant'
                    }
                ],
                systemInstructions: SYSTEM_INSTRUCTIONS,
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            // Lưu phiên vào bộ nhớ
            chatSessions.set(sessionId, newChat);
            
            // Đặt thời gian hết hạn sau 24 giờ
            setTimeout(() => {
                if (chatSessions.has(sessionId)) {
                    chatSessions.delete(sessionId);
                }
            }, 1000 * 60 * 60 * 24);
            
            return responseReturn(res, 200, {
                success: true,
                chat: newChat
            });
        } catch (error) {
            console.error('Lỗi khởi tạo chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Phương thức tạo lại phiên chat
    recreateSession = async (res) => {
        try {
            // Tạo ID phiên mới
            const sessionId = uuidv4();
            
            // Tạo phiên chat mới với cấu trúc phù hợp với Gemini
            const newChat = {
                sessionId,
                messages: [
                    {
                        role: 'user',
                        content: 'Chào bạn, tôi muốn tư vấn về thời trang',
                        timestamp: new Date()
                    },
                    {
                        role: 'assistant',
                        content: WELCOME_MESSAGE,
                        timestamp: new Date(),
                        model: 'gemini-assistant'
                    }
                ],
                systemInstructions: SYSTEM_INSTRUCTIONS,
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            // Lưu phiên vào bộ nhớ
            chatSessions.set(sessionId, newChat);
            
            // Đặt thời gian hết hạn sau 24 giờ
            setTimeout(() => {
                if (chatSessions.has(sessionId)) {
                    chatSessions.delete(sessionId);
                }
            }, 1000 * 60 * 60 * 24);
            
            return {
                success: true,
                chat: newChat,
                sessionId
            };
        } catch (error) {
            console.error('Lỗi tạo lại phiên chat:', error.message);
            return {
                success: false,
                error: 'Lỗi tạo lại phiên chat'
            };
        }
    };
    
    // Gửi tin nhắn đến chatbot và nhận phản hồi
    sendMessage = async (req, res) => {
        try {
            const { message, sessionId } = req.body;
            
            // Kiểm tra tính hợp lệ
            if (!message || !sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu thông tin tin nhắn hoặc ID phiên' });
            }
            
            // Kiểm tra xem phiên có tồn tại không
            if (!chatSessions.has(sessionId)) {
                // Tự động tạo lại phiên chat
                const newSession = await this.recreateSession(res);
                
                if (!newSession.success) {
                    return responseReturn(res, 500, { error: 'Không thể tạo lại phiên chat' });
                }
                
                // Thêm tin nhắn người dùng vào phiên mới
                const chat = newSession.chat;
                chat.messages.push({
                    role: 'user',
                    content: message,
                    timestamp: new Date()
                });
                
                try {
                    // Chuẩn bị lịch sử hội thoại cho Gemini
                    const chatHistory = [...chat.messages];
                    
                    // Thêm hướng dẫn hệ thống vào nội dung tin nhắn đầu tiên của user
                    if (chatHistory.length > 0 && chatHistory[0].role === 'user') {
                        chatHistory[0].content = `${chatHistory[0].content} [Hướng dẫn hệ thống cho bot: ${chat.systemInstructions}]`;
                    }
                    
                    // Lấy phản hồi từ Gemini AI
                    const aiResponse = await geminiAI.getContextAwareResponse(chatHistory, message);
                    
                    // Thêm phản hồi AI vào lịch sử chat
                    chat.messages.push({
                        role: 'assistant',
                        content: aiResponse,
                        timestamp: new Date(),
                        model: 'gemini-assistant'
                    });
                    
                    // Cập nhật phiên
                    chat.lastUpdated = new Date();
                    chatSessions.set(newSession.sessionId, chat);
                    
                    return responseReturn(res, 200, {
                        success: true,
                        message: aiResponse,
                        model: 'gemini-assistant',
                        sessionId: newSession.sessionId,
                        isNewSession: true
                    });
                } catch (apiError) {
                    console.error('Lỗi xử lý tin nhắn:', apiError.message);
                    
                    // Phản hồi dự phòng
                    const fallbackResponse = 'Xin lỗi, hiện tại tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
                    
                    // Thêm phản hồi dự phòng vào lịch sử chat
                    chat.messages.push({
                        role: 'assistant',
                        content: fallbackResponse,
                        timestamp: new Date(),
                        model: 'fallback'
                    });
                    
                    // Cập nhật phiên
                    chat.lastUpdated = new Date();
                    chatSessions.set(newSession.sessionId, chat);
                    
                    return responseReturn(res, 200, {
                        success: true,
                        message: fallbackResponse,
                        isFallback: true,
                        sessionId: newSession.sessionId,
                        isNewSession: true
                    });
                }
            }
            
            const chat = chatSessions.get(sessionId);
            
            // Thêm tin nhắn người dùng vào lịch sử
            chat.messages.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
            try {
                // Chuẩn bị lịch sử hội thoại cho Gemini
                const chatHistory = [...chat.messages];
                
                // Thêm hướng dẫn hệ thống vào nội dung tin nhắn đầu tiên của user
                if (chatHistory.length > 0 && chatHistory[0].role === 'user') {
                    // Thêm hướng dẫn hệ thống vào nội dung tin nhắn của bot
                    chatHistory[0].content = `${chatHistory[0].content} [Hướng dẫn hệ thống cho bot: ${chat.systemInstructions}]`;
                }
                
                // Lấy phản hồi từ Gemini AI
                const aiResponse = await geminiAI.getContextAwareResponse(chatHistory, message);
                
                // Thêm phản hồi AI vào lịch sử chat
                chat.messages.push({
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: new Date(),
                    model: 'gemini-assistant'
                });
                
                // Cập nhật phiên
                chat.lastUpdated = new Date();
                chatSessions.set(sessionId, chat);
                
                return responseReturn(res, 200, {
                    success: true,
                    message: aiResponse,
                    model: 'gemini-assistant'
                });
            } catch (apiError) {
                console.error('Lỗi xử lý tin nhắn:', apiError.message);
                
                // Phản hồi dự phòng
                const fallbackResponse = 'Xin lỗi, hiện tại tôi không thể xử lý yêu cầu của bạn. Vui lòng thử lại sau.';
                
                // Thêm phản hồi dự phòng vào lịch sử chat
                chat.messages.push({
                    role: 'assistant',
                    content: fallbackResponse,
                    timestamp: new Date(),
                    model: 'fallback'
                });
                
                // Cập nhật phiên
                chat.lastUpdated = new Date();
                chatSessions.set(sessionId, chat);
                
                return responseReturn(res, 200, {
                    success: true,
                    message: fallbackResponse,
                    isFallback: true
                });
            }
        } catch (error) {
            console.error('Lỗi xử lý tin nhắn:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Lấy lịch sử chat cho một phiên
    getChatHistory = async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            if (!chatSessions.has(sessionId)) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat' });
            }
            
            const chat = chatSessions.get(sessionId);
            
            return responseReturn(res, 200, {
                success: true,
                chat
            });
        } catch (error) {
            console.error('Lỗi lấy lịch sử chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Xóa một phiên chat
    deleteChat = async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            // Kiểm tra xem phiên có tồn tại không
            if (chatSessions.has(sessionId)) {
                chatSessions.delete(sessionId);
                
                return responseReturn(res, 200, {
                    success: true,
                    message: 'Đã xóa phiên chat thành công'
                });
            } else {
                // Thay vì trả về lỗi 404, trả về thành công vì mục đích cuối cùng là xóa phiên
                return responseReturn(res, 200, {
                    success: true,
                    message: 'Phiên chat đã được xóa hoặc không tồn tại'
                });
            }
        } catch (error) {
            console.error('Lỗi xóa phiên chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
}

module.exports = new GeminiChatController(); 
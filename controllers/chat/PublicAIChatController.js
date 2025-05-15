const { v4: uuidv4 } = require('uuid');
const { responseReturn } = require('../../utils/response');
const openai = require('../../config/openai');
const { getFallbackResponse } = require('../../config/openai');

// Bộ nhớ tạm thời cho các phiên chat ẩn danh (trong môi trường sản xuất, nên sử dụng Redis hoặc DB)
const anonymousSessions = new Map();

class PublicAIChatController {
    // Khởi tạo một phiên chat công khai mới
    initPublicChat = async (req, res) => {
        try {
            // Tạo sessionId mới
            const sessionId = uuidv4();
            
            // Tạo phiên chat mới với tin nhắn chào đầu tiên
            const newChat = {
                sessionId,
                messages: [{
                    role: 'assistant',
                    content: 'Xin chào! Tôi là trợ lý ảo của cửa hàng thời trang. Tôi có thể giúp gì cho bạn?',
                    timestamp: new Date()
                }],
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            // Lưu phiên chat vào bộ nhớ
            anonymousSessions.set(sessionId, newChat);
            
            // Thiết lập thời gian hết hạn (2 giờ)
            setTimeout(() => {
                if (anonymousSessions.has(sessionId)) {
                    anonymousSessions.delete(sessionId);
                }
            }, 1000 * 60 * 60 * 2);
            
            return responseReturn(res, 200, {
                success: true,
                chat: newChat
            });
        } catch (error) {
            console.error('Lỗi khởi tạo chat công khai:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
    
    // Phương thức tạo lại phiên chat
    recreateSession = async (res) => {
        try {
            // Tạo sessionId mới
            const sessionId = uuidv4();
            
            // Tạo phiên chat mới với tin nhắn chào đầu tiên
            const newChat = {
                sessionId,
                messages: [{
                    role: 'assistant',
                    content: 'Xin chào! Tôi là trợ lý ảo của cửa hàng thời trang. Tôi có thể giúp gì cho bạn?',
                    timestamp: new Date()
                }],
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            // Lưu phiên chat vào bộ nhớ
            anonymousSessions.set(sessionId, newChat);
            
            // Thiết lập thời gian hết hạn (2 giờ)
            setTimeout(() => {
                if (anonymousSessions.has(sessionId)) {
                    anonymousSessions.delete(sessionId);
                }
            }, 1000 * 60 * 60 * 2);
            
            return {
                success: true,
                chat: newChat,
                sessionId
            };
        } catch (error) {
            console.error('Lỗi tạo lại phiên chat công khai:', error.message);
            return {
                success: false,
                error: 'Lỗi tạo lại phiên chat'
            };
        }
    };

    // Gửi tin nhắn và nhận phản hồi từ chatbot công khai
    sendPublicMessage = async (req, res) => {
        try {
            const { message, sessionId } = req.body;
            
            if (!message || !sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu thông tin tin nhắn hoặc ID phiên' });
            }
            
            // Tìm phiên chat
            if (!anonymousSessions.has(sessionId)) {
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
                
                // Kiểm tra API key
                if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-openai-api-key')) {
                    console.error('OpenAI API key không hợp lệ hoặc chưa được cấu hình');
                    
                    // Trả về phản hồi giả lập
                    const mockResponse = 'Xin lỗi, hiện tại tôi không thể kết nối với trí tuệ nhân tạo. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.';
                    
                    chat.messages.push({
                        role: 'assistant',
                        content: mockResponse,
                        timestamp: new Date()
                    });
                    
                    // Cập nhật phiên chat trong bộ nhớ
                    chat.lastUpdated = new Date();
                    anonymousSessions.set(newSession.sessionId, chat);
                    
                    return responseReturn(res, 200, {
                        success: true,
                        message: mockResponse,
                        note: 'Sử dụng phản hồi giả lập do API key không hợp lệ',
                        sessionId: newSession.sessionId,
                        isNewSession: true
                    });
                }
                
                // Chuẩn bị tin nhắn cho OpenAI API
                const messages = [
                    {
                        role: 'system',
                        content: 'Bạn là trợ lý ảo của cửa hàng thời trang. Hãy giúp khách hàng tìm hiểu về sản phẩm, xu hướng thời trang, cách phối đồ, chính sách đổi trả, và các câu hỏi khác liên quan đến mua sắm thời trang. Trả lời một cách lịch sự, rõ ràng và ngắn gọn bằng tiếng Việt.'
                    },
                    ...chat.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }))
                ];
                
                try {
                    // Gọi OpenAI API để lấy phản hồi
                    const completion = await openai.chat.completions.create({
                        model: 'gpt-3.5-turbo',
                        messages: messages,
                        max_tokens: 500
                    });
                    
                    // Lấy phản hồi từ AI
                    const aiResponse = completion.choices[0].message.content;
                    
                    // Thêm phản hồi vào phiên chat
                    chat.messages.push({
                        role: 'assistant',
                        content: aiResponse,
                        timestamp: new Date()
                    });
                    
                    // Cập nhật thời gian cập nhật cuối cùng
                    chat.lastUpdated = new Date();
                    
                    // Lưu phiên chat vào bộ nhớ
                    anonymousSessions.set(newSession.sessionId, chat);
                    
                    return responseReturn(res, 200, {
                        success: true,
                        message: aiResponse,
                        sessionId: newSession.sessionId,
                        isNewSession: true
                    });
                } catch (openaiError) {
                    console.error('Lỗi OpenAI API:', openaiError.message, openaiError);
                    
                    // Trả về phản hồi giả lập trong trường hợp lỗi
                    const errorResponse = getFallbackResponse();
                    
                    // Thêm phản hồi vào phiên chat
                    chat.messages.push({
                        role: 'assistant',
                        content: errorResponse,
                        timestamp: new Date()
                    });
                    
                    // Cập nhật thời gian cập nhật cuối cùng
                    chat.lastUpdated = new Date();
                    anonymousSessions.set(newSession.sessionId, chat);
                    
                    return responseReturn(res, 200, { 
                        success: true,
                        message: errorResponse,
                        isQuotaExceeded: openaiError.message.includes('quota'),
                        isFallback: true,
                        sessionId: newSession.sessionId,
                        isNewSession: true
                    });
                }
            }
            
            const chat = anonymousSessions.get(sessionId);
            
            // Thêm tin nhắn của người dùng vào phiên chat
            chat.messages.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
            // Kiểm tra API key
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-openai-api-key')) {
                console.error('OpenAI API key không hợp lệ hoặc chưa được cấu hình');
                
                // Trả về phản hồi giả lập
                const mockResponse = 'Xin lỗi, hiện tại tôi không thể kết nối với trí tuệ nhân tạo. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.';
                
                chat.messages.push({
                    role: 'assistant',
                    content: mockResponse,
                    timestamp: new Date()
                });
                
                // Cập nhật phiên chat trong bộ nhớ
                chat.lastUpdated = new Date();
                anonymousSessions.set(sessionId, chat);
                
                return responseReturn(res, 200, {
                    success: true,
                    message: mockResponse,
                    note: 'Sử dụng phản hồi giả lập do API key không hợp lệ'
                });
            }
            
            // Chuẩn bị tin nhắn cho OpenAI API
            const messages = [
                {
                    role: 'system',
                    content: 'Bạn là trợ lý ảo của cửa hàng thời trang. Hãy giúp khách hàng tìm hiểu về sản phẩm, xu hướng thời trang, cách phối đồ, chính sách đổi trả, và các câu hỏi khác liên quan đến mua sắm thời trang. Trả lời một cách lịch sự, rõ ràng và ngắn gọn bằng tiếng Việt.'
                },
                ...chat.messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            ];
            
            try {
                // Gọi OpenAI API để lấy phản hồi
                const completion = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: messages,
                    max_tokens: 500
                });
                
                // Lấy phản hồi từ AI
                const aiResponse = completion.choices[0].message.content;
                
                // Thêm phản hồi vào phiên chat
                chat.messages.push({
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: new Date()
                });
                
                // Cập nhật thời gian cập nhật cuối cùng
                chat.lastUpdated = new Date();
                
                // Lưu phiên chat vào bộ nhớ
                anonymousSessions.set(sessionId, chat);
                
                return responseReturn(res, 200, {
                    success: true,
                    message: aiResponse
                });
            } catch (openaiError) {
                console.error('Lỗi OpenAI API:', openaiError.message, openaiError);
                
                // Trả về phản hồi giả lập trong trường hợp lỗi
                const errorResponse = getFallbackResponse();
                
                // Thêm phản hồi vào phiên chat
                chat.messages.push({
                    role: 'assistant',
                    content: errorResponse,
                    timestamp: new Date()
                });
                
                // Cập nhật thời gian cập nhật cuối cùng
                chat.lastUpdated = new Date();
                anonymousSessions.set(sessionId, chat);
                
                return responseReturn(res, 200, { 
                    success: true,
                    message: errorResponse,
                    isQuotaExceeded: openaiError.message.includes('quota'),
                    isFallback: true
                });
            }
        } catch (error) {
            console.error('Lỗi gửi tin nhắn công khai:', error.message, error.stack);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ', details: error.message });
        }
    }
    
    // Lấy lịch sử chat
    getChatHistory = async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            // Kiểm tra xem phiên chat có tồn tại không
            if (!anonymousSessions.has(sessionId)) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat hoặc phiên đã hết hạn' });
            }
            
            const chat = anonymousSessions.get(sessionId);
            
            return responseReturn(res, 200, {
                success: true,
                chat
            });
        } catch (error) {
            console.error('Lỗi lấy lịch sử chat công khai:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
    
    // Xóa phiên chat
    deleteChat = async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            // Kiểm tra xem phiên chat có tồn tại không
            if (!anonymousSessions.has(sessionId)) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat' });
            }
            
            // Xóa phiên chat
            anonymousSessions.delete(sessionId);
            
            return responseReturn(res, 200, {
                success: true,
                message: 'Đã xóa phiên chat thành công'
            });
        } catch (error) {
            console.error('Lỗi xóa phiên chat công khai:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
}

module.exports = new PublicAIChatController(); 
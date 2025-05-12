const { v4: uuidv4 } = require('uuid');
const { responseReturn } = require('../../utiles/response');
const openai = require('../../config/openai');

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
    
    // Gửi tin nhắn và nhận phản hồi từ chatbot công khai
    sendPublicMessage = async (req, res) => {
        try {
            const { message, sessionId } = req.body;
            
            if (!message || !sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu thông tin tin nhắn hoặc ID phiên' });
            }
            
            // Tìm phiên chat
            if (!anonymousSessions.has(sessionId)) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat hoặc phiên đã hết hạn' });
            }
            
            const chat = anonymousSessions.get(sessionId);
            
            // Thêm tin nhắn của người dùng vào phiên chat
            chat.messages.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
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
        } catch (error) {
            console.error('Lỗi gửi tin nhắn công khai:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
}

module.exports = new PublicAIChatController(); 
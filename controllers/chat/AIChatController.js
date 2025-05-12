const { v4: uuidv4 } = require('uuid');
const aiChatModel = require('../../models/chat/aiChatModel');
const { responseReturn } = require('../../utiles/response');
const openai = require('../../config/openai');

class AIChatController {
    // Khởi tạo phiên chat mới hoặc trả về phiên chat hiện có
    initChat = async (req, res) => {
        try {
            const { id } = req.user;
            
            // Kiểm tra xem khách hàng đã có phiên chat đang hoạt động không
            let existingChat = await aiChatModel.findOne({
                customerId: id,
                isActive: true
            });
            
            // Nếu không có phiên chat nào, tạo phiên mới
            if (!existingChat) {
                existingChat = await aiChatModel.create({
                    customerId: id,
                    sessionId: uuidv4(),
                    messages: [{
                        role: 'assistant',
                        content: 'Xin chào! Tôi là trợ lý ảo của cửa hàng thời trang. Tôi có thể giúp gì cho bạn?'
                    }]
                });
            }
            
            return responseReturn(res, 200, {
                success: true,
                chat: existingChat
            });
        } catch (error) {
            console.error('Lỗi khởi tạo chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
    
    // Gửi tin nhắn và nhận phản hồi từ chatbot
    sendMessage = async (req, res) => {
        try {
            const { id } = req.user;
            const { message, sessionId } = req.body;
            
            if (!message || !sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu thông tin tin nhắn hoặc ID phiên' });
            }
            
            // Tìm phiên chat
            const chat = await aiChatModel.findOne({
                customerId: id,
                sessionId,
                isActive: true
            });
            
            if (!chat) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat' });
            }
            
            // Thêm tin nhắn của người dùng vào phiên chat
            chat.messages.push({
                role: 'user',
                content: message
            });
            
            // Chuẩn bị tin nhắn cho OpenAI API
            const messages = [
                {
                    role: 'system',
                    content: 'Bạn là trợ lý ảo của cửa hàng thời trang. Hãy giúp khách hàng tìm hiểu về sản phẩm, xu hướng thời trang, cách phối đồ, chính sách đổi trả, và các câu hỏi khác liên quan đến mua sắm thời trang. Trả lời một cách lịch sự, rõ ràng và ngắn gọn.'
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
                content: aiResponse
            });
            
            // Cập nhật thời gian cập nhật cuối cùng
            chat.lastUpdated = Date.now();
            
            // Lưu phiên chat
            await chat.save();
            
            return responseReturn(res, 200, {
                success: true,
                message: aiResponse
            });
        } catch (error) {
            console.error('Lỗi gửi tin nhắn:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
    
    // Lấy lịch sử chat
    getChatHistory = async (req, res) => {
        try {
            const { id } = req.user;
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            const chat = await aiChatModel.findOne({
                customerId: id,
                sessionId
            });
            
            if (!chat) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat' });
            }
            
            return responseReturn(res, 200, {
                success: true,
                chat
            });
        } catch (error) {
            console.error('Lỗi lấy lịch sử chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
    
    // Kết thúc phiên chat
    endChat = async (req, res) => {
        try {
            const { id } = req.user;
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            const chat = await aiChatModel.findOne({
                customerId: id,
                sessionId,
                isActive: true
            });
            
            if (!chat) {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat đang hoạt động' });
            }
            
            // Đánh dấu phiên chat là không hoạt động
            chat.isActive = false;
            await chat.save();
            
            return responseReturn(res, 200, {
                success: true,
                message: 'Đã kết thúc phiên chat'
            });
        } catch (error) {
            console.error('Lỗi kết thúc chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
}

module.exports = new AIChatController(); 
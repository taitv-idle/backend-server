const { v4: uuidv4 } = require('uuid');
const aiChatModel = require('../../models/chat/aiChatModel');
const { responseReturn } = require('../../utils/response');
const openai = require('../../config/openai');
const { getFallbackResponse } = require('../../config/openai');

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
    
    // Phương thức tạo lại phiên chat
    recreateSession = async (userId) => {
        try {
            // Tạo phiên chat mới
            const newChat = await aiChatModel.create({
                customerId: userId,
                sessionId: uuidv4(),
                messages: [{
                    role: 'assistant',
                    content: 'Xin chào! Tôi là trợ lý ảo của cửa hàng thời trang. Tôi có thể giúp gì cho bạn?'
                }]
            });
            
            return {
                success: true,
                chat: newChat,
                sessionId: newChat.sessionId
            };
        } catch (error) {
            console.error('Lỗi tạo lại phiên chat:', error.message);
            return {
                success: false,
                error: 'Lỗi tạo lại phiên chat'
            };
        }
    };

    // Gửi tin nhắn và nhận phản hồi từ chatbot
    sendMessage = async (req, res) => {
        try {
            const { id } = req.user;
            const { message, sessionId } = req.body;
            
            if (!message || !sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu thông tin tin nhắn hoặc ID phiên' });
            }
            
            // Tìm phiên chat
            let chat = await aiChatModel.findOne({
                customerId: id,
                sessionId,
                isActive: true
            });
            
            if (!chat) {
                // Tự động tạo lại phiên chat
                const newSession = await this.recreateSession(id);
                
                if (!newSession.success) {
                    return responseReturn(res, 500, { error: 'Không thể tạo lại phiên chat' });
                }
                
                chat = newSession.chat;
            }
            
            // Thêm tin nhắn của người dùng vào phiên chat
            chat.messages.push({
                role: 'user',
                content: message
            });
            
            // Kiểm tra API key
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-openai-api-key')) {
                console.error('OpenAI API key không hợp lệ hoặc chưa được cấu hình');
                
                // Lưu tin nhắn của người dùng vào cơ sở dữ liệu
                await chat.save();
                
                // Trả về phản hồi giả lập
                const mockResponse = 'Xin lỗi, hiện tại tôi không thể kết nối với trí tuệ nhân tạo. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.';
                
                chat.messages.push({
                    role: 'assistant',
                    content: mockResponse
                });
                
                await chat.save();
                
                return responseReturn(res, 200, {
                    success: true,
                    message: mockResponse,
                    note: 'Sử dụng phản hồi giả lập do API key không hợp lệ',
                    sessionId: chat.sessionId,
                    isNewSession: !chat._id.equals(chat._id)
                });
            }
            
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
                    content: aiResponse
                });
                
                // Cập nhật thời gian cập nhật cuối cùng
                chat.lastUpdated = Date.now();
                
                // Lưu phiên chat
                await chat.save();
                
                return responseReturn(res, 200, {
                    success: true,
                    message: aiResponse,
                    sessionId: chat.sessionId,
                    isNewSession: !chat._id.equals(chat._id)
                });
            } catch (openaiError) {
                console.error('Lỗi OpenAI API:', openaiError.message, openaiError);
                
                // Lưu tin nhắn của người dùng vào cơ sở dữ liệu mà không có phản hồi từ AI
                await chat.save();
                
                // Trả về phản hồi giả lập trong trường hợp lỗi
                const errorResponse = getFallbackResponse();
                
                return responseReturn(res, 200, { 
                    success: true,
                    message: errorResponse,
                    isQuotaExceeded: openaiError.message.includes('quota'),
                    isFallback: true,
                    sessionId: chat.sessionId,
                    isNewSession: !chat._id.equals(chat._id)
                });
            }
        } catch (error) {
            console.error('Lỗi gửi tin nhắn:', error.message, error.stack);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ', details: error.message });
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
    
    // Xóa phiên chat
    deleteChat = async (req, res) => {
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
                message: 'Đã xóa phiên chat thành công'
            });
        } catch (error) {
            console.error('Lỗi xóa chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    }
}

module.exports = new AIChatController(); 
const { v4: uuidv4 } = require('uuid');
const { responseReturn } = require('../../utils/response');
const freeAI = require('../../utils/freeAI');

// Bộ nhớ tạm thời cho các phiên chat (trong môi trường sản xuất, nên sử dụng Redis hoặc DB)
const chatSessions = new Map();

// Kho từ khóa và câu trả lời
const keywords = {
    'chào': ['Xin chào! Tôi có thể giúp gì cho bạn?', 'Chào bạn! Bạn cần hỗ trợ gì về thời trang?'],
    'quần áo': ['Chúng tôi có nhiều loại quần áo từ casual đến formal. Bạn đang tìm kiếm phong cách nào?'],
    'giá': ['Giá sản phẩm của chúng tôi rất cạnh tranh, dao động từ 200k đến 2 triệu tùy loại sản phẩm.'],
    'sale': ['Hiện tại chúng tôi đang có chương trình giảm giá 20-50% cho toàn bộ sản phẩm mùa hè.'],
    'khuyến mãi': ['Chúng tôi có chương trình mua 2 tặng 1 cho các sản phẩm phụ kiện, và giảm 30% cho khách hàng mới.'],
    'thời gian': ['Cửa hàng mở cửa từ 8h-22h hàng ngày, kể cả ngày lễ.'],
    'địa chỉ': ['Cửa hàng chính của chúng tôi ở 123 Nguyễn Huệ, Quận 1, TP.HCM. Chúng tôi cũng có chi nhánh ở Hà Nội và Đà Nẵng.'],
    'đổi trả': ['Chính sách đổi trả trong vòng 30 ngày với sản phẩm còn nguyên tem mác.'],
    'giao hàng': ['Chúng tôi giao hàng toàn quốc, phí từ 20-40k tùy khu vực, miễn phí cho đơn từ 500k.'],
    'thanh toán': ['Chúng tôi hỗ trợ thanh toán bằng tiền mặt, thẻ, chuyển khoản và các ví điện tử phổ biến.'],
    'xu hướng': ['Xu hướng thời trang hiện nay đang thiên về phong cách minimalist, Y2K và vintage.'],
    'phối đồ': ['Để phối đồ đẹp, bạn nên chú ý đến màu sắc, chất liệu và phom dáng phù hợp với vóc dáng của mình.']
};

// Câu trả lời mặc định khi không tìm thấy từ khóa
const defaultResponses = [
    'Xin lỗi, tôi không hiểu câu hỏi của bạn. Bạn có thể hỏi về sản phẩm, giá cả, khuyến mãi, hoặc chính sách của cửa hàng.',
    'Tôi không có thông tin về vấn đề này. Bạn có thể hỏi về các sản phẩm thời trang của chúng tôi không?',
    'Câu hỏi của bạn nằm ngoài phạm vi kiến thức của tôi. Tôi có thể giúp bạn với các thông tin về thời trang và sản phẩm của cửa hàng.',
    'Tôi chưa được huấn luyện để trả lời câu hỏi này. Hãy thử hỏi về sản phẩm, giá cả, hoặc chính sách của cửa hàng.'
];

// Hàm lấy câu trả lời từ kho dữ liệu
function getResponseFromKeywords(message) {
    // Chuyển message thành chữ thường để dễ so sánh
    const lowerMessage = message.toLowerCase();
    
    // Tìm từ khóa trong tin nhắn
    for (const keyword in keywords) {
        if (lowerMessage.includes(keyword)) {
            const responses = keywords[keyword];
            // Chọn ngẫu nhiên một câu trả lời từ mảng responses
            return responses[Math.floor(Math.random() * responses.length)];
        }
    }
    
    // Trả về câu trả lời mặc định nếu không tìm thấy từ khóa
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

class FreeChatController {
    // Khởi tạo phiên chat mới
    initChat = async (req, res) => {
        try {
            // Tạo phiên mới với ID ngẫu nhiên
            const sessionId = uuidv4();
            
            // Tạo phiên chat mới với tin nhắn chào mừng
            const newChat = {
                sessionId,
                messages: [
                    {
                        role: 'assistant',
                        content: 'Xin chào! Tôi là trợ lý thời trang ảo của cửa hàng. Tôi có thể giúp gì cho bạn?',
                        timestamp: new Date()
                    }
                ],
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            // Lưu phiên chat vào bộ nhớ tạm thời
            chatSessions.set(sessionId, newChat);
            
            // Thiết lập thời gian hết hạn (24 giờ)
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
    recreateSession = async () => {
        try {
            // Tạo sessionId mới
            const sessionId = uuidv4();
            
            // Tạo phiên chat mới với tin nhắn chào đầu tiên
            const newChat = {
                sessionId,
                messages: [{
                    role: 'assistant',
                    content: 'Xin chào! Tôi là trợ lý thời trang ảo của cửa hàng. Tôi có thể giúp gì cho bạn?',
                    timestamp: new Date()
                }],
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            // Lưu phiên chat vào bộ nhớ tạm thời
            chatSessions.set(sessionId, newChat);
            
            // Thiết lập thời gian hết hạn (24 giờ)
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

    // Gửi tin nhắn và nhận phản hồi
    sendMessage = async (req, res) => {
        try {
            const { message, sessionId } = req.body;
            
            if (!message || !sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu thông tin tin nhắn hoặc ID phiên' });
            }
            
            // Kiểm tra phiên chat
            if (!chatSessions.has(sessionId)) {
                // Tự động tạo lại phiên chat
                const newSession = await this.recreateSession();
                
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
                
                // Lấy phản hồi từ AI dựa trên context
                const aiResponse = freeAI.getContextAwareResponse(chat.messages, message);
                
                // Thêm phản hồi AI vào phiên chat
                chat.messages.push({
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: new Date()
                });
                
                // Cập nhật thời gian
                chat.lastUpdated = new Date();
                
                // Lưu lại phiên chat
                chatSessions.set(newSession.sessionId, chat);
                
                return responseReturn(res, 200, {
                    success: true,
                    message: aiResponse,
                    sessionId: newSession.sessionId,
                    isNewSession: true
                });
            }
            
            const chat = chatSessions.get(sessionId);
            
            // Thêm tin nhắn người dùng vào phiên chat
            chat.messages.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
            // Lấy phản hồi từ AI dựa trên context
            const aiResponse = freeAI.getContextAwareResponse(chat.messages, message);
            
            // Thêm phản hồi AI vào phiên chat
            chat.messages.push({
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date()
            });
            
            // Cập nhật thời gian
            chat.lastUpdated = new Date();
            
            // Lưu lại phiên chat
            chatSessions.set(sessionId, chat);
            
            return responseReturn(res, 200, {
                success: true,
                message: aiResponse
            });
        } catch (error) {
            console.error('Lỗi gửi tin nhắn:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Lấy lịch sử chat
    getChatHistory = async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            // Kiểm tra phiên chat
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
    
    // Xóa phiên chat
    deleteChat = async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return responseReturn(res, 400, { error: 'Thiếu ID phiên' });
            }
            
            // Kiểm tra và xóa phiên chat
            if (chatSessions.has(sessionId)) {
                chatSessions.delete(sessionId);
                return responseReturn(res, 200, {
                    success: true,
                    message: 'Đã xóa phiên chat thành công'
                });
            } else {
                return responseReturn(res, 404, { error: 'Không tìm thấy phiên chat' });
            }
        } catch (error) {
            console.error('Lỗi xóa phiên chat:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Thêm từ khóa và câu trả lời mới (chỉ admin mới có quyền làm việc này)
    addKeyword = async (req, res) => {
        try {
            const { keyword, responses } = req.body;
            
            if (!keyword || !responses || !Array.isArray(responses) || responses.length === 0) {
                return responseReturn(res, 400, { error: 'Thiếu từ khóa hoặc câu trả lời' });
            }
            
            // Thêm từ khóa mới vào kho
            keywords[keyword.toLowerCase()] = responses;
            
            return responseReturn(res, 200, {
                success: true,
                message: 'Đã thêm từ khóa và câu trả lời mới',
                keyword: keyword.toLowerCase(),
                responses
            });
        } catch (error) {
            console.error('Lỗi thêm từ khóa:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Xóa từ khóa (chỉ admin mới có quyền làm việc này)
    removeKeyword = async (req, res) => {
        try {
            const { keyword } = req.params;
            
            if (!keyword) {
                return responseReturn(res, 400, { error: 'Thiếu từ khóa' });
            }
            
            const lowerKeyword = keyword.toLowerCase();
            
            // Kiểm tra từ khóa có tồn tại không
            if (!keywords.hasOwnProperty(lowerKeyword)) {
                return responseReturn(res, 404, { error: 'Không tìm thấy từ khóa' });
            }
            
            // Xóa từ khóa
            delete keywords[lowerKeyword];
            
            return responseReturn(res, 200, {
                success: true,
                message: 'Đã xóa từ khóa thành công'
            });
        } catch (error) {
            console.error('Lỗi xóa từ khóa:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
    
    // Lấy danh sách tất cả từ khóa (chỉ admin mới có quyền làm việc này)
    getAllKeywords = async (req, res) => {
        try {
            return responseReturn(res, 200, {
                success: true,
                keywords
            });
        } catch (error) {
            console.error('Lỗi lấy danh sách từ khóa:', error.message);
            return responseReturn(res, 500, { error: 'Lỗi máy chủ nội bộ' });
        }
    };
}

module.exports = new FreeChatController(); 
/**
 * Utility cho FreeChatController
 * File này chứa các hàm hỗ trợ xử lý chat và phản hồi đơn giản không sử dụng OpenAI
 */

// Danh sách từ khóa phổ biến để cung cấp phản hồi thông minh hơn
const COMMON_KEYWORDS = {
    'thời trang': ['xu hướng', 'phong cách', 'thời trang', 'mặc', 'quần áo', 'đẹp'],
    'sản phẩm': ['áo', 'quần', 'váy', 'túi', 'giày', 'phụ kiện', 'dép', 'mũ', 'kính', 'đồng hồ'],
    'giá cả': ['giá', 'bao nhiêu', 'rẻ', 'đắt', 'tiền', 'chi phí'],
    'thanh toán': ['thanh toán', 'trả góp', 'chuyển khoản', 'ví điện tử', 'tiền mặt', 'thẻ'],
    'giao hàng': ['giao hàng', 'vận chuyển', 'ship', 'đơn hàng', 'thời gian', 'phí giao hàng'],
    'hoàn trả': ['đổi trả', 'hoàn tiền', 'bảo hành', 'lỗi', 'hỏng', 'không vừa']
};

/**
 * Phân tích nội dung tin nhắn để phát hiện chủ đề và ý định
 * @param {string} message - Tin nhắn của người dùng
 * @returns {Object} - Thông tin về chủ đề và ý định
 */
function analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();
    const result = {
        topics: [],
        isQuestion: lowerMessage.includes('?'),
        isGreeting: /\b(xin chào|chào|hi|hello|hey|helu)\b/.test(lowerMessage),
        isThankYou: /\b(cảm ơn|thanks|thank you|cám ơn)\b/.test(lowerMessage),
        isComplaint: /\b(khiếu nại|phàn nàn|không hài lòng|tệ|kém|chậm)\b/.test(lowerMessage)
    };
    
    // Xác định chủ đề từ từ khóa
    for (const [topic, keywords] of Object.entries(COMMON_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerMessage.includes(keyword)) {
                result.topics.push(topic);
                break;
            }
        }
    }
    
    return result;
}

/**
 * Tạo phản hồi dựa trên context và tin nhắn hiện tại
 * @param {Array} messages - Lịch sử tin nhắn
 * @param {string} currentMessage - Tin nhắn hiện tại của người dùng
 * @returns {string} - Phản hồi cho người dùng
 */
function getContextAwareResponse(messages, currentMessage) {
    const analysis = analyzeMessage(currentMessage);
    
    // Xử lý chào hỏi
    if (analysis.isGreeting) {
        return "Xin chào! Tôi là trợ lý thời trang AI của cửa hàng. Tôi có thể giúp gì cho bạn?";
    }
    
    // Xử lý cảm ơn
    if (analysis.isThankYou) {
        return "Không có gì! Tôi rất vui khi được giúp đỡ bạn. Bạn còn cần hỗ trợ gì khác không?";
    }
    
    // Xử lý khiếu nại
    if (analysis.isComplaint) {
        return "Tôi rất tiếc về vấn đề bạn đang gặp phải. Để được hỗ trợ tốt nhất, vui lòng liên hệ bộ phận CSKH theo số 1900xxxx hoặc email support@fashionstore.com nhé!";
    }
    
    // Dựa vào chủ đề để đưa ra phản hồi
    if (analysis.topics.includes('thời trang')) {
        return "Xu hướng thời trang hiện nay đang thiên về phong cách tối giản, Y2K và vintage. Chúng tôi có nhiều sản phẩm phù hợp với các phong cách này. Bạn muốn tìm hiểu thêm về phong cách nào?";
    }
    
    if (analysis.topics.includes('sản phẩm')) {
        return "Cửa hàng chúng tôi có đa dạng sản phẩm từ trang phục, giày dép đến phụ kiện thời trang. Bạn đang quan tâm đến loại sản phẩm cụ thể nào?";
    }
    
    if (analysis.topics.includes('giá cả')) {
        return "Sản phẩm của chúng tôi có giá từ 200.000đ đến 2.000.000đ tùy loại. Hiện tại chúng tôi đang có chương trình giảm giá 20-50% cho nhiều sản phẩm. Bạn đang tìm sản phẩm ở tầm giá nào?";
    }
    
    if (analysis.topics.includes('thanh toán')) {
        return "Chúng tôi hỗ trợ nhiều phương thức thanh toán như tiền mặt, thẻ ngân hàng, ví điện tử (Momo, ZaloPay, VNPay) và chuyển khoản. Bạn muốn thanh toán bằng hình thức nào?";
    }
    
    if (analysis.topics.includes('giao hàng')) {
        return "Chúng tôi giao hàng toàn quốc, phí ship từ 20.000đ đến 40.000đ tùy khu vực, miễn phí giao hàng cho đơn từ 500.000đ. Thời gian giao hàng từ 1-3 ngày tùy khu vực.";
    }
    
    if (analysis.topics.includes('hoàn trả')) {
        return "Chính sách đổi trả của chúng tôi áp dụng trong vòng 30 ngày kể từ ngày mua với sản phẩm còn nguyên tem mác, chưa qua sử dụng. Riêng sản phẩm lỗi do nhà sản xuất được đổi ngay lập tức.";
    }
    
    // Phản hồi mặc định khi không phát hiện chủ đề cụ thể
    const defaultResponses = [
        "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể hỏi về sản phẩm, giá cả, xu hướng thời trang hoặc chính sách của cửa hàng.",
        "Tôi chưa được đào tạo để trả lời câu hỏi này. Bạn có thể hỏi tôi về các sản phẩm thời trang, khuyến mãi, hoặc chính sách của cửa hàng không?",
        "Câu hỏi của bạn nằm ngoài phạm vi kiến thức của tôi. Tôi có thể giúp bạn với thông tin về sản phẩm, xu hướng thời trang và các dịch vụ của cửa hàng.",
        "Tôi xin lỗi vì không thể cung cấp thông tin bạn cần. Hãy thử hỏi về sản phẩm, phong cách thời trang, hoặc các chính sách mua hàng của chúng tôi."
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

module.exports = {
    getContextAwareResponse,
    analyzeMessage
}; 
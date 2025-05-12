/**
 * Gemini AI Chatbot Integration
 * Tích hợp chatbot sử dụng Google Gemini API
 */

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// Cấu hình
const config = {
    apiKey: process.env.GEMINI_API_KEY || 'your-api-key',
    modelName: process.env.GEMINI_MODEL || 'gemini-pro',
};

// Khởi tạo client Gemini
const genAI = new GoogleGenerativeAI(config.apiKey, { apiVersion: 'v1' });

// Cấu hình an toàn
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

/**
 * Gửi tin nhắn đến Gemini và nhận phản hồi
 * @param {string} message - Tin nhắn của người dùng
 * @param {Array} history - Lịch sử hội thoại
 * @returns {Promise<string>} - Phản hồi từ Gemini
 */
async function sendMessage(message, history = []) {
    try {
        // Kiểm tra API key
        if (!config.apiKey || config.apiKey === 'your-api-key') {
            throw new Error('API key không hợp lệ hoặc không được định nghĩa trong biến môi trường');
        }
        
        // Lấy mô hình
        const model = genAI.getGenerativeModel({ model: config.modelName });
        
        // Đảm bảo rằng lịch sử hợp lệ (bắt đầu với người dùng)
        let formattedHistory = [];
        let currentHistory = [...history];
        
        // Nếu lịch sử trống hoặc bắt đầu với tin nhắn khác user, thêm tin nhắn user giả
        if (currentHistory.length === 0 || 
            (currentHistory[0].role !== 'user' && currentHistory[0].role !== 'customer')) {
            // Thêm tin nhắn user vào đầu
            currentHistory.unshift({
                role: 'user',
                content: 'Xin chào, tôi cần tư vấn về thời trang',
                timestamp: new Date()
            });
        }
        
        // Định dạng lịch sử hội thoại theo cấu trúc Gemini chat
        formattedHistory = currentHistory.map(msg => {
            // Đảm bảo msg.role là 'user' hoặc 'model'
            let role = msg.role;
            if (role === 'assistant' || role === 'system' || role === 'bot') role = 'model';
            if (role === 'customer' || role === 'client') role = 'user';
            if (role !== 'user' && role !== 'model') role = 'user'; // Default to user
            
            return {
                role: role,
                parts: [{ text: msg.content }]
            };
        });
        
        // Tạo chat session
        const chat = model.startChat({
            history: formattedHistory,
            safetySettings,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1000,
            },
        });
        
        // Gửi tin nhắn và nhận phản hồi
        const result = await chat.sendMessage(message);
        const response = result.response;
        
        // Kiểm tra nếu có phản hồi hợp lệ
        if (!response || !response.text) {
            throw new Error('Không nhận được phản hồi hợp lệ từ Gemini API');
        }
        
        // Trả về văn bản
        return response.text();
    } catch (error) {
        console.error('Gemini API Error:', error);
        
        // Phân tích lỗi cụ thể
        if (error.message.includes('API key')) {
            throw new Error('Lỗi xác thực API key. Vui lòng kiểm tra lại API key trong file .env');
        }
        
        if (error.message.includes('not found')) {
            throw new Error(`Model "${config.modelName}" không tồn tại hoặc không được hỗ trợ. Vui lòng thử model khác như "gemini-pro"`);
        }
        
        if (error.message.includes('First content should be with role')) {
            throw new Error('Lịch sử chat với Gemini phải bắt đầu bằng tin nhắn user. Đã thử khắc phục nhưng không thành công.');
        }
        
        // Trả về phản hồi dự phòng nếu lỗi
        return "Xin lỗi, tôi gặp vấn đề khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.";
    }
}

/**
 * Lấy phản hồi thông minh dựa trên ngữ cảnh hội thoại
 * @param {Array} messages - Mảng các tin nhắn trước đó
 * @param {string} userMessage - Tin nhắn mới nhất của người dùng
 * @returns {Promise<string>} - Phản hồi từ chatbot
 */
async function getContextAwareResponse(messages, userMessage) {
    try {
        // Lấy tối đa 10 tin nhắn gần nhất để tạo ngữ cảnh
        const recentMessages = messages.slice(-10);
        
        // Gửi tin nhắn đến Gemini với lịch sử hội thoại
        return await sendMessage(userMessage, recentMessages);
    } catch (error) {
        console.error('Error getting context-aware response:', error.message);
        throw error; // Chuyển tiếp lỗi để xử lý ở controller
    }
}

module.exports = {
    sendMessage,
    getContextAwareResponse
}; 
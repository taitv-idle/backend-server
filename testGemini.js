/**
 * File kiểm tra tích hợp Gemini AI
 */
require('dotenv').config();
const geminiAI = require('./utils/geminiAI');

console.log("===== KIỂM TRA CHATBOT GEMINI =====\n");

// Kiểm tra cấu hình
console.log("Kiểm tra cấu hình Gemini:");
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Lỗi: GEMINI_API_KEY không được cấu hình trong file .env");
    console.log("Vui lòng chạy 'node checkGeminiConfig.js' để xem hướng dẫn cấu hình");
    process.exit(1);
}
console.log("API Key:", process.env.GEMINI_API_KEY ? '✅ Đã cấu hình' : '❌ Chưa cấu hình');
console.log("Model:", process.env.GEMINI_MODEL || 'gemini-pro');
console.log("\n------------------------\n");

// Sửa model mặc định nếu không có trong môi trường
if (!process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = 'gemini-pro';
}

// Danh sách tin nhắn kiểm tra
const testMessages = [
    "Xin chào",
    "Tôi đang tìm áo phông cho mùa hè"
];

// Lịch sử hội thoại giả - BẮT ĐẦU với tin nhắn user trước
const mockHistory = [
    {
        role: 'user',
        content: 'Xin chào, tôi cần tư vấn thời trang',
        timestamp: new Date()
    },
    {
        role: 'assistant',
        content: 'Xin chào! Tôi là trợ lý thời trang ảo. Tôi có thể giúp gì cho bạn?',
        timestamp: new Date()
    }
];

// Kiểm tra từng tin nhắn
async function runTest() {
    console.log("Bắt đầu kiểm tra kết nối với Gemini API...\n");
    
    for (const message of testMessages) {
        console.log(`[Người dùng]: ${message}`);
        
        try {
            // Thêm tin nhắn người dùng vào lịch sử
            mockHistory.push({
                role: 'user',
                content: message,
                timestamp: new Date()
            });
            
            // Lấy phản hồi từ Gemini
            const response = await geminiAI.getContextAwareResponse(mockHistory, message);
            console.log(`[Trợ lý]: ${response}`);
            
            // Thêm phản hồi bot vào lịch sử
            mockHistory.push({
                role: 'assistant',
                content: response,
                timestamp: new Date()
            });
            
            console.log("✅ Kiểm tra thành công");
            console.log("------------------------");
        } catch (error) {
            console.error(`❌ Lỗi với tin nhắn "${message}":`);
            console.error(`   ${error.message}`);
            
            if (error.message.includes('not found for API version')) {
                console.log("\nGợi ý sửa lỗi:");
                console.log("- Kiểm tra lại tên model trong .env (thử 'gemini-pro' thay vì 'gemini-1.5-pro')");
                console.log("- Đảm bảo rằng bạn đang sử dụng đúng phiên bản API trong utils/geminiAI.js");
            }
            
            if (error.message.includes('API key')) {
                console.log("\nGợi ý sửa lỗi:");
                console.log("- Kiểm tra lại API key trong file .env");
                console.log("- Đảm bảo rằng API key đã được kích hoạt và còn hiệu lực");
            }
            
            if (error.message.includes('First content should be with role')) {
                console.log("\nGợi ý sửa lỗi:");
                console.log("- Lịch sử chat với Gemini phải bắt đầu bằng tin nhắn user");
                console.log("- Kiểm tra lại cách định dạng lịch sử hội thoại trong utils/geminiAI.js");
            }
            
            if (error.message.includes('quota')) {
                console.log("\nGợi ý sửa lỗi:");
                console.log("- Bạn đã vượt quá giới hạn sử dụng miễn phí của Gemini API");
                console.log("- Đợi vài phút hoặc nâng cấp tài khoản của bạn");
                console.log("- Thử sử dụng model 'gemini-pro' thay vì 'gemini-1.5-pro'");
            }
            
            console.log("------------------------");
            
            // Thêm phản hồi dự phòng vào lịch sử
            mockHistory.push({
                role: 'assistant',
                content: "Xin lỗi, tôi gặp vấn đề khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.",
                timestamp: new Date()
            });
        }
    }
}

// Chạy kiểm tra
runTest()
    .then(() => console.log("\n===== KẾT THÚC KIỂM TRA ====="))
    .catch(err => {
        console.error("\n===== LỖI THỰC THI KIỂM TRA =====");
        console.error(err);
        process.exit(1);
    }); 
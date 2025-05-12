/**
 * Script để kiểm tra cấu hình Gemini API
 */
require('dotenv').config();

console.log("===== KIỂM TRA CẤU HÌNH GEMINI =====\n");

// Kiểm tra API key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ GEMINI_API_KEY không được cấu hình trong file .env");
    console.log("Vui lòng thêm GEMINI_API_KEY=your_api_key_here vào file .env");
} else {
    console.log("✅ GEMINI_API_KEY đã được cấu hình");
    // Kiểm tra API key có đúng định dạng không (để tránh hiển thị toàn bộ key)
    if (apiKey.startsWith('AI') && apiKey.length > 20) {
        console.log("✅ Định dạng API key có vẻ hợp lệ");
    } else {
        console.warn("⚠️ API key có vẻ không đúng định dạng. API key Gemini thường bắt đầu bằng 'AI' và dài hơn 20 ký tự");
    }
}

// Kiểm tra Model
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
console.log(`✅ Model đang sử dụng: ${modelName}`);

// Gợi ý các model phổ biến để thử
console.log("\nCác model Gemini được đề xuất:");
console.log("- gemini-pro (model tiêu chuẩn)");
console.log("- gemini-1.5-pro (phiên bản mới nhất)");
console.log("- gemini-flash (phản hồi nhanh hơn)");

console.log("\n===== HOÀN THÀNH KIỂM TRA =====");
console.log("Nếu API key đã cấu hình đúng, hãy chạy 'node testGemini.js' để kiểm tra kết nối với Gemini API"); 
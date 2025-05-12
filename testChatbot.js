/**
 * Tệp kiểm tra chatbot thời trang
 */
const simpleChatbot = require('./config/simpleChatbot');

console.log("===== KIỂM TRA CHATBOT THỜI TRANG =====\n");

// Danh sách các câu hỏi mẫu để kiểm tra
const testMessages = [
    "Xin chào",
    "Tôi đang tìm áo phông cho mùa hè",
    "Các xu hướng thời trang năm nay là gì?",
    "Làm thế nào để phối đồ đẹp?",
    "Giá áo phông là bao nhiêu?",
    "Bạn có giao hàng không?",
    "Tôi muốn mua quần jean",
    "Có khuyến mãi gì không?",
    "Làm sao để chọn size áo phù hợp?",
    "Cám ơn bạn nhiều"
];

// Chạy kiểm tra từng tin nhắn
testMessages.forEach((message, index) => {
    console.log(`[Người dùng]: ${message}`);
    const response = simpleChatbot.getResponse(message);
    console.log(`[Trợ lý]: ${response}`);
    console.log("------------------------");
});

console.log("\n===== KẾT THÚC KIỂM TRA ====="); 
const { OpenAI } = require('openai');

// Cấu hình OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Các phản hồi dự phòng khi không thể gọi API
const fallbackResponses = [
    'Xin lỗi vì sự bất tiện, hệ thống hiện đang trong quá trình nâng cấp, tôi chỉ có thể cung cấp thông tin cơ bản.',
    'Rất vui được gặp bạn! Bạn đang tìm kiếm loại trang phục nào?',
    'Chúng tôi có nhiều mẫu áo, quần, váy mới về. Bạn có muốn tôi giới thiệu không?',
    'Phong cách thời trang nào bạn thích? Tối giản, năng động, hay thanh lịch?',
    'Hiện cửa hàng đang có chương trình khuyến mãi cho các sản phẩm mùa hè. Bạn có muốn xem không?',
    'Chúng tôi cung cấp dịch vụ tư vấn phối đồ miễn phí. Bạn có thể mô tả phong cách bạn yêu thích.',
    'Đối với câu hỏi về size, bạn có thể cho tôi biết chiều cao và cân nặng để tôi gợi ý size phù hợp.',
];

// Hàm lấy phản hồi dự phòng ngẫu nhiên
const getFallbackResponse = () => {
    const randomIndex = Math.floor(Math.random() * fallbackResponses.length);
    return fallbackResponses[randomIndex];
};

module.exports = openai;
module.exports.getFallbackResponse = getFallbackResponse; 
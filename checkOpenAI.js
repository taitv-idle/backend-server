require('dotenv').config();
const { OpenAI } = require('openai');

// Hiển thị phiên bản API key (ẩn phần giữa)
const apiKey = process.env.OPENAI_API_KEY || 'Không tìm thấy';
const maskedKey = apiKey.length > 10 
    ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
    : 'Không hợp lệ';

console.log(`API Key (đã ẩn): ${maskedKey}`);

// Kiểm tra kết nối với OpenAI
async function testOpenAI() {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        console.log('Đang kiểm tra kết nối OpenAI...');
        
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'Bạn là một trợ lý hữu ích.' },
                { role: 'user', content: 'Xin chào, đây là tin nhắn kiểm tra.' }
            ],
            max_tokens: 50
        });

        console.log('Kết nối thành công!');
        console.log('Phản hồi từ OpenAI:', response.choices[0].message.content);
        return true;
    } catch (error) {
        console.error('Lỗi kết nối với OpenAI:', error.message);
        if (error.response) {
            console.error('Thông tin lỗi:', error.response.status, error.response.data);
        }
        return false;
    }
}

testOpenAI().then(result => {
    if (result) {
        console.log('Bạn có thể sử dụng OpenAI API trong ứng dụng của mình.');
    } else {
        console.log('Vui lòng kiểm tra lại API key và cấu hình.');
    }
}); 
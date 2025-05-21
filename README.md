# E-commerce Backend Server

Backend server API for the e-commerce application with integrated chatbot functionality.

## Chatbot Features

The application offers multiple chatbot options:

1. **Keyword-based Chatbot** (SimpleChatbot)
   - Basic keyword-matching chatbot
   - Runs entirely local without external API dependencies
   - Responds to fashion-related queries based on predefined answers

2. **Botpress AI Chatbot** 
   - Sophisticated chatbot powered by Botpress
   - Provides more natural conversations with better context understanding
   - Supports multi-turn conversations and more complex queries
   - Requires Botpress account setup - see setup guide in docs/botpress-setup.md

3. **Google Gemini Chatbot**
   - Powerful AI-driven chatbot using Google's Gemini model
   - Excellent support for Vietnamese language
   - Advanced natural language understanding and generation
   - Free tier available with API limits
   - Requires Google AI Studio account - see setup guide in docs/gemini-setup.md

## Email Notifications with Mailgun

Hệ thống đã tích hợp Mailgun để gửi thông báo email cho các sự kiện sau:

1. **Đăng ký tài khoản**: Gửi email chào mừng cho người dùng mới
2. **Đăng nhập**: Thông báo đăng nhập cho người dùng
3. **Quên mật khẩu**: Gửi link đặt lại mật khẩu

### Cấu hình Mailgun

Để sử dụng tính năng gửi email, bạn cần thêm các biến môi trường sau vào file `.env`:

```
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
MAILGUN_SENDER=Ecommerce <no-reply@your_mailgun_domain>
CLIENT_URL=http://localhost:3000
```

### Cài đặt

```bash
npm install form-data mailgun.js
```

### Sử dụng

Dịch vụ email đã được tích hợp vào các controller xử lý đăng nhập, đăng ký và đặt lại mật khẩu. Bạn có thể sử dụng trực tiếp dịch vụ email trong các controller khác bằng cách:

```javascript
const emailService = require('../services/emailService');

// Gửi email tùy chỉnh
await emailService.sendEmail(
  'recipient@example.com',
  'Tiêu đề email',
  'Nội dung text',
  '<p>Nội dung HTML</p>'
);
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your configuration (see `.env.example` for reference)
4. Run the server:
   ```
   npm run server
   ```

## Chatbot Testing

To test the chatbot functionality:

- **Simple Chatbot**: Run `node testChatbot.js`
- **Botpress Chatbot**: Configure Botpress account, then run `node testBotpress.js`
- **Gemini Chatbot**: Configure Google AI Studio account, then run `node testGemini.js`

## API Endpoints

### AI Chatbot

#### Keyword-based Simple Chatbot
- `GET /api/chat/fashion/init` - Initialize new chat session
- `POST /api/chat/fashion/send` - Send message and get response
- `GET /api/chat/fashion/history/:sessionId` - Get chat history
- `DELETE /api/chat/fashion/:sessionId` - Delete chat session

#### Botpress AI Chatbot
- `GET /api/chat/botpress/init` - Initialize new chat session
- `POST /api/chat/botpress/send` - Send message and get response
- `GET /api/chat/botpress/history/:sessionId` - Get chat history
- `DELETE /api/chat/botpress/:sessionId` - Delete chat session

#### Google Gemini Chatbot
- `GET /api/chat/gemini/init` - Initialize new chat session
- `POST /api/chat/gemini/send` - Send message and get response
- `GET /api/chat/gemini/history/:sessionId` - Get chat history
- `DELETE /api/chat/gemini/:sessionId` - Delete chat session

## Documentation

For more detailed information, refer to:
- [Botpress Setup Guide](docs/botpress-setup.md)
- [Gemini Setup Guide](docs/gemini-setup.md)

## License

This project is licensed under the ISC License. 
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
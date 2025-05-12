const { OpenAI } = require('openai');

// Cấu hình OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = openai; 
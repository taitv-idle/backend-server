const formData = require('form-data');
const Mailgun = require('mailgun.js');
const HttpsProxyAgent = require('https-proxy-agent');

const mailgun = new Mailgun(formData);

// Cấu hình Mailgun từ biến môi trường
const apiKey = process.env.MAILGUN_API_KEY;
const domain = process.env.MAILGUN_DOMAIN || 'your-domain.mailgun.org';
const sender = process.env.MAILGUN_SENDER || 'Ecommerce <no-reply@your-domain.mailgun.org>';

// Chỉ khởi tạo client Mailgun nếu có API key
let mg = null;
if (apiKey && apiKey !== 'your_mailgun_api_key') {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    mg = mailgun.client({
        username: 'api',
        key: apiKey,
        url: 'https://api.mailgun.net',
        agent: agent
    });
} else {
    console.warn('Mailgun API key not configured. Email functionality will be disabled.');
}

module.exports = {
    mg,
    domain,
    sender,
    isConfigured: !!mg
}; 
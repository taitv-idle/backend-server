const formData = require('form-data');
const Mailgun = require('mailgun.js');

const mailgun = new Mailgun(formData);

// Cấu hình Mailgun từ biến môi trường
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY || 'your-api-key',
    url: 'https://api.eu.mailgun.net' // Sử dụng URL phù hợp với region của bạn (EU hoặc US)
});

const domain = process.env.MAILGUN_DOMAIN || 'your-domain.mailgun.org';
const sender = process.env.MAILGUN_SENDER || 'Ecommerce <no-reply@your-domain.mailgun.org>';

module.exports = {
    mg,
    domain,
    sender
}; 
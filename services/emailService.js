const { mg, domain, sender } = require('../config/mailgun');

class EmailService {
    /**
     * Gửi email thông qua Mailgun
     * @param {string} to - Email người nhận
     * @param {string} subject - Tiêu đề email
     * @param {string} text - Nội dung email dạng text
     * @param {string} html - Nội dung email dạng HTML
     * @returns {Promise} - Kết quả gửi email
     */
    async sendEmail(to, subject, text, html) {
        try {
            const data = {
                from: sender,
                to,
                subject,
                text,
                html
            };

            const result = await mg.messages.create(domain, data);
            console.log('Email sent successfully:', result);
            return { success: true, result };
        } catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Gửi email chào mừng khi đăng ký tài khoản
     * @param {string} to - Email người nhận
     * @param {string} name - Tên người dùng
     * @param {string} role - Vai trò (customer/seller)
     */
    async sendWelcomeEmail(to, name, role) {
        const subject = `Chào mừng bạn đến với Ecommerce`;
        const text = `Xin chào ${name},\n\nChúng tôi rất vui mừng khi bạn đã đăng ký tài khoản ${role} trên nền tảng Ecommerce của chúng tôi. Hãy bắt đầu trải nghiệm ngay hôm nay!\n\nTrân trọng,\nĐội ngũ Ecommerce`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                <h2 style="color: #4a4a4a; text-align: center;">Chào mừng đến với Ecommerce!</h2>
                <p>Xin chào <strong>${name}</strong>,</p>
                <p>Chúng tôi rất vui mừng khi bạn đã đăng ký tài khoản <strong>${role}</strong> trên nền tảng Ecommerce của chúng tôi.</p>
                <p>Hãy bắt đầu trải nghiệm ngay hôm nay!</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Truy cập ngay</a>
                </div>
                <p style="margin-top: 30px;">Trân trọng,<br>Đội ngũ Ecommerce</p>
            </div>
        `;

        return this.sendEmail(to, subject, text, html);
    }

    /**
     * Gửi email thông báo đăng nhập
     * @param {string} to - Email người nhận
     * @param {string} name - Tên người dùng
     * @param {string} time - Thời gian đăng nhập
     * @param {string} device - Thiết bị đăng nhập
     */
    async sendLoginNotification(to, name, time, device) {
        const subject = `Thông báo đăng nhập tài khoản Ecommerce`;
        const text = `Xin chào ${name},\n\nTài khoản của bạn vừa được đăng nhập vào lúc ${time} trên thiết bị ${device}. Nếu đó không phải là bạn, vui lòng thay đổi mật khẩu ngay lập tức.\n\nTrân trọng,\nĐội ngũ Ecommerce`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                <h2 style="color: #4a4a4a; text-align: center;">Thông báo đăng nhập</h2>
                <p>Xin chào <strong>${name}</strong>,</p>
                <p>Tài khoản của bạn vừa được đăng nhập vào lúc <strong>${time}</strong> trên thiết bị <strong>${device}</strong>.</p>
                <p>Nếu đó không phải là bạn, vui lòng thay đổi mật khẩu ngay lập tức.</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Đổi mật khẩu</a>
                </div>
                <p style="margin-top: 30px;">Trân trọng,<br>Đội ngũ Ecommerce</p>
            </div>
        `;

        return this.sendEmail(to, subject, text, html);
    }

    /**
     * Gửi email đặt lại mật khẩu
     * @param {string} to - Email người nhận
     * @param {string} name - Tên người dùng
     * @param {string} resetToken - Token đặt lại mật khẩu
     */
    async sendPasswordResetEmail(to, name, resetToken) {
        const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        
        const subject = `Yêu cầu đặt lại mật khẩu Ecommerce`;
        const text = `Xin chào ${name},\n\nChúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấp vào liên kết sau để đặt lại mật khẩu: ${resetLink}\n\nLiên kết này sẽ hết hạn sau 15 phút.\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.\n\nTrân trọng,\nĐội ngũ Ecommerce`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                <h2 style="color: #4a4a4a; text-align: center;">Đặt lại mật khẩu</h2>
                <p>Xin chào <strong>${name}</strong>,</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấp vào nút bên dưới để đặt lại mật khẩu:</p>
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${resetLink}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
                </div>
                <p style="margin-top: 20px;">Liên kết này sẽ hết hạn sau 15 phút.</p>
                <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                <p style="margin-top: 30px;">Trân trọng,<br>Đội ngũ Ecommerce</p>
            </div>
        `;

        return this.sendEmail(to, subject, text, html);
    }
}

module.exports = new EmailService(); 
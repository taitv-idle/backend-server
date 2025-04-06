const sellerModel = require('../../models/sellerModel');
const stripeModel = require('../../models/stripeModel');
const sellerWallet = require('../../models/sellerWallet');
const withdrowRequest = require('../../models/withdrowRequest');
const { v4: uuidv4 } = require('uuid');
const { responseReturn } = require('../../utiles/response');
const { mongo: { ObjectId } } = require('mongoose');

// Khởi tạo Stripe với API key
const stripe = require('stripe')(process.env.STRIP_KEY);

class PaymentController {
    /**
     * Tạo tài khoản Stripe Connect cho seller
     */
    create_stripe_connect_account = async (req, res) => {
        const { id } = req;
        const uid = uuidv4();

        try {
            // Kiểm tra xem Stripe Connect đã được kích hoạt chưa
            const stripeAccount = await stripe.accounts.list();
            if (!stripeAccount) {
                return responseReturn(res, 403, {
                    message: 'Tính năng thanh toán chưa được kích hoạt. Vui lòng liên hệ quản trị viên.'
                });
            }

            // Xóa thông tin cũ nếu tồn tại
            await stripeModel.deleteMany({ sellerId: id });

            // Tạo tài khoản Express mới
            const account = await stripe.accounts.create({
                type: 'express',
                capabilities: {
                    transfers: { requested: true }
                }
            });

            const accountLink = await stripe.accountLinks.create({
                account: account.id,
                refresh_url: 'http://localhost:3000/refresh',
                return_url: `http://localhost:3000//success?activeCode=${uid}`,
                type: 'account_onboarding'
            });

            await stripeModel.create({
                sellerId: id,
                stripeId: account.id,
                code: uid
            });

            responseReturn(res, 200, {
                url: accountLink.url,
                message: 'Vui lòng hoàn thành kết nối tài khoản thanh toán'
            });

        } catch (error) {
            console.error('Stripe connect error:', error);
            let message = 'Lỗi khi kết nối tài khoản thanh toán';
            if (error.code === 'account_invalid') {
                message = 'Hệ thống thanh toán chưa sẵn sàng. Vui lòng thử lại sau.';
            }
            responseReturn(res, 500, { message });
        }
    }

    /**
     * Kích hoạt tài khoản Stripe Connect sau khi seller hoàn thành quá trình kết nối
     */
    active_stripe_connect_account = async (req, res) => {
        const { activeCode } = req.params; // Mã kích hoạt từ URL
        const { id } = req; // ID của seller

        try {
            // Tìm thông tin Stripe theo mã kích hoạt
            const userStripeInfo = await stripeModel.findOne({ code: activeCode });

            if (userStripeInfo) {
                // Cập nhật trạng thái thanh toán của seller thành "active"
                await sellerModel.findByIdAndUpdate(id, {
                    payment: 'active'
                });
                responseReturn(res, 200, { message: 'Kích hoạt thanh toán thành công' });
            } else {
                responseReturn(res, 404, { message: 'Không tìm thấy thông tin kích hoạt' });
            }

        } catch (error) {
            console.log('Active stripe error: ' + error.message);
            responseReturn(res, 500, { message: 'Lỗi server khi kích hoạt thanh toán' });
        }
    }

    /**
     * Tính tổng số tiền từ một mảng các đối tượng có thuộc tính amount
     */
    sumAmount = (data) => {
        return data.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    /**
     * Lấy chi tiết thanh toán của seller
     */
    get_seller_payment_details = async (req, res) => {
        const { sellerId } = req.params;

        try {
            // Lấy tất cả các giao dịch trong ví của seller
            const payments = await sellerWallet.find({ sellerId });

            // Lấy các yêu cầu rút tiền đang chờ xử lý
            const pendingWithdrows = await withdrowRequest.find({
                sellerId: sellerId,
                status: 'pending'
            });

            // Lấy các yêu cầu rút tiền đã thành công
            const successWithdrows = await withdrowRequest.find({
                sellerId: sellerId,
                status: 'success'
            });

            // Tính toán các số tiền
            const pendingAmount = this.sumAmount(pendingWithdrows);
            const withdrowAmount = this.sumAmount(successWithdrows);
            const totalAmount = this.sumAmount(payments);

            // Tính số tiền có sẵn để rút
            let availableAmount = Math.max(0, totalAmount - (pendingAmount + withdrowAmount));

            responseReturn(res, 200, {
                totalAmount,
                pendingAmount,
                withdrowAmount,
                availableAmount,
                pendingWithdrows,
                successWithdrows
            });

        } catch (error) {
            console.log('Get payment details error: ' + error.message);
            responseReturn(res, 500, { message: 'Lỗi khi lấy thông tin thanh toán' });
        }
    }

    /**
     * Xử lý yêu cầu rút tiền từ seller
     */
    withdrowal_request = async (req, res) => {
        const { amount, sellerId } = req.body;

        try {
            // Tạo yêu cầu rút tiền mới
            const withdrowal = await withdrowRequest.create({
                sellerId,
                amount: parseInt(amount)
            });
            responseReturn(res, 200, {
                withdrowal,
                message: 'Yêu cầu rút tiền đã được gửi'
            });
        } catch (error) {
            console.log('Withdrowal request error: ' + error.message);
            responseReturn(res, 500, {
                message: 'Lỗi khi gửi yêu cầu rút tiền'
            });
        }
    }

    /**
     * Lấy danh sách các yêu cầu rút tiền đang chờ xử lý
     */
    get_payment_request = async (req, res) => {
        try {
            const withdrowalRequest = await withdrowRequest.find({
                status: 'pending'
            });
            responseReturn(res, 200, {
                withdrowalRequest
            });
        } catch (error) {
            console.log('Get payment request error: ' + error.message);
            responseReturn(res, 500, {
                message: 'Lỗi khi lấy danh sách yêu cầu'
            });
        }
    }

    /**
     * Xác nhận và xử lý yêu cầu rút tiền
     */
    payment_request_confirm = async (req, res) => {
        const { paymentId } = req.body;

        try {
            const payment = await withdrowRequest.findById(paymentId);
            if (!payment) {
                return responseReturn(res, 404, { message: 'Không tìm thấy yêu cầu thanh toán' });
            }

            // Kiểm tra xem seller đã kết nối Stripe chưa
            const stripeAccount = await stripeModel.findOne({
                sellerId: new ObjectId(payment.sellerId)
            });

            if (!stripeAccount || !stripeAccount.stripeId) {
                return responseReturn(res, 400, {
                    message: 'Seller chưa kết nối tài khoản thanh toán'
                });
            }

            // Kiểm tra tài khoản Stripe có tồn tại không
            try {
                await stripe.accounts.retrieve(stripeAccount.stripeId);
            } catch (err) {
                return responseReturn(res, 400, {
                    message: 'Tài khoản thanh toán không hợp lệ hoặc chưa được kích hoạt'
                });
            }

            // Thực hiện chuyển tiền
            const transfer = await stripe.transfers.create({
                amount: payment.amount * 100,
                currency: 'usd',
                destination: stripeAccount.stripeId
            });

            await withdrowRequest.findByIdAndUpdate(paymentId, {
                status: 'success',
                transferId: transfer.id // Lưu ID giao dịch để tra cứu sau này
            });

            responseReturn(res, 200, {
                message: 'Xác nhận yêu cầu thành công'
            });

        } catch (error) {
            console.error('Payment confirm error:', error);
            let message = 'Lỗi khi xác nhận yêu cầu';
            if (error.type === 'StripeInvalidRequestError') {
                message = 'Lỗi kết nối với hệ thống thanh toán';
            }
            responseReturn(res, 500, { message });
        }
    }
}

module.exports = new PaymentController();
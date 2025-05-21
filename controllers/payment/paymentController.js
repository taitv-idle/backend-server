const mongoose = require('mongoose');
const sellerModel = require('../../models/sellerModel');
const stripeModel = require('../../models/stripeModel');
const sellerWallet = require('../../models/sellerWallet');
const withdrowRequest = require('../../models/withdrowRequest');
const myShopWallet = require('../../models/myShopWallet');
const { v4: uuidv4 } = require('uuid');
const { responseReturn } = require('../../utils/response');
const { mongo: { ObjectId } } = require('mongoose');

// Khởi tạo Stripe với API key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
                    transfers: { requested: true },
                    card_payments: { requested: true }
                },
                settings: {
                    payouts: {
                        schedule: {
                            interval: 'manual'
                        }
                    }
                },
                country: 'VN',
                default_currency: 'vnd'
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
    const { paymentId, amountInUSD } = req.body;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // Kiểm tra yêu cầu
        const payment = await withdrowRequest.findOne({ _id: paymentId.id || paymentId }).session(session);
        if (!payment) {
            throw new Error('Không tìm thấy yêu cầu thanh toán');
        }

        // Kiểm tra tài khoản Stripe
        const stripeAccount = await stripeModel.findOne({
            sellerId: payment.sellerId
        }).session(session);

        if (!stripeAccount || !stripeAccount.stripeId) {
            throw new Error('Seller chưa kết nối tài khoản thanh toán');
        }

        // Kiểm tra tài khoản Stripe hợp lệ
        const account = await stripe.accounts.retrieve(stripeAccount.stripeId);
        console.log('Stripe account details:', {
            id: account.id,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            charges_enabled: account.charges_enabled,
            capabilities: account.capabilities
        });
        
        if (!account.details_submitted || account.payouts_enabled !== true) {
            throw new Error('Tài khoản thanh toán chưa sẵn sàng nhận tiền');
        }

        // Kiểm tra số dư tài khoản
        const balance = await stripe.balance.retrieve();
        console.log('Available balance:', balance.available);

        // Xác định số tiền USD để chuyển
        let amount;
        if (typeof paymentId === 'object' && paymentId.amountInUSD) {
            // Nếu paymentId là đối tượng và có amountInUSD
            amount = parseFloat(paymentId.amountInUSD);
        } else if (amountInUSD) {
            // Nếu amountInUSD được cung cấp riêng
            amount = parseFloat(amountInUSD);
        } else {
            // Sử dụng số tiền từ payment, giả sử đã được chuyển đổi sang USD
            amount = parseFloat(payment.amount / 22000); // Tỷ giá VND/USD ước tính
        }

        console.log('Amount to transfer (USD):', amount);

        // Kiểm tra tính hợp lệ của số tiền
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Số tiền không hợp lệ');
        }

        // Chuyển đổi số tiền USD sang cents (Stripe yêu cầu số tiền nhỏ nhất là cents)
        const amountInCents = Math.round(amount * 100);
        
        // Kiểm tra lại để đảm bảo amountInCents là số nguyên dương
        if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
            throw new Error('Số tiền sau quy đổi không hợp lệ');
        }

        // Thực hiện chuyển tiền
        const transfer = await stripe.transfers.create({
            amount: amountInCents,
            currency: 'usd',
            destination: stripeAccount.stripeId,
            description: `Rút tiền cho seller ${payment.sellerId} (${amount} USD)`
        });

        // Cập nhật trạng thái yêu cầu
        await withdrowRequest.findOneAndUpdate(
            { _id: paymentId.id || paymentId },
            {
                status: 'success',
                transferId: transfer.id,
                processDate: new Date()
            },
            { session }
        );

        await session.commitTransaction();

        responseReturn(res, 200, {
            message: 'Xác nhận yêu cầu thành công',
            transferId: transfer.id
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Payment confirm error:', error);

        // Cập nhật trạng thái thất bại
        if (paymentId) {
            await withdrowRequest.findOneAndUpdate(
                { _id: paymentId.id || paymentId },
                {
                    status: 'failed',
                    failureReason: error.message
                }
            );
        }

        responseReturn(res, 500, {
            message: error.message || 'Lỗi khi xác nhận yêu cầu'
        });
    } finally {
        session.endSession();
    }
}

/**
 * Lấy lịch sử thanh toán cho admin
 */
get_all_payment_history = async (req, res) => {
    try {
        // Lấy tham số phân trang từ query
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';

        // Xây dựng điều kiện tìm kiếm
        let query = {};
        
        if (status) {
            query.status = status;
        }
        
        if (search) {
            // Tìm seller IDs phù hợp với từ khóa tìm kiếm
            const sellers = await sellerModel.find({
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            
            const sellerIds = sellers.map(seller => seller._id.toString());
            if (sellerIds.length > 0) {
                query.sellerId = { $in: sellerIds };
            }
        }

        // Lấy tổng số yêu cầu rút tiền
        const totalWithdrawals = await withdrowRequest.countDocuments(query);
        
        // Lấy danh sách yêu cầu rút tiền với phân trang
        const withdrawals = await withdrowRequest.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Lấy thông tin chi tiết của seller cho mỗi yêu cầu
        const withdrawalDetails = [];
        for (const withdrawal of withdrawals) {
            const seller = await sellerModel.findById(withdrawal.sellerId).select('name email shopInfo');
            
            withdrawalDetails.push({
                ...withdrawal._doc,
                seller: seller ? {
                    name: seller.name,
                    email: seller.email,
                    shopName: seller.shopInfo?.shopName || 'N/A'
                } : { name: 'Unknown', email: 'Unknown', shopName: 'Unknown' }
            });
        }
        
        // Tính toán tổng số tiền đã rút và đang chờ xử lý
        const totalWithdrawnAmount = await withdrowRequest.aggregate([
            { $match: { status: 'success' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const totalPendingAmount = await withdrowRequest.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        // Thống kê theo tháng/năm
        const currentYear = new Date().getFullYear();
        const monthlyStats = await sellerWallet.aggregate([
            { 
                $match: { year: currentYear } 
            },
            {
                $group: {
                    _id: '$month',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        responseReturn(res, 200, {
            withdrawals: withdrawalDetails,
            totalWithdrawals,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalWithdrawals / limit),
                totalItems: totalWithdrawals,
                perPage: limit
            },
            stats: {
                totalWithdrawnAmount: totalWithdrawnAmount[0]?.total || 0,
                totalPendingAmount: totalPendingAmount[0]?.total || 0,
                monthlyStats
            }
        });
    } catch (error) {
        console.log('Get payment history error:', error.message);
        responseReturn(res, 500, { message: 'Lỗi khi lấy lịch sử thanh toán' });
    }
}

/**
 * Lấy tổng quan về doanh thu cho admin
 */
get_admin_payment_overview = async (req, res) => {
    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // JavaScript tháng bắt đầu từ 0
        
        // Lấy doanh thu của shop theo tháng trong năm hiện tại
        const shopMonthlyRevenue = await myShopWallet.aggregate([
            { 
                $match: { year: currentYear } 
            },
            {
                $group: {
                    _id: '$month',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        // Lấy doanh thu của các sellers theo tháng trong năm hiện tại
        const sellersMonthlyRevenue = await sellerWallet.aggregate([
            { 
                $match: { year: currentYear } 
            },
            {
                $group: {
                    _id: { month: '$month', sellerId: '$sellerId' },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.month': 1 } }
        ]);
        
        // Tổng doanh thu của shop
        const totalShopRevenue = await myShopWallet.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        // Tổng doanh thu của tháng hiện tại
        const currentMonthRevenue = await myShopWallet.aggregate([
            { 
                $match: { 
                    year: currentYear,
                    month: currentMonth
                } 
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        // Tổng doanh thu của tháng trước
        const lastMonthRevenue = await myShopWallet.aggregate([
            { 
                $match: { 
                    year: currentMonth === 1 ? currentYear - 1 : currentYear,
                    month: currentMonth === 1 ? 12 : currentMonth - 1
                } 
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        // Top 5 sellers có doanh thu cao nhất
        const topSellers = await sellerWallet.aggregate([
            {
                $group: {
                    _id: '$sellerId',
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { total: -1 } },
            { $limit: 5 }
        ]);
        
        // Lấy thông tin chi tiết của top sellers
        const topSellersDetails = [];
        for (const seller of topSellers) {
            const sellerInfo = await sellerModel.findById(seller._id).select('name email shopInfo');
            if (sellerInfo) {
                topSellersDetails.push({
                    sellerId: seller._id,
                    name: sellerInfo.name,
                    email: sellerInfo.email,
                    shopName: sellerInfo.shopInfo?.shopName || 'N/A',
                    total: seller.total
                });
            }
        }
        
        // Tính tỷ lệ tăng trưởng so với tháng trước
        const currentMonthTotal = currentMonthRevenue[0]?.total || 0;
        const lastMonthTotal = lastMonthRevenue[0]?.total || 0;
        
        let growthRate = 0;
        if (lastMonthTotal > 0) {
            growthRate = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
        } else if (currentMonthTotal > 0) {
            growthRate = 100; // Nếu tháng trước là 0 và tháng này > 0, tăng trưởng 100%
        }
        
        responseReturn(res, 200, {
            totalRevenue: totalShopRevenue[0]?.total || 0,
            currentMonthRevenue: currentMonthTotal,
            lastMonthRevenue: lastMonthTotal,
            growthRate: parseFloat(growthRate.toFixed(2)),
            shopMonthlyRevenue,
            topSellers: topSellersDetails,
            yearlyData: {
                year: currentYear,
                months: Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    const monthData = shopMonthlyRevenue.find(item => item._id === month);
                    return {
                        month,
                        revenue: monthData ? monthData.total : 0
                    };
                })
            }
        });
    } catch (error) {
        console.log('Get admin payment overview error:', error.message);
        responseReturn(res, 500, { message: 'Lỗi khi lấy tổng quan thanh toán' });
    }
}
}

module.exports = new PaymentController();
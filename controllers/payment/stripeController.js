const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { responseReturn } = require('../../utils/response');
const customerOrder = require('../../models/customerOrder');
const authOrderModel = require('../../models/authOrder');
const myShopWallet = require('../../models/myShopWallet');
const sellerWallet = require('../../models/sellerWallet');
const moment = require('moment');
const mongoose = require('mongoose');
const { mongo: { ObjectId } } = mongoose;

class StripeController {
    // Tạo payment intent
    create_payment_intent = async (req, res) => {
        try {
            const { price, orderId } = req.body;
            console.log('Creating payment intent with data:', { 
                price, 
                orderId, 
                userId: req.user.id,
                priceType: typeof price,
                orderIdType: typeof orderId
            });

            // Validate input
            if (!price || !orderId) {
                return responseReturn(res, 400, {
                    message: 'Thiếu thông tin bắt buộc: giá hoặc mã đơn hàng',
                    success: false
                });
            }

            // Convert price to number if it's a string
            const numericPrice = typeof price === 'string' ? parseFloat(price) : price;

            // Validate price
            if (isNaN(numericPrice) || numericPrice <= 0) {
                return responseReturn(res, 400, {
                    message: 'Giá tiền không hợp lệ',
                    success: false
                });
            }

            // Validate orderId format
            if (!mongoose.Types.ObjectId.isValid(orderId)) {
                return responseReturn(res, 400, {
                    message: 'Mã đơn hàng không hợp lệ',
                    success: false
                });
            }

            // Kiểm tra đơn hàng
            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, {
                    message: 'Đơn hàng không tồn tại',
                    success: false
                });
            }

            console.log('Order details:', {
                orderId: order._id,
                orderPrice: order.price,
                orderPriceType: typeof order.price,
                inputPrice: numericPrice,
                inputPriceType: typeof numericPrice
            });

            // Kiểm tra quyền truy cập đơn hàng
            if (order.customerId.toString() !== req.user.id) {
                return responseReturn(res, 403, {
                    message: 'Bạn không có quyền truy cập đơn hàng này',
                    success: false
                });
            }

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                return responseReturn(res, 400, {
                    message: 'Đơn hàng đã được thanh toán',
                    success: false
                });
            }

            // Kiểm tra giá tiền có khớp với đơn hàng không
            // Chuyển đổi cả hai giá trị về số và so sánh
            const orderPrice = typeof order.price === 'string' ? parseFloat(order.price) : order.price;
            if (Math.abs(orderPrice - numericPrice) > 0.01) { // Cho phép sai số nhỏ do chuyển đổi số thập phân
                console.log('Price mismatch:', {
                    orderPrice,
                    inputPrice: numericPrice,
                    difference: Math.abs(orderPrice - numericPrice)
                });
                return responseReturn(res, 400, {
                    message: 'Giá tiền không khớp với đơn hàng',
                    success: false,
                    details: {
                        orderPrice,
                        inputPrice: numericPrice
                    }
                });
            }

            // Tạo payment intent (sử dụng VND)
            const amount = Math.round(numericPrice);
            
            console.log('Creating payment intent:', {
                amount,
                orderId,
                customerId: order.customerId.toString()
            });

            try {
                // Kiểm tra Stripe key
                if (!process.env.STRIPE_SECRET_KEY) {
                    console.error('Stripe secret key is missing');
                    return responseReturn(res, 500, {
                        message: 'Cấu hình thanh toán không hợp lệ',
                        success: false
                    });
                }

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'vnd',
                    metadata: { 
                        orderId,
                        customerId: order.customerId.toString()
                    },
                    description: `Thanh toán cho đơn hàng #${orderId}`,
                    payment_method_types: ['card'],
                    capture_method: 'automatic',
                    confirm: false // Không xác nhận ngay lập tức
                });

                console.log('Payment intent created successfully:', {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency
                });

                // Trả về response với thông tin cần thiết
                return responseReturn(res, 200, {
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id,
                    success: true
                });
            } catch (stripeError) {
                console.error('Stripe API error:', {
                    type: stripeError.type,
                    message: stripeError.message,
                    code: stripeError.code,
                    decline_code: stripeError.decline_code
                });
                
                // Xử lý lỗi Stripe cụ thể
                if (stripeError.type === 'StripeCardError') {
                    return responseReturn(res, 400, {
                        message: 'Thẻ thanh toán không hợp lệ',
                        success: false
                    });
                }
                
                if (stripeError.type === 'StripeInvalidRequestError') {
                    return responseReturn(res, 400, {
                        message: stripeError.message || 'Yêu cầu thanh toán không hợp lệ',
                        success: false
                    });
                }

                // Xử lý lỗi chung
                return responseReturn(res, 500, {
                    message: 'Không thể tạo phiên thanh toán. Vui lòng thử lại sau.',
                    success: false
                });
            }
        } catch (error) {
            console.error('Create payment intent error:', error);
            return responseReturn(res, 500, {
                message: 'Lỗi khi tạo phiên thanh toán',
                success: false
            });
        }
    }

    // Xác nhận thanh toán
    confirm_payment = async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const { orderId } = req.params;
            const { paymentIntentId } = req.body;

            console.log('Confirming payment:', { orderId, paymentIntentId, userId: req.user.id });

            // Validate input
            if (!orderId || !paymentIntentId) {
                return responseReturn(res, 400, {
                    message: 'Thiếu thông tin bắt buộc: orderId hoặc paymentIntentId',
                    success: false
                });
            }

            // Validate orderId format
            if (!mongoose.Types.ObjectId.isValid(orderId)) {
                return responseReturn(res, 400, {
                    message: 'Mã đơn hàng không hợp lệ',
                    success: false
                });
            }

            // Kiểm tra đơn hàng
            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                return responseReturn(res, 404, {
                    message: 'Đơn hàng không tồn tại',
                    success: false
                });
            }

            // Kiểm tra quyền truy cập đơn hàng
            if (order.customerId.toString() !== req.user.id) {
                return responseReturn(res, 403, {
                    message: 'Bạn không có quyền truy cập đơn hàng này',
                    success: false
                });
            }

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                return responseReturn(res, 200, {
                    message: 'Đơn hàng đã được thanh toán',
                    success: true,
                    order
                });
            }

            try {
                // Xác minh payment intent
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                console.log('Payment intent status:', {
                    id: paymentIntent.id,
                    status: paymentIntent.status
                });

                if (paymentIntent.status !== 'succeeded') {
                    return responseReturn(res, 400, {
                        message: 'Thanh toán chưa được xác nhận',
                        success: false,
                        paymentStatus: paymentIntent.status
                    });
                }

                // Kiểm tra payment intent có thuộc về đơn hàng này không
                if (paymentIntent.metadata.orderId !== orderId) {
                    return responseReturn(res, 400, {
                        message: 'Payment intent không thuộc về đơn hàng này',
                        success: false
                    });
                }

                // Cập nhật trạng thái đơn hàng
                await customerOrder.findByIdAndUpdate(orderId, {
                    payment_status: 'paid',
                    delivery_status: 'processing',
                    payment_method: 'stripe'
                }, { session });

                await authOrderModel.updateMany(
                    { orderId: new ObjectId(orderId) },
                    {
                        payment_status: 'paid',
                        delivery_status: 'processing',
                        payment_method: 'stripe'
                    },
                    { session }
                );

                // Cập nhật ví
                const auOrder = await authOrderModel.find({
                    orderId: new ObjectId(orderId)
                }).session(session);

                const time = moment(Date.now()).format('l');
                const splitTime = time.split('/');

                await myShopWallet.create([{
                    amount: order.price,
                    month: splitTime[0],
                    year: splitTime[2]
                }], { session });

                for (const sellerOrder of auOrder) {
                    await sellerWallet.create([{
                        sellerId: sellerOrder.sellerId.toString(),
                        amount: sellerOrder.price,
                        month: splitTime[0],
                        year: splitTime[2]
                    }], { session });
                }

                await session.commitTransaction();

                const updatedOrder = await customerOrder.findById(orderId);

                console.log('Payment confirmed successfully:', {
                    orderId,
                    paymentIntentId,
                    status: 'success'
                });

                responseReturn(res, 200, {
                    message: 'Xác nhận thanh toán thành công',
                    success: true,
                    order: updatedOrder
                });
            } catch (stripeError) {
                console.error('Stripe API error:', stripeError);
                
                // Xử lý lỗi Stripe cụ thể
                if (stripeError.type === 'StripeCardError') {
                    return responseReturn(res, 400, {
                        message: 'Thẻ thanh toán không hợp lệ',
                        success: false
                    });
                }
                
                if (stripeError.type === 'StripeInvalidRequestError') {
                    return responseReturn(res, 400, {
                        message: stripeError.message || 'Yêu cầu thanh toán không hợp lệ',
                        success: false
                    });
                }

                throw stripeError; // Ném lỗi để xử lý ở catch bên ngoài
            }
        } catch (error) {
            await session.abortTransaction();
            console.error('Confirm payment error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xác nhận thanh toán',
                success: false
            });
        } finally {
            session.endSession();
        }
    }
}

module.exports = new StripeController(); 
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
            
            // Luôn sử dụng giá từ đơn hàng thay vì giá gửi lên để đảm bảo chính xác
            const correctPrice = orderPrice;
            
            // Ghi log nếu có sự khác biệt giữa giá gửi lên và giá đơn hàng
            if (orderPrice !== numericPrice) {
                console.log('Price mismatch - using order price instead:', {
                    orderPrice,
                    inputPrice: numericPrice,
                    difference: Math.abs(orderPrice - numericPrice)
                });
            }
            
            // Số tiền ban đầu (VND)
            const amountInVND = Math.round(correctPrice);
            
            console.log('Creating payment intent:', {
                amountInVND,
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

                // Đối với tài khoản Stripe ở Việt Nam, luôn sử dụng USD
                // Chuyển đổi từ VND sang USD
                const exchangeRate = process.env.USD_VND_RATE || 22000;
                const amountInUSD = (amountInVND / exchangeRate).toFixed(2);
                const amountInCents = Math.round(parseFloat(amountInUSD) * 100); // Đổi sang cents
                
                console.log('Payment amount conversion:', {
                    amountInVND,
                    amountInUSD,
                    amountInCents,
                    exchangeRate
                });
                
                // Tạo payment intent với USD
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountInCents,
                    currency: 'usd',
                    metadata: { 
                        orderId,
                        customerId: order.customerId.toString(),
                        originalAmount: amountInVND,
                        originalCurrency: 'vnd',
                        exchangeRate
                    },
                    description: `Thanh toán đơn hàng #${orderId} (${amountInVND.toLocaleString('vi-VN')} VND)`,
                    payment_method_types: ['card'],
                    // Thêm thông tin hiển thị cho khách hàng
                    statement_descriptor: 'Thanh toan don hang',
                    statement_descriptor_suffix: 'ECOMMERCE',
                    capture_method: 'automatic',
                    confirm: false
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
                    currency: 'usd',
                    amountUSD: amountInUSD,
                    amountVND: amountInVND,
                    amountVNDFormatted: amountInVND.toLocaleString('vi-VN') + ' VND',
                    exchangeRate,
                    success: true,
                    message: 'Đã tạo phiên thanh toán thành công'
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
                    status: paymentIntent.status,
                    currency: paymentIntent.currency,
                    metadata: paymentIntent.metadata
                });

                // Kiểm tra trạng thái thanh toán
                if (paymentIntent.status !== 'succeeded') {
                    // Nếu chưa thành công, thử xác nhận
                    if (paymentIntent.status === 'requires_confirmation') {
                        try {
                            const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId);
                            if (confirmedIntent.status !== 'succeeded') {
                                return responseReturn(res, 400, {
                                    message: 'Không thể xác nhận thanh toán',
                                    success: false,
                                    paymentStatus: confirmedIntent.status
                                });
                            }
                        } catch (confirmError) {
                            console.error('Payment confirmation error:', confirmError);
                            return responseReturn(res, 400, {
                                message: 'Lỗi khi xác nhận thanh toán',
                                success: false,
                                error: confirmError.message
                            });
                        }
                    } else {
                        return responseReturn(res, 400, {
                            message: 'Thanh toán chưa được xác nhận',
                            success: false,
                            paymentStatus: paymentIntent.status
                        });
                    }
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
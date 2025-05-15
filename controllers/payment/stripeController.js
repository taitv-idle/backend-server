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

            // Validate input
            if (!price || !orderId) {
                return responseReturn(res, 400, {
                    message: 'Thiếu thông tin bắt buộc: giá hoặc mã đơn hàng'
                });
            }

            // Kiểm tra đơn hàng
            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, {
                    message: 'Đơn hàng không tồn tại'
                });
            }

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                return responseReturn(res, 400, {
                    message: 'Đơn hàng đã được thanh toán'
                });
            }

            // Tạo payment intent (sử dụng VND)
            // VND là smallest unit - không cần nhân với 100 như USD
            const amount = Math.round(price);
            
            console.log('Creating payment intent:', {
                amount,
                orderId,
                customerId: order.customerId.toString()
            });

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'vnd',
                metadata: { 
                    orderId,
                    customerId: order.customerId.toString()
                },
                description: `Thanh toán cho đơn hàng #${orderId}`,
                payment_method_types: ['card'],
                capture_method: 'automatic'
            });

            responseReturn(res, 200, {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            });
        } catch (error) {
            console.error('Create payment intent error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi tạo payment intent'
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

            // Validate input
            if (!orderId || !paymentIntentId) {
                return responseReturn(res, 400, {
                    message: 'Thiếu thông tin bắt buộc: orderId hoặc paymentIntentId'
                });
            }

            // Kiểm tra đơn hàng
            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                return responseReturn(res, 404, {
                    message: 'Đơn hàng không tồn tại'
                });
            }

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                return responseReturn(res, 400, {
                    message: 'Đơn hàng đã được thanh toán'
                });
            }

            // Xác minh payment intent
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            console.log('Payment intent status:', paymentIntent.status);
            
            if (paymentIntent.status !== 'succeeded') {
                return responseReturn(res, 400, {
                    message: 'Thanh toán chưa được xác nhận'
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

            responseReturn(res, 200, {
                message: 'Xác nhận thanh toán thành công',
                order
            });

        } catch (error) {
            await session.abortTransaction();
            console.error('Confirm payment error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xác nhận thanh toán'
            });
        } finally {
            session.endSession();
        }
    }

    // Xử lý webhook
    handle_webhook = async (req, res) => {
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!endpointSecret) {
            console.error('Stripe webhook secret is not configured');
            return responseReturn(res, 500, {
                message: 'Webhook secret không được cấu hình'
            });
        }

        let event;
        try {
            // Kiểm tra chữ ký webhook
            event = stripe.webhooks.constructEvent(
                req.rawBody, // Đảm bảo middleware đã lưu raw body
                sig,
                endpointSecret
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            return responseReturn(res, 400, {
                message: `Webhook Error: ${err.message}`
            });
        }

        try {
            // Xử lý sự kiện thanh toán thành công
            if (event.type === 'payment_intent.succeeded') {
                const paymentIntent = event.data.object;
                const orderId = paymentIntent.metadata.orderId;
                const paymentIntentId = paymentIntent.id;

                if (!orderId) {
                    console.error('Missing orderId in payment intent metadata');
                    return responseReturn(res, 400, {
                        message: 'Thiếu orderId trong metadata'
                    });
                }

                console.log(`Đã nhận webhook thanh toán thành công cho đơn hàng ${orderId}`);

                // Tạo request và response giả để gọi hàm confirm_payment
                const mockReq = {
                    params: { orderId },
                    body: { paymentIntentId }
                };
                
                const mockRes = {
                    status: (code) => ({
                        json: (data) => {
                            console.log(`Kết quả xác nhận thanh toán: ${code}`, data);
                        }
                    })
                };

                // Gọi hàm xác nhận thanh toán
                await this.confirm_payment(mockReq, mockRes);
            }

            // Phản hồi cho Stripe biết rằng đã nhận webhook
            return responseReturn(res, 200, { received: true });
        } catch (error) {
            console.error('Webhook processing error:', error);
            return responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xử lý webhook'
            });
        }
    }
}

module.exports = new StripeController(); 
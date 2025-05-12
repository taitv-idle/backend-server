const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { responseReturn } = require('../../utils/response');
const customerOrder = require('../../models/customerOrder');
const authOrderModel = require('../../models/authOrder');
const myShopWallet = require('../../models/myShopWallet');
const sellerWallet = require('../../models/sellerWallet');
const moment = require('moment');
const { mongo: { ObjectId } } = require('mongoose');

class StripeController {
    // Tạo payment intent
    create_payment_intent = async (req, res) => {
        try {
            const { price, orderId } = req.body;

            // Validate input
            if (!price || !orderId) {
                throw new Error('Thiếu thông tin bắt buộc');
            }

            // Kiểm tra đơn hàng
            const order = await customerOrder.findById(orderId);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                throw new Error('Đơn hàng đã được thanh toán');
            }

            // Tạo payment intent (sử dụng VND)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(price * 1000), // Chuyển sang VND
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
                throw new Error('Thiếu thông tin bắt buộc');
            }

            // Kiểm tra đơn hàng
            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                throw new Error('Đơn hàng đã được thanh toán');
            }

            // Xác minh payment intent
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (paymentIntent.status !== 'succeeded') {
                throw new Error('Thanh toán chưa được xác nhận');
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

        let event;
        try {
            event = stripe.webhooks.constructEvent(
                req.body,
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

                if (orderId) {
                    // Xác nhận thanh toán trong hệ thống
                    await this.confirm_payment({ params: { orderId }, body: { paymentIntentId: paymentIntent.id } }, res);
                    console.log(`Xác nhận thanh toán thành công cho đơn hàng ${orderId}`);
                }
            }

            responseReturn(res, 200, { received: true });
        } catch (error) {
            console.error('Webhook processing error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xử lý webhook'
            });
        }
    }
}

module.exports = new StripeController(); 
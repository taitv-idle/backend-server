const mongoose = require('mongoose');
const authOrderModel = require('../../models/authOrder')
const customerOrder = require('../../models/customerOrder')
const myShopWallet = require('../../models/myShopWallet')
const sellerWallet = require('../../models/sellerWallet')
const cardModel = require('../../models/cardModel')
const productModel = require('../../models/productModel')
const moment = require("moment")
const { responseReturn } = require('../../utiles/response')
const { mongo: {ObjectId}} = require('mongoose')
const {config} = require("dotenv");
const { validatePhoneNumber } = require('../../utiles/validators');
// Cấu hình Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

// Controller xử lý các nghiệp vụ liên quan đến đơn hàng
class orderController{
    // Hàm hỗ trợ: Gửi thông báo hủy đơn hàng
    async sendOrderCancellationNotification(customerId, orderId) {
        // Triển khai logic gửi thông báo (email, notification, etc.)
        console.log(`Đã gửi thông báo hủy đơn hàng #${orderId} cho khách hàng ${customerId}`);
    }
    // Hàm hỗ trợ: Kiểm tra và hủy đơn hàng nếu chưa thanh toán
    async paymentCheck(id) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const order = await customerOrder.findById(id).session(session);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            if (order.payment_status === 'unpaid') {
                await customerOrder.findByIdAndUpdate(id, {
                    delivery_status: 'cancelled',
                    cancellation_reason: 'Không thanh toán trong thời gian quy định'
                }, { session });

                await authOrderModel.updateMany({
                    orderId: id
                }, {
                    delivery_status: 'cancelled',
                    cancellation_reason: 'Không thanh toán trong thời gian quy định'
                }, { session });

                await this.sendOrderCancellationNotification(order.customerId, id);
            }

            await session.commitTransaction();
            return true;
        } catch (error) {
            await session.abortTransaction();
            console.error('Payment check error:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }


    // Đặt hàng
    place_order = async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const { price, products, shipping_fee, shippingInfo, userId, paymentMethod } = req.body;
            
            // Debug logging
            console.log('Request body:', {
                price,
                products,
                shipping_fee,
                shippingInfo,
                userId,
                paymentMethod
            });

            const tempDate = moment(Date.now()).format('LLL');

            // Validate input with detailed messages
            const missingFields = [];
            if (!price) missingFields.push('price');
            if (!products) missingFields.push('products');
            if (!shippingInfo) missingFields.push('shippingInfo');
            if (!userId) missingFields.push('userId');
            if (!paymentMethod) missingFields.push('paymentMethod');

            if (missingFields.length > 0) {
                throw new Error(`Thiếu các trường bắt buộc: ${missingFields.join(', ')}`);
            }

            // Validate shipping info
            const requiredShippingFields = ['name', 'phone', 'address', 'province', 'city', 'area'];
            const missingShippingFields = requiredShippingFields.filter(field => !shippingInfo[field]);
            if (missingShippingFields.length > 0) {
                throw new Error(`Thiếu thông tin địa chỉ giao hàng: ${missingShippingFields.join(', ')}`);
            }

            // Validate phone number
            if (!validatePhoneNumber(shippingInfo.phone)) {
                throw new Error('Số điện thoại không hợp lệ');
            }

            // Validate payment method
            if (!['cod', 'stripe'].includes(paymentMethod)) {
                throw new Error('Phương thức thanh toán không hợp lệ');
            }

            // Validate products array
            if (!Array.isArray(products) || products.length === 0) {
                throw new Error('Danh sách sản phẩm không hợp lệ');
            }

            let authorOrderData = [];
            let cardId = [];
            let customerOrderProduct = [];

            // Lấy thông tin seller từ sản phẩm đầu tiên
            const firstProduct = await productModel.findById(products[0].productId);
            if (!firstProduct) {
                throw new Error('Không tìm thấy thông tin sản phẩm');
            }

            const sellerId = firstProduct.sellerId;

            // Xử lý danh sách sản phẩm theo cấu trúc mới
            for (const product of products) {
                const productInfo = {
                    productId: product.productId,
                    quantity: product.quantity,
                    price: product.price,
                    discount: product.discount
                };
                customerOrderProduct.push(productInfo);
                if (product._id) cardId.push(product._id);
            }

            // Tạo đơn hàng chính
            const order = await customerOrder.create([{
                customerId: userId,
                shippingAddress: {
                    name: shippingInfo.name,
                    phone: shippingInfo.phone,
                    address: shippingInfo.address,
                    province: shippingInfo.province,
                    city: shippingInfo.city,
                    area: shippingInfo.area,
                    post: shippingInfo.post || ''
                },
                products: customerOrderProduct,
                price: price + (shipping_fee || 0),
                payment_status: paymentMethod === 'cod' ? 'pending' : 'unpaid',
                delivery_status: 'pending',
                payment_method: paymentMethod,
                date: tempDate
            }], { session });

            // Tạo đơn hàng cho seller
            authorOrderData.push({
                orderId: order[0].id,
                sellerId: sellerId,
                products: customerOrderProduct,
                price: price,
                payment_status: paymentMethod === 'cod' ? 'pending' : 'unpaid',
                shippingAddress: {
                    name: shippingInfo.name,
                    phone: shippingInfo.phone,
                    address: shippingInfo.address,
                    province: shippingInfo.province,
                    city: shippingInfo.city,
                    area: shippingInfo.area,
                    post: shippingInfo.post || ''
                },
                delivery_status: 'pending',
                payment_method: paymentMethod,
                date: tempDate
            });

            await authOrderModel.insertMany(authorOrderData, { session });

            // Xóa sản phẩm khỏi giỏ hàng
            if (cardId.length > 0) {
                await cardModel.deleteMany({ _id: { $in: cardId } }, { session });
            }

            await session.commitTransaction();

            // Nếu là COD, xác nhận ngay
            if (paymentMethod === 'cod') {
                await this.confirmPayment(order[0].id, 'cod');
            } else {
                // Stripe - đặt hẹn kiểm tra thanh toán sau 15 phút
                setTimeout(() => this.paymentCheck(order[0].id), 900000); // 15 phút
            }

            responseReturn(res, 200, {
                message: "Đặt hàng thành công",
                orderId: order[0].id,
                paymentMethod
            });

        } catch (error) {
            await session.abortTransaction();
            console.error('Place order error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi đặt hàng'
            });
        } finally {
            session.endSession();
        }
    }
// Xác nhận thanh toán COD
    confirm_cod_payment = async (req, res) => {
        try {
            const order = await this.confirmPayment(req.params.orderId, 'cod');
            responseReturn(res, 200, {
                message: 'Xác nhận thanh toán COD thành công',
                order
            });
        } catch (error) {
            console.error('Confirm COD error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xác nhận thanh toán COD'
            });
        }
    }

    // Xác nhận thanh toán Stripe
    confirm_stripe_payment = async (req, res) => {
        try {
            const { orderId } = req.params;
            const order = await this.confirmPayment(orderId, 'stripe');
            responseReturn(res, 200, {
                message: 'Xác nhận thanh toán Stripe thành công',
                order
            });
        } catch (error) {
            console.error('Confirm Stripe error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xác nhận thanh toán Stripe'
            });
        }
    }

    // Tạo payment intent cho Stripe
    create_payment_intent = async (req, res) => {
        try {
            const { price, orderId } = req.body;

            // Validate
            if (!price || !orderId) {
                throw new Error('Thiếu thông tin bắt buộc');
            }

            const order = await customerOrder.findById(orderId);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            // Convert price to smallest currency unit (cents)
            // For VND, we multiply by 1 since 1 VND is already the smallest unit
            const amount = Math.round(price);
            
            // Log the amount for debugging
            console.log('Payment amount:', {
                originalPrice: price,
                convertedAmount: amount,
                currency: 'vnd'
            });

            // Tạo payment intent (sử dụng VND)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'vnd',
                metadata: { orderId },
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


    // Xử lý Stripe webhook
    handle_stripe_webhook = async (req, res) => {
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
                    await this.confirmPayment(orderId, 'stripe');
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

    // Lấy dữ liệu dashboard của khách hàng
    get_customer_dashboard_data = async (req, res) => {
        const { userId } = req.params

        try {
            const recentOrders = await customerOrder.find({
                customerId: new ObjectId(userId)
            }).limit(5)

            const pendingOrder = await customerOrder.find({
                customerId: new ObjectId(userId),
                delivery_status: 'pending'
            }).countDocuments()

            const totalOrder = await customerOrder.find({
                customerId: new ObjectId(userId)
            }).countDocuments()

            const cancelledOrder = await customerOrder.find({
                customerId: new ObjectId(userId),
                delivery_status: 'cancelled'
            }).countDocuments()

            responseReturn(res, 200, {
                recentOrders,
                pendingOrder,
                totalOrder,
                cancelledOrder
            })

        } catch (error) {
            console.log(error.message)
        }
    }

    // Lấy danh sách đơn hàng của khách hàng
    get_orders = async (req, res) => {
        const { customerId, status } = req.params

        try {
            let orders = []
            if (status !== 'all') {
                orders = await customerOrder.find({
                    customerId: new ObjectId(customerId),
                    delivery_status: status
                })
            } else {
                orders = await customerOrder.find({
                    customerId: new ObjectId(customerId)
                })
            }
            responseReturn(res, 200, { orders })

        } catch (error) {
            console.log(error.message)
        }
    }

    // Chi tiết đơn hàng của khách hàng
    get_order_details = async (req, res) => {
        const { orderId } = req.params
        try {
            const order = await customerOrder.findById(orderId)
            responseReturn(res, 200, { order })
        } catch (error) {
            console.log(error.message)
        }
    }

    // Quản trị: lấy danh sách đơn hàng (phân trang)
    get_admin_orders = async (req, res) => {
        let { page, searchValue, parPage } = req.query
        page = parseInt(page)
        parPage = parseInt(parPage)
        const skipPage = parPage * (page - 1)

        try {
            if (searchValue) {
                // Bạn có thể thêm logic tìm kiếm tại đây
            } else {
                const orders = await customerOrder.aggregate([
                    {
                        $lookup: {
                            from: 'authororders',
                            localField: "_id",
                            foreignField: 'orderId',
                            as: 'suborder'
                        }
                    }
                ]).skip(skipPage).limit(parPage).sort({ createdAt: -1 })

                const totalOrder = await customerOrder.aggregate([
                    {
                        $lookup: {
                            from: 'authororders',
                            localField: "_id",
                            foreignField: 'orderId',
                            as: 'suborder'
                        }
                    }
                ])

                responseReturn(res, 200, { orders, totalOrder: totalOrder.length })
            }
        } catch (error) {
            console.log(error.message)
        }
    }

    // Quản trị: chi tiết đơn hàng
    get_admin_order = async (req, res) => {
        const { orderId } = req.params
        try {
            const order = await customerOrder.aggregate([
                {
                    $match: { _id: new ObjectId(orderId) }
                },
                {
                    $lookup: {
                        from: 'authororders',
                        localField: "_id",
                        foreignField: 'orderId',
                        as: 'suborder'
                    }
                }
            ])
            responseReturn(res, 200, { order: order[0] })
        } catch (error) {
            console.log('Lỗi lấy chi tiết đơn hàng admin: ' + error.message)
        }
    }

    // Quản trị: cập nhật trạng thái đơn hàng
    admin_order_status_update = async (req, res) => {
        const { orderId } = req.params
        const { status } = req.body

        try {
            await customerOrder.findByIdAndUpdate(orderId, {
                delivery_status: status
            })
            responseReturn(res, 200, { message: 'Cập nhật trạng thái đơn hàng thành công' })
        } catch (error) {
            console.log('Lỗi cập nhật trạng thái đơn hàng: ' + error.message)
            responseReturn(res, 500, { message: 'Lỗi máy chủ' })
        }
    }

    // Người bán: lấy danh sách đơn hàng
    get_seller_orders = async (req, res) => {
        const { sellerId } = req.params;
        let { page, searchValue, parPage, status } = req.query;

        page = parseInt(page) || 1;
        parPage = parseInt(parPage) || 10;
        const skipPage = parPage * (page - 1);

        try {
            let query = { sellerId };

            if (searchValue) {
                query.$or = [
                    { 'products.name': { $regex: searchValue, $options: 'i' } },
                    { orderId: { $regex: searchValue, $options: 'i' } }
                ];
            }

            if (status && status !== 'all') {
                query.delivery_status = status;
            }

            const orders = await authOrderModel.find(query)
                .skip(skipPage)
                .limit(parPage)
                .sort({ createdAt: -1 });

            const totalOrder = await authOrderModel.countDocuments(query);

            responseReturn(res, 200, {
                success: true,
                orders,
                totalOrder
            });

        } catch (error) {
            console.log('Lỗi lấy đơn hàng người bán: ' + error.message);
            responseReturn(res, 500, {
                success: false,
                message: 'Lỗi máy chủ khi lấy đơn hàng'
            });
        }
    }

    // Người bán: chi tiết đơn hàng
    get_seller_order = async (req, res) => {
        const { orderId } = req.params
        try {
            const order = await authOrderModel.findById(orderId)
            responseReturn(res, 200, { order })
        } catch (error) {
            console.log('Lỗi chi tiết đơn hàng người bán: ' + error.message)
        }
    }

    // Người bán: cập nhật trạng thái đơn hàng
    seller_order_status_update = async (req, res) => {
        const { orderId } = req.params
        const { status } = req.body

        try {
            await authOrderModel.findByIdAndUpdate(orderId, {
                delivery_status: status
            })
            responseReturn(res, 200, { message: 'Cập nhật trạng thái đơn hàng thành công' })
        } catch (error) {
            console.log('Lỗi cập nhật trạng thái người bán: ' + error.message)
            responseReturn(res, 500, { message: 'Lỗi máy chủ' })
        }
    }

    // Tạo thanh toán Stripe
    create_payment = async (req, res) => {
        const { price } = req.body
        try {
            const payment = await stripe.paymentIntents.create({
                amount: price * 100,
                currency: 'usd',
                automatic_payment_methods: {
                    enabled: true
                }
            })
            responseReturn(res, 200, { clientSecret: payment.client_secret })
        } catch (error) {
            console.log(error.message)
        }
    }

    // Xác nhận đơn hàng sau khi thanh toán
    order_confirm = async (req, res) => {
        const { orderId } = req.params
        try {
            await customerOrder.findByIdAndUpdate(orderId, { payment_status: 'paid' })
            await authOrderModel.updateMany({ orderId: new ObjectId(orderId) }, {
                payment_status: 'paid',
                delivery_status: 'pending'
            })

            const cuOrder = await customerOrder.findById(orderId)
            const auOrder = await authOrderModel.find({ orderId: new ObjectId(orderId) })

            const time = moment(Date.now()).format('l')
            const splitTime = time.split('/')

            await myShopWallet.create({
                amount: cuOrder.price,
                month: splitTime[0],
                year: splitTime[2]
            })

            for (let i = 0; i < auOrder.length; i++) {
                await sellerWallet.create({
                    sellerId: auOrder[i].sellerId.toString(),
                    amount: auOrder[i].price,
                    month: splitTime[0],
                    year: splitTime[2]
                })
            }

            responseReturn(res, 200, { message: 'Thành công' })

        } catch (error) {
            console.log(error.message)
        }
    }
    // Hàm hỗ trợ: Xác nhận thanh toán chung
    async confirmPayment(orderId, paymentMethod) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            // Cập nhật trạng thái đơn hàng
            await customerOrder.findByIdAndUpdate(orderId, {
                payment_status: 'paid',
                delivery_status: 'processing',
                payment_method: paymentMethod
            }, { session });

            await authOrderModel.updateMany(
                { orderId: new ObjectId(orderId) },
                {
                    payment_status: 'paid',
                    delivery_status: 'processing',
                    payment_method: paymentMethod
                },
                { session }
            );

            // Cập nhật ví nếu là thanh toán online
            if (paymentMethod === 'stripe') {
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
            }

            await session.commitTransaction();
            return order;
        } catch (error) {
            await session.abortTransaction();
            console.error(`Confirm ${paymentMethod} payment error:`, error);
            throw error;
        } finally {
            session.endSession();
        }
    }

}

module.exports = new orderController()

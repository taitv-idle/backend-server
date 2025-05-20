const mongoose = require('mongoose');
const authOrderModel = require('../../models/authOrder')
const customerOrder = require('../../models/customerOrder')
const myShopWallet = require('../../models/myShopWallet')
const sellerWallet = require('../../models/sellerWallet')
const cardModel = require('../../models/cardModel')
const productModel = require('../../models/productModel')
const moment = require("moment")
const { responseReturn } = require('../../utils/response')
const { mongo: {ObjectId}} = require('mongoose')
const {config} = require("dotenv");
const { validatePhoneNumber } = require('../../utils/validators');
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

            const orderStatuses = this.getOrderStatuses();
            const paymentStatuses = this.getPaymentStatuses();

            const order = await customerOrder.findById(id).session(session);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            if (order.payment_status === paymentStatuses.unpaid.id) {
                await customerOrder.findByIdAndUpdate(id, {
                    delivery_status: orderStatuses.cancelled.id,
                    cancellation_reason: 'Không thanh toán trong thời gian quy định'
                }, { session });

                await authOrderModel.updateMany({
                    orderId: id
                }, {
                    delivery_status: orderStatuses.cancelled.id,
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

            const { price, products, shippingInfo, userId, paymentMethod } = req.body;
            
            // Debug logging
            console.log('Request body:', {
                price,
                products,
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

            // Kiểm tra số lượng sản phẩm trong kho
            for (const product of products) {
                const productDoc = await productModel.findById(product.productId).session(session);
                if (!productDoc) {
                    throw new Error(`Không tìm thấy sản phẩm với ID: ${product.productId}`);
                }
                
                if (productDoc.stock < product.quantity) {
                    throw new Error(`Sản phẩm ${productDoc.name} không đủ số lượng trong kho (Còn ${productDoc.stock}, cần ${product.quantity})`);
                }
            }

            // Lấy các trạng thái
            const orderStatuses = this.getOrderStatuses();
            const paymentStatuses = this.getPaymentStatuses();

            // Tính phí vận chuyển
            const shipping_fee = price >= 500000 ? 0 : 40000;
            const totalPrice = price + shipping_fee;

            let authorOrderData = [];
            let cardId = [];
            let customerOrderProduct = [];

            // Nhóm sản phẩm theo người bán
            const productsBySeller = {};
            
            for (const product of products) {
                // Lấy thông tin sản phẩm bao gồm người bán
                const productDoc = await productModel.findById(product.productId).session(session);
                if (!productDoc) {
                    throw new Error(`Không tìm thấy sản phẩm với ID: ${product.productId}`);
                }
                
                const sellerId = productDoc.sellerId.toString();
                const productInfo = {
                    productId: product.productId,
                    quantity: product.quantity,
                    price: product.price,
                    discount: product.discount
                };
                
                // Thêm vào danh sách sản phẩm của đơn hàng chính
                customerOrderProduct.push(productInfo);
                
                // Nhóm theo người bán
                if (!productsBySeller[sellerId]) {
                    productsBySeller[sellerId] = {
                        sellerId: sellerId,
                        shopName: productDoc.shopName || 'Shop',
                        products: [],
                        price: 0
                    };
                }
                
                productsBySeller[sellerId].products.push(productInfo);
                productsBySeller[sellerId].price += product.price * product.quantity;
                
                // Lưu ID giỏ hàng nếu có để xóa sau khi đặt hàng
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
                price: totalPrice,
                shipping_fee: shipping_fee,
                payment_status: paymentMethod === 'cod' ? paymentStatuses.pending.id : paymentStatuses.unpaid.id,
                delivery_status: orderStatuses.pending.id,
                payment_method: paymentMethod,
                date: tempDate
            }], { session });
            
            // Tạo đơn hàng con cho từng người bán
            for (const sellerId in productsBySeller) {
                // Phân bổ phí vận chuyển cho mỗi người bán (hoặc có thể tính riêng)
                const sellerShippingFee = shipping_fee / Object.keys(productsBySeller).length;
                
                authorOrderData.push({
                    orderId: order[0].id,
                    sellerId: new ObjectId(sellerId),
                    products: productsBySeller[sellerId].products,
                    price: productsBySeller[sellerId].price,
                    shipping_fee: sellerShippingFee,
                    payment_status: paymentMethod === 'cod' ? paymentStatuses.pending.id : paymentStatuses.unpaid.id,
                    shippingAddress: {
                        name: shippingInfo.name,
                        phone: shippingInfo.phone,
                        address: shippingInfo.address,
                        province: shippingInfo.province,
                        city: shippingInfo.city,
                        area: shippingInfo.area,
                        post: shippingInfo.post || ''
                    },
                    delivery_status: orderStatuses.pending.id,
                    payment_method: paymentMethod,
                    date: tempDate
                });
            }

            await authOrderModel.insertMany(authorOrderData, { session });

            // Xóa sản phẩm khỏi giỏ hàng
            if (cardId.length > 0) {
                await cardModel.deleteMany({ _id: { $in: cardId } }, { session });
            }

            await session.commitTransaction();

            // Nếu là COD, xác nhận ngay
            if (paymentMethod === 'cod') {
                await this.processCodOrder(order[0].id);
            } else {
                // Stripe - đặt hẹn kiểm tra thanh toán sau 15 phút
                setTimeout(() => this.paymentCheck(order[0].id), 900000); // 15 phút
            }

            responseReturn(res, 200, {
                message: "Đặt hàng thành công",
                orderId: order[0].id,
                paymentMethod,
                shipping_fee,
                totalPrice
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
                return responseReturn(res, 400, {
                    message: 'Thiếu thông tin bắt buộc: giá hoặc mã đơn hàng',
                    success: false
                });
            }

            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, {
                    message: 'Đơn hàng không tồn tại',
                    success: false
                });
            }

            if (order.payment_status === 'paid') {
                return responseReturn(res, 400, {
                    message: 'Đơn hàng đã được thanh toán',
                    success: false
                });
            }

            // Kiểm tra giá tiền
            const amount = Math.round(price);
            
            console.log('Creating payment intent:', {
                amount,
                orderId,
                customerId: order.customerId.toString()
            });

            // Tạo payment intent (sử dụng VND)
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
                paymentIntentId: paymentIntent.id,
                success: true
            });
        } catch (error) {
            console.error('Create payment intent error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi tạo payment intent',
                success: false
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
            }).limit(5);

            // Get all product IDs from recent orders
            const productIds = recentOrders.flatMap(order => order.products.map(p => p.productId));

            // Get all products in one query
            const products = await productModel.find({ _id: { $in: productIds } });

            // Create a map of products for easy lookup
            const productMap = products.reduce((map, product) => {
                map[product._id.toString()] = product;
                return map;
            }, {});

            // Format orders with product details
            const formattedRecentOrders = recentOrders.map(order => ({
                ...order.toObject(),
                products: order.products.map(product => ({
                    ...product,
                    productId: {
                        _id: product.productId,
                        name: productMap[product.productId.toString()]?.name,
                        brand: productMap[product.productId.toString()]?.brand,
                        images: productMap[product.productId.toString()]?.images,
                        price: product.price,
                        quantity: product.quantity,
                        discount: product.discount
                    }
                }))
            }));

            const pendingOrder = await customerOrder.find({
                customerId: new ObjectId(userId),
                delivery_status: 'pending'
            }).countDocuments();

            const totalOrder = await customerOrder.find({
                customerId: new ObjectId(userId)
            }).countDocuments();

            const cancelledOrder = await customerOrder.find({
                customerId: new ObjectId(userId),
                delivery_status: 'cancelled'
            }).countDocuments();

            responseReturn(res, 200, {
                recentOrders: formattedRecentOrders,
                pendingOrder,
                totalOrder,
                cancelledOrder
            });

        } catch (error) {
            console.log('Lỗi lấy dữ liệu dashboard khách hàng:', error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ khi lấy dữ liệu dashboard' });
        }
    }

    // Lấy danh sách đơn hàng của khách hàng
    get_orders = async (req, res) => {
        const { customerId, status } = req.params;

        try {
            let query = { customerId: new ObjectId(customerId) };
            if (status !== 'all') {
                query.delivery_status = status;
            }

            const orders = await customerOrder.find(query);

            // Get all product IDs from all orders
            const productIds = orders.flatMap(order => order.products.map(p => p.productId));

            // Get all products in one query
            const products = await productModel.find({ _id: { $in: productIds } });

            // Create a map of products for easy lookup
            const productMap = products.reduce((map, product) => {
                map[product._id.toString()] = product;
                return map;
            }, {});

            // Format orders with product details
            const formattedOrders = orders.map(order => ({
                ...order.toObject(),
                products: order.products.map(product => ({
                    ...product,
                    productId: {
                        _id: product.productId,
                        name: productMap[product.productId.toString()]?.name,
                        brand: productMap[product.productId.toString()]?.brand,
                        images: productMap[product.productId.toString()]?.images,
                        price: product.price,
                        quantity: product.quantity,
                        discount: product.discount
                    }
                }))
            }));

            responseReturn(res, 200, { orders: formattedOrders });

        } catch (error) {
            console.log('Lỗi lấy danh sách đơn hàng khách hàng:', error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ khi lấy danh sách đơn hàng' });
        }
    }

    // Chi tiết đơn hàng của khách hàng
    get_order_details = async (req, res) => {
        const { orderId } = req.params;
        try {
            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, { message: 'Không tìm thấy đơn hàng' });
            }

            // Get all product IDs from the order
            const productIds = order.products.map(p => p.productId);

            // Get all products in one query
            const products = await productModel.find({ _id: { $in: productIds } });

            // Create a map of products for easy lookup
            const productMap = products.reduce((map, product) => {
                map[product._id.toString()] = product;
                return map;
            }, {});

            // Format the order with product details
            const formattedOrder = {
                ...order.toObject(),
                products: order.products.map(product => ({
                    ...product,
                    productId: {
                        _id: product.productId,
                        name: productMap[product.productId.toString()]?.name,
                        brand: productMap[product.productId.toString()]?.brand,
                        images: productMap[product.productId.toString()]?.images,
                        price: product.price,
                        quantity: product.quantity,
                        discount: product.discount
                    }
                }))
            };

            // Debug log
            console.log('Customer order product map:', JSON.stringify(productMap, null, 2));
            console.log('Formatted customer order:', JSON.stringify(formattedOrder, null, 2));
            console.log('First product details:', JSON.stringify(formattedOrder.products[0]?.productId, null, 2));

            responseReturn(res, 200, { order: formattedOrder });
        } catch (error) {
            console.log('Lỗi lấy chi tiết đơn hàng khách hàng:', error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ khi lấy chi tiết đơn hàng' });
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
            // First get the order with basic information
            const order = await customerOrder.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, { message: 'Không tìm thấy đơn hàng' });
            }

            // Get suborders
            const suborders = await authOrderModel.find({ orderId: order._id });

            // Get all product IDs from both order and suborders
            const productIds = [
                ...order.products.map(p => p.productId),
                ...suborders.flatMap(so => so.products.map(p => p.productId))
            ];

            // Get all products in one query
            const products = await productModel.find({ _id: { $in: productIds } });

            // Create a map of products for easy lookup
            const productMap = products.reduce((map, product) => {
                map[product._id.toString()] = product;
                return map;
            }, {});

            // Format the order with product details
            const formattedOrder = {
                ...order.toObject(),
                products: order.products.map(product => ({
                    ...product,
                    productId: {
                        _id: product.productId,
                        name: productMap[product.productId.toString()]?.name,
                        brand: productMap[product.productId.toString()]?.brand,
                        images: productMap[product.productId.toString()]?.images,
                        price: product.price,
                        quantity: product.quantity,
                        discount: product.discount
                    }
                })),
                suborder: suborders.map(suborder => ({
                    ...suborder.toObject(),
                    products: suborder.products.map(product => ({
                        ...product,
                        productId: {
                            _id: product.productId,
                            name: productMap[product.productId.toString()]?.name,
                            brand: productMap[product.productId.toString()]?.brand,
                            images: productMap[product.productId.toString()]?.images,
                            price: product.price,
                            quantity: product.quantity,
                            discount: product.discount
                        }
                    }))
                }))
            };

            // Debug log
            console.log('Product map:', JSON.stringify(productMap, null, 2));
            console.log('Formatted order:', JSON.stringify(formattedOrder, null, 2));
            console.log('First product details:', JSON.stringify(formattedOrder.products[0]?.productId, null, 2));

            responseReturn(res, 200, { order: formattedOrder });
        } catch (error) {
            console.log('Lỗi lấy chi tiết đơn hàng admin: ' + error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ khi lấy chi tiết đơn hàng' });
        }
    }

    // Quản trị: cập nhật trạng thái đơn hàng
    admin_order_status_update = async (req, res) => {
        const { orderId } = req.params
        const { status } = req.body
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const orderStatuses = this.getOrderStatuses();
            const paymentStatuses = this.getPaymentStatuses();

            // Kiểm tra trạng thái hợp lệ
            if (!orderStatuses[status]) {
                throw new Error('Trạng thái đơn hàng không hợp lệ');
            }

            // Lấy thông tin đơn hàng trước khi cập nhật
            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                throw new Error('Không tìm thấy đơn hàng');
            }

            // Cập nhật trạng thái đơn hàng
            await customerOrder.findByIdAndUpdate(orderId, {
                delivery_status: status
            }, { session });

            // Nếu đơn hàng bị hủy và đã thanh toán, hoàn lại số lượng sản phẩm trong kho
            if (status === orderStatuses.cancelled.id && order.payment_status === paymentStatuses.paid.id) {
                for (const product of order.products) {
                    await productModel.findByIdAndUpdate(
                        product.productId,
                        { 
                            $inc: { 
                                stock: product.quantity,
                                sold: -product.quantity 
                            } 
                        },
                        { session }
                    );
                    console.log(`Đã hoàn trả sản phẩm ${product.productId}: tăng ${product.quantity} đơn vị stock, giảm ${product.quantity} đơn vị sold`);
                }

                // Gửi thông báo hủy đơn hàng
                await this.sendOrderCancellationNotification(order.customerId, orderId);
            }

            // Nếu đơn hàng đã hoàn thành, cập nhật trạng thái đơn hàng
            if (status === orderStatuses.completed.id) {
                // Có thể thêm logic phát sinh khi đơn hàng hoàn thành ở đây
                console.log(`Đơn hàng ${orderId} đã hoàn thành`);
            }

            // Nếu đơn hàng đã hoàn trả, cập nhật lại số lượng sản phẩm
            if (status === orderStatuses.returned.id && order.payment_status === paymentStatuses.paid.id) {
                for (const product of order.products) {
                    await productModel.findByIdAndUpdate(
                        product.productId,
                        { 
                            $inc: { 
                                stock: product.quantity,
                                sold: -product.quantity 
                            } 
                        },
                        { session }
                    );
                    console.log(`Sản phẩm ${product.productId} đã hoàn trả: tăng ${product.quantity} đơn vị stock, giảm ${product.quantity} đơn vị sold`);
                }
                
                // Cập nhật trạng thái thanh toán thành hoàn tiền
                await customerOrder.findByIdAndUpdate(orderId, {
                    payment_status: paymentStatuses.refunded.id
                }, { session });
            }

            await session.commitTransaction();
            responseReturn(res, 200, { 
                message: 'Cập nhật trạng thái đơn hàng thành công',
                status: orderStatuses[status].name
            });
        } catch (error) {
            await session.abortTransaction();
            console.log('Lỗi cập nhật trạng thái đơn hàng: ' + error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ' });
        } finally {
            session.endSession();
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

            // Get orders with pagination
            const orders = await authOrderModel.find(query)
                .skip(skipPage)
                .limit(parPage)
                .sort({ createdAt: -1 });

            // Get all product IDs from all orders
            const productIds = orders.flatMap(order => order.products.map(p => p.productId));

            // Get all products in one query
            const products = await productModel.find({ _id: { $in: productIds } });

            // Create a map of products for easy lookup
            const productMap = products.reduce((map, product) => {
                map[product._id.toString()] = product;
                return map;
            }, {});

            // Format orders with product details
            const formattedOrders = orders.map(order => ({
                ...order.toObject(),
                products: order.products.map(product => ({
                    ...product,
                    productId: {
                        _id: product.productId,
                        name: productMap[product.productId.toString()]?.name,
                        brand: productMap[product.productId.toString()]?.brand,
                        images: productMap[product.productId.toString()]?.images,
                        price: product.price,
                        quantity: product.quantity,
                        discount: product.discount
                    }
                }))
            }));

            const totalOrder = await authOrderModel.countDocuments(query);

            responseReturn(res, 200, {
                success: true,
                orders: formattedOrders,
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
            // Get the seller order
            const order = await authOrderModel.findById(orderId);
            if (!order) {
                return responseReturn(res, 404, { message: 'Không tìm thấy đơn hàng' });
            }

            // Get all product IDs from the order
            const productIds = order.products.map(p => p.productId);

            // Get all products in one query
            const products = await productModel.find({ _id: { $in: productIds } });

            // Create a map of products for easy lookup
            const productMap = products.reduce((map, product) => {
                map[product._id.toString()] = product;
                return map;
            }, {});

            // Format the order with product details
            const formattedOrder = {
                ...order.toObject(),
                products: order.products.map(product => ({
                    ...product,
                    productId: {
                        _id: product.productId,
                        name: productMap[product.productId.toString()]?.name,
                        brand: productMap[product.productId.toString()]?.brand,
                        images: productMap[product.productId.toString()]?.images,
                        price: product.price,
                        quantity: product.quantity,
                        discount: product.discount
                    }
                }))
            };

            // Debug log
            console.log('Seller order product map:', JSON.stringify(productMap, null, 2));
            console.log('Formatted seller order:', JSON.stringify(formattedOrder, null, 2));
            console.log('First product details:', JSON.stringify(formattedOrder.products[0]?.productId, null, 2));

            responseReturn(res, 200, { order: formattedOrder });
        } catch (error) {
            console.log('Lỗi chi tiết đơn hàng người bán: ' + error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ khi lấy chi tiết đơn hàng' });
        }
    }

    // Người bán: cập nhật trạng thái đơn hàng
    seller_order_status_update = async (req, res) => {
        const { orderId } = req.params
        const { status, payment_status } = req.body
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const orderStatuses = this.getOrderStatuses();
            const paymentStatuses = this.getPaymentStatuses();

            const updateData = {};
            
            // Kiểm tra và cập nhật trạng thái giao hàng nếu có
            if (status) {
                if (!orderStatuses[status]) {
                    throw new Error('Trạng thái đơn hàng không hợp lệ');
                }
                updateData.delivery_status = status;
            }
            
            // Kiểm tra và cập nhật trạng thái thanh toán nếu có
            if (payment_status) {
                if (!paymentStatuses[payment_status]) {
                    throw new Error('Trạng thái thanh toán không hợp lệ');
                }
                updateData.payment_status = payment_status;
            }

            // Lấy thông tin đơn hàng của seller trước khi cập nhật
            const sellerOrder = await authOrderModel.findById(orderId).session(session);
            if (!sellerOrder) {
                throw new Error('Không tìm thấy đơn hàng');
            }

            // Cập nhật đơn hàng của seller
            await authOrderModel.findByIdAndUpdate(orderId, updateData, { session });

            // Cập nhật đơn hàng chính nếu cần
            if (sellerOrder) {
                await customerOrder.findByIdAndUpdate(sellerOrder.orderId, updateData, { session });
            }

            // Nếu đơn hàng bị hủy và đã thanh toán, hoàn lại số lượng sản phẩm trong kho
            if (status === orderStatuses.cancelled.id && sellerOrder.payment_status === paymentStatuses.paid.id) {
                for (const product of sellerOrder.products) {
                    await productModel.findByIdAndUpdate(
                        product.productId,
                        { 
                            $inc: { 
                                stock: product.quantity,
                                sold: -product.quantity 
                            } 
                        },
                        { session }
                    );
                    console.log(`Đã hoàn trả sản phẩm ${product.productId}: tăng ${product.quantity} đơn vị stock, giảm ${product.quantity} đơn vị sold`);
                }

                // Gửi thông báo hủy đơn hàng cho khách hàng
                if (sellerOrder.orderId) {
                    const customerOrderDoc = await customerOrder.findById(sellerOrder.orderId).session(session);
                    if (customerOrderDoc) {
                        await this.sendOrderCancellationNotification(customerOrderDoc.customerId, sellerOrder.orderId);
                    }
                }
            }

            // Nếu đơn hàng đã được đánh dấu là đang giao hàng
            if (status === orderStatuses.shipped.id) {
                // Có thể gửi thông báo cho khách hàng
                console.log(`Đơn hàng ${orderId} đang được giao`);
            }

            // Nếu đơn hàng đã hoàn trả
            if (status === orderStatuses.returned.id && sellerOrder.payment_status === paymentStatuses.paid.id) {
                for (const product of sellerOrder.products) {
                    await productModel.findByIdAndUpdate(
                        product.productId,
                        { 
                            $inc: { 
                                stock: product.quantity,
                                sold: -product.quantity 
                            } 
                        },
                        { session }
                    );
                    console.log(`Sản phẩm đã hoàn trả: ${product.productId}`);
                }
                
                // Cập nhật trạng thái thanh toán thành hoàn tiền
                const refundData = { payment_status: paymentStatuses.refunded.id };
                await authOrderModel.findByIdAndUpdate(orderId, refundData, { session });
                
                if (sellerOrder.orderId) {
                    await customerOrder.findByIdAndUpdate(sellerOrder.orderId, refundData, { session });
                }
            }

            await session.commitTransaction();
            responseReturn(res, 200, { 
                message: 'Cập nhật trạng thái đơn hàng thành công',
                updatedData: {
                    ...updateData,
                    statusName: status ? orderStatuses[status].name : undefined,
                    paymentStatusName: payment_status ? paymentStatuses[payment_status].name : undefined
                }
            });
        } catch (error) {
            await session.abortTransaction();
            console.log('Lỗi cập nhật trạng thái người bán: ' + error.message);
            responseReturn(res, 500, { message: 'Lỗi máy chủ' });
        } finally {
            session.endSession();
        }
    }

    // Xác nhận đơn hàng sau khi thanh toán (từ trang redirect)
    order_payment_success = async (req, res) => {
        try {
            const { payment_intent_client_secret } = req.query;
            
            if (!payment_intent_client_secret) {
                return responseReturn(res, 400, { 
                    message: 'Thiếu thông tin client secret',
                    success: false
                });
            }
            
            // Lấy payment intent từ client secret
            const clientSecret = payment_intent_client_secret;
            const paymentIntentId = clientSecret.split('_secret_')[0];
            
            console.log('Retrieving payment intent:', paymentIntentId);
            
            // Kiểm tra trạng thái thanh toán
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            
            if (paymentIntent.status !== 'succeeded') {
                return responseReturn(res, 400, {
                    message: 'Thanh toán chưa hoàn tất',
                    success: false,
                    paymentStatus: paymentIntent.status
                });
            }
            
            // Lấy orderId từ metadata
            const orderId = paymentIntent.metadata.orderId;
            if (!orderId) {
                return responseReturn(res, 400, {
                    message: 'Không tìm thấy thông tin đơn hàng',
                    success: false
                });
            }
            
            // Xác nhận thanh toán
            await this.confirmPayment(orderId, 'stripe');
            
            responseReturn(res, 200, {
                message: 'Thanh toán thành công',
                success: true,
                orderId
            });
            
        } catch (error) {
            console.error('Order payment success error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi xử lý xác nhận thanh toán',
                success: false
            });
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
    // Hàm hỗ trợ: Xác nhận thanh toán
    async confirmPayment(orderId, paymentMethod) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            const paymentStatuses = this.getPaymentStatuses();
            const orderStatuses = this.getOrderStatuses();

            if (order.payment_status === paymentStatuses.paid.id) {
                throw new Error('Đơn hàng đã được thanh toán');
            }

            // Cập nhật trạng thái đơn hàng chính
            await customerOrder.findByIdAndUpdate(orderId, {
                payment_status: paymentStatuses.paid.id,
                delivery_status: orderStatuses.processing.id,
                payment_method: paymentMethod
            }, { session });

            // Cập nhật trạng thái thanh toán cho tất cả đơn hàng con
            await authOrderModel.updateMany(
                { orderId: new ObjectId(orderId) },
                {
                    payment_status: paymentStatuses.paid.id,
                    delivery_status: orderStatuses.processing.id,
                    payment_method: paymentMethod
                },
                { session }
            );

            // Cập nhật ví của các người bán và ví cửa hàng
            const sellerOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) }).session(session);
            const time = moment(Date.now()).format('l');
            const splitTime = time.split('/');

            // Cập nhật ví của cửa hàng
            await myShopWallet.create({
                amount: order.price,
                month: splitTime[0],
                year: splitTime[2]
            }, { session });

            // Cập nhật ví cho từng người bán
            for (const sellerOrder of sellerOrders) {
                await sellerWallet.create({
                    sellerId: sellerOrder.sellerId.toString(),
                    amount: sellerOrder.price,
                    month: splitTime[0],
                    year: splitTime[2]
                }, { session });
            }

            // Cập nhật số lượng trong kho
            for (const sellerOrder of sellerOrders) {
                for (const product of sellerOrder.products) {
                    const productDoc = await productModel.findById(product.productId).session(session);
                    if (!productDoc) {
                        throw new Error(`Không tìm thấy sản phẩm với ID: ${product.productId}`);
                    }
                    
                    if (productDoc.stock < product.quantity) {
                        throw new Error(`Sản phẩm ${productDoc.name} không đủ số lượng trong kho`);
                    }
                    
                    await productModel.findByIdAndUpdate(
                        product.productId,
                        { 
                            $inc: { 
                                stock: -product.quantity,
                                sold: product.quantity
                            } 
                        },
                        { session }
                    );
                    
                    console.log(`Đã cập nhật sản phẩm ${product.productId}: giảm ${product.quantity} đơn vị stock, tăng ${product.quantity} đơn vị sold`);
                }
            }

            await session.commitTransaction();
            return order;

        } catch (error) {
            await session.abortTransaction();
            console.error('Confirm payment error:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    // Xác nhận thanh toán từ client (thay thế webhook)
    confirm_client_payment = async (req, res) => {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const { orderId } = req.params;
            const { paymentIntentId } = req.body;

            if (!orderId || !paymentIntentId) {
                return responseReturn(res, 400, {
                    message: 'Thiếu thông tin bắt buộc: orderId hoặc paymentIntentId',
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

            // Kiểm tra trạng thái thanh toán
            if (order.payment_status === 'paid') {
                return responseReturn(res, 200, {
                    message: 'Đơn hàng đã được thanh toán trước đó',
                    success: true,
                    order
                });
            }

            // Xác minh thanh toán với Stripe
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            console.log('Payment intent status:', paymentIntent.status);
            
            if (paymentIntent.status !== 'succeeded') {
                return responseReturn(res, 400, {
                    message: 'Thanh toán chưa được xác nhận',
                    success: false,
                    paymentStatus: paymentIntent.status
                });
            }

            // Xác nhận thanh toán trong hệ thống
            await this.confirmPayment(orderId, 'stripe');
            
            const updatedOrder = await customerOrder.findById(orderId);
            
            await session.commitTransaction();

            responseReturn(res, 200, {
                message: 'Xác nhận thanh toán thành công',
                success: true,
                order: updatedOrder
            });

        } catch (error) {
            await session.abortTransaction();
            console.error('Confirm client payment error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi xác nhận thanh toán',
                success: false
            });
        } finally {
            session.endSession();
        }
    }

    // Lấy danh sách trạng thái đơn hàng và thanh toán
    get_order_statuses = async (req, res) => {
        try {
            const orderStatuses = this.getOrderStatuses();
            const paymentStatuses = this.getPaymentStatuses();
            
            responseReturn(res, 200, {
                orderStatuses,
                paymentStatuses
            });
        } catch (error) {
            console.error('Get order statuses error:', error);
            responseReturn(res, 500, {
                message: error.message || 'Lỗi khi lấy danh sách trạng thái',
                success: false
            });
        }
    }

    // Hàm hỗ trợ: Danh sách trạng thái đơn hàng
    getOrderStatuses() {
        return {
            pending: {
                id: 'pending',
                name: 'Chờ xử lý',
                description: 'Đơn hàng đang chờ xác nhận'
            },
            processing: {
                id: 'processing',
                name: 'Đang xử lý',
                description: 'Đơn hàng đang được chuẩn bị'
            },
            shipped: {
                id: 'shipped',
                name: 'Đang giao hàng',
                description: 'Đơn hàng đã được giao cho đơn vị vận chuyển'
            },
            delivered: {
                id: 'delivered',
                name: 'Đã giao hàng',
                description: 'Đơn hàng đã được giao thành công'
            },
            completed: {
                id: 'completed',
                name: 'Hoàn thành',
                description: 'Đơn hàng đã hoàn thành'
            },
            cancelled: {
                id: 'cancelled',
                name: 'Đã hủy',
                description: 'Đơn hàng đã bị hủy'
            },
            returned: {
                id: 'returned',
                name: 'Đã hoàn trả',
                description: 'Đơn hàng đã được hoàn trả'
            }
        };
    }

    // Hàm hỗ trợ: Danh sách trạng thái thanh toán
    getPaymentStatuses() {
        return {
            unpaid: {
                id: 'unpaid',
                name: 'Chưa thanh toán',
                description: 'Đơn hàng chưa được thanh toán'
            },
            pending: {
                id: 'pending',
                name: 'Chờ thanh toán',
                description: 'Đang chờ xác nhận thanh toán'
            },
            paid: {
                id: 'paid',
                name: 'Đã thanh toán',
                description: 'Đơn hàng đã được thanh toán'
            },
            refunded: {
                id: 'refunded',
                name: 'Đã hoàn tiền',
                description: 'Tiền đã được hoàn trả cho khách hàng'
            },
            failed: {
                id: 'failed',
                name: 'Thanh toán thất bại',
                description: 'Thanh toán không thành công'
            }
        };
    }

    // Hàm hỗ trợ: Xử lý đơn hàng COD (không thay đổi trạng thái thanh toán)
    async processCodOrder(orderId) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const order = await customerOrder.findById(orderId).session(session);
            if (!order) {
                throw new Error('Đơn hàng không tồn tại');
            }

            const orderStatuses = this.getOrderStatuses();

            // Chỉ cập nhật trạng thái đơn hàng, không thay đổi trạng thái thanh toán
            await customerOrder.findByIdAndUpdate(orderId, {
                delivery_status: orderStatuses.processing.id
            }, { session });

            // Cập nhật tất cả đơn hàng con của các người bán
            const sellerOrders = await authOrderModel.find({ orderId: new ObjectId(orderId) }).session(session);
            
            // Lấy tất cả productId từ tất cả đơn hàng con
            const allProducts = sellerOrders.flatMap(order => order.products);

            // Cập nhật trạng thái cho tất cả đơn hàng con
            await authOrderModel.updateMany(
                { orderId: new ObjectId(orderId) },
                {
                    delivery_status: orderStatuses.processing.id
                },
                { session }
            );

            // Cập nhật số lượng sản phẩm trong kho cho từng người bán
            for (const sellerOrder of sellerOrders) {
                for (const product of sellerOrder.products) {
                    const productDoc = await productModel.findById(product.productId).session(session);
                    if (!productDoc) {
                        throw new Error(`Không tìm thấy sản phẩm với ID: ${product.productId}`);
                    }
                    
                    if (productDoc.stock < product.quantity) {
                        throw new Error(`Sản phẩm ${productDoc.name} không đủ số lượng trong kho`);
                    }
                    
                    await productModel.findByIdAndUpdate(
                        product.productId,
                        { 
                            $inc: { 
                                stock: -product.quantity,
                                sold: product.quantity
                            } 
                        },
                        { session }
                    );
                    
                    console.log(`Đã cập nhật sản phẩm ${product.productId}: giảm ${product.quantity} đơn vị stock, tăng ${product.quantity} đơn vị sold`);
                }
            }

            await session.commitTransaction();
            return order;

        } catch (error) {
            await session.abortTransaction();
            console.error('Process COD order error:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }
}

module.exports = new orderController()

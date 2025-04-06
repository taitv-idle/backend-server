// Import các model liên quan
const authOrderModel = require('../../models/authOrder')
const customerOrder = require('../../models/customerOrder')
const myShopWallet = require('../../models/myShopWallet')
const sellerWallet = require('../../models/sellerWallet')
const cardModel = require('../../models/cardModel')
const moment = require("moment")
const { responseReturn } = require('../../utiles/response')
const { mongo: {ObjectId}} = require('mongoose')
const {config} = require("dotenv");

// Cấu hình Stripe
const stripe = require('stripe')(process.env.stripe_sk)

// Controller xử lý các nghiệp vụ liên quan đến đơn hàng
class orderController{

    // Hàm kiểm tra thanh toán
    paymentCheck = async (id) => {
        try {
            const order = await customerOrder.findById(id)
            if (order.payment_status === 'unpaid') {
                await customerOrder.findByIdAndUpdate(id, {
                    delivery_status: 'cancelled'
                })
                await authOrderModel.updateMany({
                    orderId: id
                },{
                    delivery_status: 'cancelled'
                })
            }
            return true
        } catch (error) {
            console.log(error)
        }
    }

    // Đặt hàng
    place_order = async (req, res) => {
        const {price, products, shipping_fee, shippingInfo, userId } = req.body
        let authorOrderData = []
        let cardId = []
        const tempDate = moment(Date.now()).format('LLL')

        let customerOrderProduct = []

        for (let i = 0; i < products.length; i++) {
            const pro = products[i].products
            for (let j = 0; j < pro.length; j++) {
                const tempCusPro = pro[j].productInfo;
                tempCusPro.quantity = pro[j].quantity
                customerOrderProduct.push(tempCusPro)
                if (pro[j]._id) {
                    cardId.push(pro[j]._id)
                }
            }
        }

        try {
            const order = await customerOrder.create({
                customerId: userId,
                shippingInfo,
                products: customerOrderProduct,
                price: price + shipping_fee,
                payment_status: 'unpaid',
                delivery_status: 'pending',
                date: tempDate
            })

            for (let i = 0; i < products.length; i++) {
                const pro = products[i].products
                const pri = products[i].price
                const sellerId = products[i].sellerId
                let storePor = []

                for (let j = 0; j < pro.length; j++) {
                    const tempPro = pro[j].productInfo
                    tempPro.quantity = pro[j].quantity
                    storePor.push(tempPro)
                }

                authorOrderData.push({
                    orderId: order.id,
                    sellerId,
                    products: storePor,
                    price: pri,
                    payment_status: 'unpaid',
                    shippingInfo: 'Kho chính Easy',
                    delivery_status: 'pending',
                    date: tempDate
                })
            }

            await authOrderModel.insertMany(authorOrderData)

            for (let k = 0; k < cardId.length; k++) {
                await cardModel.findByIdAndDelete(cardId[k])
            }

            // Sau 15 giây, kiểm tra trạng thái thanh toán
            setTimeout(() => {
                this.paymentCheck(order.id)
            }, 15000)

            responseReturn(res, 200, {message: "Đặt hàng thành công", orderId: order.id})

        } catch (error) {
            console.log(error.message)
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

}

module.exports = new orderController()

const { responseReturn } = require("../../utils/response") 
const myShopWallet = require('../../models/myShopWallet')
const productModel = require('../../models/productModel')
const customerOrder = require('../../models/customerOrder')
const sellerModel = require('../../models/sellerModel') 
const adminSellerMessage = require('../../models/chat/adminSellerMessage') 
const sellerWallet = require('../../models/sellerWallet') 
const authOrder = require('../../models/authOrder') 
const sellerCustomerMessage = require('../../models/chat/sellerCustomerMessage') 
const bannerModel = require('../../models/bannerModel') 
const { mongo: {ObjectId}} = require('mongoose')
const cloudinary = require('cloudinary').v2
const formidable = require("formidable")

class dashboardController{

    get_admin_dashboard_data = async (req, res) => {
        console.log('=== Dashboard Request ===');
        console.log('User ID:', req.id);
        const { id } = req;
        try {
            console.log('1. Getting total sale...');
            // Lấy tổng doanh thu
            const totalSale = await myShopWallet.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);
            console.log('Total Sale:', totalSale);

            console.log('2. Getting monthly data...');
            // Lấy thống kê theo tháng
            const monthlyData = await customerOrder.aggregate([
                {
                    $group: {
                        _id: {
                            month: { $month: "$createdAt" },
                            year: { $year: "$createdAt" }
                        },
                        totalOrders: { $sum: 1 },
                        totalSales: { $sum: "$price" }
                    }
                },
                {
                    $sort: { "_id.year": 1, "_id.month": 1 }
                }
            ]);
            console.log('Monthly Data:', monthlyData);

            console.log('3. Getting new sellers data...');
            // Lấy số lượng người bán mới theo tháng
            const newSellersData = await sellerModel.aggregate([
                {
                    $group: {
                        _id: {
                            month: { $month: "$createdAt" },
                            year: { $year: "$createdAt" }
                        },
                        newSellers: { $sum: 1 }
                    }
                },
                {
                    $sort: { "_id.year": 1, "_id.month": 1 }
                }
            ]);
            console.log('New Sellers Data:', newSellersData);

            // Kết hợp dữ liệu và tạo mảng đầy đủ 12 tháng
            const fullYearData = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const monthData = monthlyData.find(m => m._id.month === month);
                const sellerData = newSellersData.find(m => m._id.month === month);

                return {
                    month,
                    totalOrders: monthData ? monthData.totalOrders : 0,
                    totalSales: monthData ? monthData.totalSales : 0,
                    newSellers: sellerData ? sellerData.newSellers : 0
                };
            });
            console.log('Full Year Data:', fullYearData);

            console.log('4. Getting order status stats...');
            // Lấy thống kê trạng thái đơn hàng
            const orderStatusStats = await customerOrder.aggregate([
                {
                    $group: {
                        _id: "$delivery_status",
                        count: { $sum: 1 }
                    }
                }
            ]);
            console.log('Order Status Stats:', orderStatusStats);

            // Format order status stats
            const formattedOrderStatusStats = [
                orderStatusStats.find(s => s._id === 'delivered')?.count || 0,
                orderStatusStats.find(s => s._id === 'processing')?.count || 0,
                orderStatusStats.find(s => s._id === 'inStock')?.count || 0,
                orderStatusStats.find(s => s._id === 'ordered')?.count || 0,
                orderStatusStats.find(s => s._id === 'cancelled')?.count || 0,
                orderStatusStats.find(s => s._id === 'pending')?.count || 0
            ];
            console.log('Formatted Order Status Stats:', formattedOrderStatusStats);

            console.log('5. Getting payment method stats...');
            // Lấy thống kê phương thức thanh toán
            const paymentMethodStats = await customerOrder.aggregate([
                {
                    $group: {
                        _id: "$payment_status",
                        count: { $sum: 1 }
                    }
                }
            ]);
            console.log('Payment Method Stats:', paymentMethodStats);

            // Format payment method stats
            const formattedPaymentMethodStats = [
                paymentMethodStats.find(s => s._id === 'paid')?.count || 0,
                paymentMethodStats.find(s => s._id === 'pending')?.count || 0
            ];
            console.log('Formatted Payment Method Stats:', formattedPaymentMethodStats);

            console.log('6. Getting top products...');
            // Lấy sản phẩm bán chạy
            const topProducts = await productModel.aggregate([
                {
                    $lookup: {
                        from: "customerorders",
                        let: { productId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$payment_status", "paid"] },
                                            { $in: ["$$productId", "$products.productId"] }
                                        ]
                                    }
                                }
                            },
                            {
                                $unwind: "$products"
                            },
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$products.productId", "$$productId"]
                                    }
                                }
                            }
                        ],
                        as: "orders"
                    }
                },
                {
                    $addFields: {
                        totalSold: {
                            $sum: {
                                $map: {
                                    input: "$orders",
                                    as: "order",
                                    in: "$$order.products.quantity"
                                }
                            }
                        },
                        totalRevenue: {
                            $sum: {
                                $map: {
                                    input: "$orders",
                                    as: "order",
                                    in: {
                                        $multiply: ["$$order.products.price", "$$order.products.quantity"]
                                    }
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        images: 1,
                        totalSold: 1,
                        totalRevenue: 1
                    }
                },
                {
                    $sort: { totalSold: -1 }
                },
                {
                    $limit: 5
                }
            ]);
            console.log('Top Products:', JSON.stringify(topProducts, null, 2));

            console.log('7. Getting new sellers...');
            // Lấy người bán mới
            const newSellers = await sellerModel.find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .select('name image createdAt totalSales')
                .lean();
            console.log('New Sellers:', newSellers);

            console.log('8. Getting recent orders...');
            // Lấy đơn hàng gần đây
            const recentOrders = await customerOrder.find({})
                .sort({ createdAt: -1 })
                .limit(5)
                .populate({
                    path: 'products.productId',
                    select: 'name images price'
                })
                .lean();
            console.log('Recent Orders:', recentOrders);

            console.log('9. Getting total counts...');
            const totalProduct = await productModel.find({}).countDocuments();
            const totalOrder = await customerOrder.find({}).countDocuments();
            const totalSeller = await sellerModel.find({}).countDocuments();
            console.log('Total Counts:', { totalProduct, totalOrder, totalSeller });

            const responseData = {
                totalProduct,
                totalOrder,
                totalSeller,
                totalSale: totalSale.length > 0 ? totalSale[0].totalAmount : 0,
                monthlyData: fullYearData,
                orderStatusStats: formattedOrderStatusStats,
                paymentMethodStats: formattedPaymentMethodStats,
                topProducts,
                newSellers,
                recentOrders
            };
            console.log('Final Response Data:', responseData);

            responseReturn(res, 200, responseData);

        } catch (error) {
            console.log('Dashboard Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }
   


    get_seller_dashboard_data = async (req, res) => {
        const { id } = req;
        try {
            // Lấy tổng doanh thu của seller
            const totalSale = await sellerWallet.aggregate([
                {
                    $match: {
                        sellerId: { $eq: id }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' }
                    }
                }
            ]);

            // Lấy thống kê theo tháng cho seller
            const monthlyData = await authOrder.aggregate([
                {
                    $match: { sellerId: new ObjectId(id) }
                },
                {
                    $group: {
                        _id: {
                            month: { $month: "$createdAt" },
                            year: { $year: "$createdAt" }
                        },
                        totalOrders: { $sum: 1 },
                        totalSales: { $sum: "$price" }
                    }
                },
                {
                    $sort: { "_id.year": 1, "_id.month": 1 }
                }
            ]);

            // Tạo mảng đầy đủ 12 tháng
            const fullYearData = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const monthData = monthlyData.find(m => m._id.month === month);

                return {
                    month,
                    totalOrders: monthData ? monthData.totalOrders : 0,
                    totalSales: monthData ? monthData.totalSales : 0,
                    newSellers: 0 // Seller không có dữ liệu này
                };
            });

            const totalProduct = await productModel.find({
                sellerId: new ObjectId(id)
            }).countDocuments();

            const totalOrder = await authOrder.find({
                sellerId: new ObjectId(id)
            }).countDocuments();

            const totalPendingOrder = await authOrder.find({
                $and: [
                    { sellerId: { $eq: new ObjectId(id) } },
                    { delivery_status: { $eq: 'pending' } }
                ]
            }).countDocuments();

            const messages = await sellerCustomerMessage.find({
                $or: [
                    { senderId: { $eq: id } },
                    { receverId: { $eq: id } }
                ]
            }).limit(3);

            const recentOrders = await authOrder.find({
                sellerId: new ObjectId(id)
            }).limit(5);

            responseReturn(res, 200, {
                totalProduct,
                totalOrder,
                totalPendingOrder,
                messages,
                recentOrders,
                totalSale: totalSale.length > 0 ? totalSale[0].totalAmount : 0,
                monthlyData: fullYearData // Thêm dữ liệu theo tháng cho seller
            });

        } catch (error) {
            console.log(error.message);
            responseReturn(res, 500, { error: error.message });
        }
    }
   

    add_banner = async(req,res) => {
       const form = formidable({multiples:true})
       form.parse(req, async(err, field, files) => {
        const {productId} = field
        const { mainban } = files

        cloudinary.config({
            cloud_name: process.env.cloud_name,
            api_key: process.env.api_key,
            api_secret: process.env.api_secret,
            secure: true
        })
        
        try {
            const {slug} = await productModel.findById(productId) 
            const result = await cloudinary.uploader.upload(mainban.filepath, {folder: 'banners'})
            const banner = await bannerModel.create({
                productId,
                banner: result.url,
                link: slug 
            })
            responseReturn(res, 200, {banner,message: "Banner Add Success"})
        } catch (error) {
            responseReturn(res, 500, { error: error.message})
        } 
        
       })
    }


 get_banner = async(req,res) => {
    const {productId} = req.params
    try {
        const banner = await bannerModel.findOne({ productId: new ObjectId(productId) })
        responseReturn(res,200, {banner})
    } catch (error) {
        responseReturn(res, 500, { error: error.message})
    }

 }
 

  update_banner = async(req, res) => {
    const { bannerId } = req.params
    const form = formidable({})

    form.parse(req, async(err,_,files)=> {
        const {mainban} = files

        cloudinary.config({
            cloud_name: process.env.cloud_name,
            api_key: process.env.api_key,
            api_secret: process.env.api_secret,
            secure: true
        })

        try {
            let banner = await bannerModel.findById(bannerId)
            let temp = banner.banner.split('/')
            temp = temp[temp.length - 1]
            const imageName = temp.split('.')[0]
            await cloudinary.uploader.destroy(imageName)

            const {url } =  await cloudinary.uploader.upload(mainban.filepath, {folder: 'banners'})

            await bannerModel.findByIdAndUpdate(bannerId,{
                banner: url
            })

            banner = await bannerModel.findById(bannerId)
            responseReturn(res,200, {banner, message: "Banner Updated Success"})

        } catch (error) {
            responseReturn(res, 500, { error: error.message})
        }

    })
  }
   

    get_banners = async(req, res) => {

        try {
            const banners = await bannerModel.aggregate([
                {
                    $sample: {
                        size: 5
                    }
                }
            ])
            responseReturn(res,200,{ banners })
        } catch (error) {
            responseReturn(res, 500, { error: error.message})
        }

    }
   


}

module.exports = new dashboardController()
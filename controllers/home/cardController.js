const cardModel = require('../../models/cardModel')
const { responseReturn } = require('../../utils/response')
const { mongo: {ObjectId}} = require('mongoose')
const wishlistModel = require('../../models/wishlistModel')

class cardController{
   
    add_to_card = async(req, res) => {
        const { userId, productId, quantity } = req.body

        if (!userId || !productId || !quantity) {
            return responseReturn(res, 400, { error: "Vui lòng điền đầy đủ thông tin" })
        }

        try {
            const product = await cardModel.findOne({
                productId,
                userId
            })

            if (product) {
                return responseReturn(res, 404, { error: "Sản phẩm đã có trong giỏ hàng" })
            }

            const newProduct = await cardModel.create({
                userId,
                productId,
                quantity
            })

            return responseReturn(res, 201, {
                message: "Thêm vào giỏ hàng thành công",
                product: newProduct
            })
        } catch (error) {
            console.error('Lỗi khi thêm vào giỏ hàng:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }
    }
     

    get_card_products = async(req, res) => {
        const COMMISSION_RATE = 5
        const { userId } = req.params

        if (!userId) {
            return responseReturn(res, 400, { error: "Vui lòng cung cấp ID người dùng" })
        }

        try {
            // Kiểm tra tính hợp lệ của ObjectId
            if (!ObjectId.isValid(userId)) {
                return responseReturn(res, 400, { error: "ID người dùng không hợp lệ" })
            }

            // Tối ưu hóa truy vấn aggregate
            const card_products = await cardModel.aggregate([
                {
                    $match: {
                        userId: new ObjectId(userId)
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'productId',
                        foreignField: "_id",
                        as: 'products'
                    }
                },
                // Unwind để làm phẳng mảng kết quả
                { $unwind: "$products" },
                // Thêm trường để phân loại sản phẩm hết hàng
                {
                    $addFields: {
                        isOutOfStock: { $lt: ["$products.stock", "$quantity"] },
                        productPrice: {
                            $cond: {
                                if: { $gt: ["$products.discount", 0] },
                                then: {
                                    $subtract: [
                                        "$products.price",
                                        { $floor: { $multiply: ["$products.price", { $divide: ["$products.discount", 100] }] } }
                                    ]
                                },
                                else: "$products.price"
                            }
                        }
                    }
                },
                // Nhóm theo sellerId
                {
                    $group: {
                        _id: "$products.sellerId",
                        shopName: { $first: "$products.shopName" },
                        products: {
                            $push: {
                                _id: "$$ROOT._id",
                                quantity: "$$ROOT.quantity",
                                productInfo: "$$ROOT.products",
                                isOutOfStock: "$$ROOT.isOutOfStock",
                                productPrice: "$$ROOT.productPrice"
                            }
                        },
                        totalProducts: { $sum: 1 },
                        buy_product_item: { $sum: { $cond: [{ $eq: ["$isOutOfStock", false] }, "$quantity", 0] } },
                        card_product_count: { $sum: "$quantity" },
                        totalPrice: {
                            $sum: {
                                $multiply: [
                                    { $cond: [{ $eq: ["$isOutOfStock", false] }, "$productPrice", 0] },
                                    "$quantity"
                                ]
                            }
                        }
                    }
                },
                // Định dạng lại kết quả
                {
                    $project: {
                        _id: 0,
                        sellerId: "$_id",
                        shopName: 1,
                        products: 1,
                        price: {
                            $subtract: [
                                "$totalPrice",
                                { $floor: { $multiply: ["$totalPrice", { $divide: [COMMISSION_RATE, 100] }] } }
                            ]
                        }
                    }
                }
            ])

            // Tách các sản phẩm hết hàng
            const outOfStockProduct = []
            let buy_product_item = 0
            let card_product_count = 0
            let calculatePrice = 0

            // Tính toán tổng thể
            card_products.forEach(seller => {
                seller.products.forEach(product => {
                    if (product.isOutOfStock) {
                        outOfStockProduct.push(product)
                    } else {
                        buy_product_item += product.quantity
                        calculatePrice += product.productPrice * product.quantity
                    }
                    card_product_count += product.quantity
                })
            })

            return responseReturn(res, 200, {
                card_products,
                price: calculatePrice,
                card_product_count,
                shipping_fee: 20 * card_products.length,
                outOfStockProduct,
                buy_product_item
            })
        } catch (error) {
            console.error('Lỗi khi lấy thông tin giỏ hàng:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }
    }
     


    delete_card_products = async (req, res) => {
        const { card_id } = req.params

        if (!card_id) {
            return responseReturn(res, 400, { error: "Vui lòng cung cấp ID giỏ hàng" })
        }

        try {
            const product = await cardModel.findById(card_id)
            if (!product) {
                return responseReturn(res, 404, { error: "Không tìm thấy sản phẩm trong giỏ hàng" })
            }

            await cardModel.findByIdAndDelete(card_id)
            return responseReturn(res, 200, { message: "Xóa sản phẩm khỏi giỏ hàng thành công" })
        } catch (error) {
            console.error('Lỗi khi xóa sản phẩm:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }
    }
        

       quantity_inc = async (req, res) => {
        const { card_id } = req.params

        if (!card_id) {
            return responseReturn(res, 400, { error: "Vui lòng cung cấp ID giỏ hàng" })
        }

        try {
            const product = await cardModel.findById(card_id)
            if (!product) {
                return responseReturn(res, 404, { error: "Không tìm thấy sản phẩm trong giỏ hàng" })
            }

            await cardModel.findByIdAndUpdate(card_id, { quantity: product.quantity + 1 })
            return responseReturn(res, 200, { message: "Cập nhật số lượng thành công" })
        } catch (error) {
            console.error('Lỗi khi tăng số lượng:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }
    }
        

       quantity_dec = async (req, res) => {
        const { card_id } = req.params

        if (!card_id) {
            return responseReturn(res, 400, { error: "Vui lòng cung cấp ID giỏ hàng" })
        }

        try {
            const product = await cardModel.findById(card_id)
            if (!product) {
                return responseReturn(res, 404, { error: "Không tìm thấy sản phẩm trong giỏ hàng" })
            }

            if (product.quantity <= 1) {
                return responseReturn(res, 400, { error: "Số lượng không thể nhỏ hơn 1" })
            }

            await cardModel.findByIdAndUpdate(card_id, { quantity: product.quantity - 1 })
            return responseReturn(res, 200, { message: "Cập nhật số lượng thành công" })
        } catch (error) {
            console.error('Lỗi khi giảm số lượng:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }
    }
        


       add_wishlist = async (req, res) => {
        const { slug } = req.body

        if (!slug) {
            return responseReturn(res, 400, { error: "Vui lòng cung cấp mã sản phẩm" })
        }

        try {
            const product = await wishlistModel.findOne({ slug })
            if (product) {
                return responseReturn(res, 404, { error: "Sản phẩm đã có trong danh sách yêu thích" })
            }

            await wishlistModel.create(req.body)
            return responseReturn(res, 201, { message: "Thêm vào danh sách yêu thích thành công" })
        } catch (error) {
            console.error('Lỗi khi thêm vào danh sách yêu thích:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }

       }
        


       get_wishlist = async (req, res) => {
        const { userId } = req.params

        if (!userId) {
            return responseReturn(res, 400, { error: "Vui lòng cung cấp ID người dùng" })
        }

        try {
            const wishlists = await wishlistModel.find({ userId })
            return responseReturn(res, 200, {
                wishlistCount: wishlists.length,
                wishlists
            })
        } catch (error) {
            console.error('Lỗi khi lấy danh sách yêu thích:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
        }
       } 
         

        remove_wishlist = async (req, res) => {
           const { wishlistId } = req.params

           if (!wishlistId) {
               return responseReturn(res, 400, { error: "Vui lòng cung cấp ID danh sách yêu thích" })
           }

           try {
            // Kiểm tra tính hợp lệ của ObjectId
            if (!ObjectId.isValid(wishlistId)) {
                return responseReturn(res, 400, { error: "ID danh sách yêu thích không hợp lệ" })
            }

            const wishlist = await wishlistModel.findByIdAndDelete(wishlistId) 
            if (!wishlist) {
                return responseReturn(res, 404, { error: "Không tìm thấy sản phẩm trong danh sách yêu thích" })
            }

            return responseReturn(res, 200, {
                message: "Xóa sản phẩm khỏi danh sách yêu thích thành công",
                wishlistId
            })
            
           } catch (error) {
            console.error('Lỗi khi xóa khỏi danh sách yêu thích:', error.message)
            return responseReturn(res, 500, { error: "Lỗi máy chủ" })
           }
        }
  

}


module.exports = new cardController()
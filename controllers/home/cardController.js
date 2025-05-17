const cardModel = require('../../models/cardModel')
const { responseReturn } = require('../../utils/response')
const { mongo: {ObjectId}} = require('mongoose')
const wishlistModel = require('../../models/wishlistModel')

class cardController {
    add_to_card = async(req, res) => {
        const { userId, productId, quantity } = req.body

        if (!userId || !productId || !quantity) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng điền đầy đủ thông tin",
                requiredFields: ['userId', 'productId', 'quantity']
            })
        }

        try {
            const product = await cardModel.findOne({
                productId,
                userId
            })

            if (product) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "Sản phẩm đã có trong giỏ hàng",
                    productId
                })
            }

            const newProduct = await cardModel.create({
                userId,
                productId,
                quantity
            })

            return responseReturn(res, 201, {
                success: true,
                message: "Thêm vào giỏ hàng thành công",
                data: {
                    product: newProduct
                }
            })
        } catch (error) {
            console.error('Lỗi khi thêm vào giỏ hàng:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    get_card_products = async(req, res) => {
        const COMMISSION_RATE = 5
        const { userId } = req.params

        if (!userId) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp ID người dùng"
            })
        }

        try {
            if (!ObjectId.isValid(userId)) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "ID người dùng không hợp lệ"
                })
            }

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
                { $unwind: "$products" },
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

            const outOfStockProduct = []
            let buy_product_item = 0
            let card_product_count = 0
            let calculatePrice = 0

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
                success: true,
                data: {
                    card_products,
                    summary: {
                        totalPrice: calculatePrice,
                        totalItems: card_product_count,
                        shippingFee: 20 * card_products.length,
                        outOfStockCount: outOfStockProduct.length,
                        buyableItems: buy_product_item
                    },
                    outOfStockProducts: outOfStockProduct
                }
            })
        } catch (error) {
            console.error('Lỗi khi lấy thông tin giỏ hàng:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    delete_card_products = async (req, res) => {
        const { card_id } = req.params

        if (!card_id) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp ID giỏ hàng"
            })
        }

        try {
            if (!ObjectId.isValid(card_id)) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "ID giỏ hàng không hợp lệ"
                })
            }

            const product = await cardModel.findById(card_id)
            if (!product) {
                return responseReturn(res, 404, { 
                    success: false,
                    message: "Không tìm thấy sản phẩm trong giỏ hàng"
                })
            }

            await cardModel.findByIdAndDelete(card_id)
            return responseReturn(res, 200, { 
                success: true,
                message: "Xóa sản phẩm khỏi giỏ hàng thành công",
                data: {
                    deletedProductId: card_id
                }
            })
        } catch (error) {
            console.error('Lỗi khi xóa sản phẩm:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    quantity_inc = async (req, res) => {
        const { card_id } = req.params

        if (!card_id) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp ID giỏ hàng"
            })
        }

        try {
            if (!ObjectId.isValid(card_id)) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "ID giỏ hàng không hợp lệ"
                })
            }

            const product = await cardModel.findById(card_id)
            if (!product) {
                return responseReturn(res, 404, { 
                    success: false,
                    message: "Không tìm thấy sản phẩm trong giỏ hàng"
                })
            }

            const updatedProduct = await cardModel.findByIdAndUpdate(
                card_id, 
                { quantity: product.quantity + 1 },
                { new: true }
            )

            return responseReturn(res, 200, { 
                success: true,
                message: "Cập nhật số lượng thành công",
                data: {
                    product: updatedProduct
                }
            })
        } catch (error) {
            console.error('Lỗi khi tăng số lượng:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    quantity_dec = async (req, res) => {
        const { card_id } = req.params

        if (!card_id) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp ID giỏ hàng"
            })
        }

        try {
            if (!ObjectId.isValid(card_id)) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "ID giỏ hàng không hợp lệ"
                })
            }

            const product = await cardModel.findById(card_id)
            if (!product) {
                return responseReturn(res, 404, { 
                    success: false,
                    message: "Không tìm thấy sản phẩm trong giỏ hàng"
                })
            }

            if (product.quantity <= 1) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "Số lượng không thể nhỏ hơn 1",
                    currentQuantity: product.quantity
                })
            }

            const updatedProduct = await cardModel.findByIdAndUpdate(
                card_id, 
                { quantity: product.quantity - 1 },
                { new: true }
            )

            return responseReturn(res, 200, { 
                success: true,
                message: "Cập nhật số lượng thành công",
                data: {
                    product: updatedProduct
                }
            })
        } catch (error) {
            console.error('Lỗi khi giảm số lượng:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    add_wishlist = async (req, res) => {
        const { slug } = req.body

        if (!slug) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp mã sản phẩm"
            })
        }

        try {
            const product = await wishlistModel.findOne({ slug })
            if (product) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "Sản phẩm đã có trong danh sách yêu thích",
                    productId: product._id
                })
            }

            const newWishlist = await wishlistModel.create(req.body)
            return responseReturn(res, 201, { 
                success: true,
                message: "Thêm vào danh sách yêu thích thành công",
                data: {
                    wishlist: newWishlist
                }
            })
        } catch (error) {
            console.error('Lỗi khi thêm vào danh sách yêu thích:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    get_wishlist = async (req, res) => {
        const { userId } = req.params

        if (!userId) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp ID người dùng"
            })
        }

        try {
            if (!ObjectId.isValid(userId)) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "ID người dùng không hợp lệ"
                })
            }

            const wishlists = await wishlistModel.find({ userId })
            return responseReturn(res, 200, {
                success: true,
                data: {
                    wishlistCount: wishlists.length,
                    wishlists
                }
            })
        } catch (error) {
            console.error('Lỗi khi lấy danh sách yêu thích:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }

    remove_wishlist = async (req, res) => {
        const { wishlistId } = req.params

        if (!wishlistId) {
            return responseReturn(res, 400, { 
                success: false,
                message: "Vui lòng cung cấp ID danh sách yêu thích"
            })
        }

        try {
            if (!ObjectId.isValid(wishlistId)) {
                return responseReturn(res, 400, { 
                    success: false,
                    message: "ID danh sách yêu thích không hợp lệ"
                })
            }

            const wishlist = await wishlistModel.findByIdAndDelete(wishlistId)
            if (!wishlist) {
                return responseReturn(res, 404, { 
                    success: false,
                    message: "Không tìm thấy sản phẩm trong danh sách yêu thích"
                })
            }

            return responseReturn(res, 200, {
                success: true,
                message: "Xóa sản phẩm khỏi danh sách yêu thích thành công",
                data: {
                    deletedWishlistId: wishlistId
                }
            })
        } catch (error) {
            console.error('Lỗi khi xóa khỏi danh sách yêu thích:', error.message)
            return responseReturn(res, 500, { 
                success: false,
                message: "Lỗi máy chủ",
                error: error.message
            })
        }
    }
}

module.exports = new cardController()
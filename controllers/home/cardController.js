const cardModel = require('../../models/cardModel')
const { responseReturn } = require('../../utiles/response')
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
                }
            ])

            const outOfStockProduct = card_products.filter(p => p.products[0].stock < p.quantity)
            const stockProduct = card_products.filter(p => p.products[0].stock >= p.quantity)

            let buy_product_item = 0
            let calculatePrice = 0
            let card_product_count = 0

            // Tính số lượng sản phẩm hết hàng
            outOfStockProduct.forEach(product => {
                card_product_count += product.quantity
            })

            // Tính toán sản phẩm còn hàng
            stockProduct.forEach(product => {
                const { quantity } = product
                const { price, discount } = product.products[0]
                
                buy_product_item += quantity
                card_product_count += quantity

                const productPrice = discount 
                    ? price - Math.floor((price * discount) / 100)
                    : price
                
                calculatePrice += quantity * productPrice
            })

            // Nhóm sản phẩm theo người bán
            const sellerGroups = {}
            const uniqueSellers = [...new Set(stockProduct.map(p => p.products[0].sellerId.toString()))]

            uniqueSellers.forEach(sellerId => {
                let sellerPrice = 0
                const sellerProducts = stockProduct.filter(p => 
                    p.products[0].sellerId.toString() === sellerId
                )

                sellerProducts.forEach(product => {
                    const { price, discount, shopName } = product.products[0]
                    let productPrice = discount 
                        ? price - Math.floor((price * discount) / 100)
                        : price
                    
                    productPrice = productPrice - Math.floor((productPrice * COMMISSION_RATE) / 100)
                    sellerPrice += productPrice * product.quantity

                    if (!sellerGroups[sellerId]) {
                        sellerGroups[sellerId] = {
                            sellerId,
                            shopName,
                            price: 0,
                            products: []
                        }
                    }

                    sellerGroups[sellerId].products.push({
                        _id: product._id,
                        quantity: product.quantity,
                        productInfo: product.products[0]
                    })
                })

                sellerGroups[sellerId].price = sellerPrice
            })

            return responseReturn(res, 200, {
                card_products: Object.values(sellerGroups),
                price: calculatePrice,
                card_product_count,
                shipping_fee: 20 * Object.keys(sellerGroups).length,
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
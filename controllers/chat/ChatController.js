const sellerModel = require('../../models/sellerModel')
const customerModel = require('../../models/customerModel')
const sellerCustomerModel = require('../../models/chat/sellerCustomerModel')
const sellerCustomerMessage = require('../../models/chat/sellerCustomerMessage')
const adminSellerMessage = require('../../models/chat/adminSellerMessage')
const { responseReturn } = require('../../utiles/response')

class ChatController {
    /**
     * Thêm người bán vào danh sách bạn bè của khách hàng và ngược lại
     */
    add_customer_friend = async (req, res) => {
        const { sellerId, userId } = req.body

        try {
            if (sellerId !== '') {
                // Lấy thông tin người bán và khách hàng từ database
                const seller = await sellerModel.findById(sellerId)
                const user = await customerModel.findById(userId)

                // Kiểm tra xem người bán đã có trong danh sách bạn của khách hàng chưa
                const checkSeller = await sellerCustomerModel.findOne({
                    $and: [
                        { myId: { $eq: userId } },
                        { myFriends: { $elemMatch: { fdId: sellerId } } }
                    ]
                })

                // Nếu chưa có thì thêm vào danh sách bạn
                if (!checkSeller) {
                    await sellerCustomerModel.updateOne(
                        { myId: userId },
                        {
                            $push: {
                                myFriends: {
                                    fdId: sellerId,
                                    name: seller.shopInfo?.shopName,
                                    image: seller.image
                                }
                            }
                        }
                    )
                }

                // Kiểm tra xem khách hàng đã có trong danh sách bạn của người bán chưa
                const checkCustomer = await sellerCustomerModel.findOne({
                    $and: [
                        { myId: { $eq: sellerId } },
                        { myFriends: { $elemMatch: { fdId: userId } } }
                    ]
                })

                // Nếu chưa có thì thêm vào danh sách bạn
                if (!checkCustomer) {
                    await sellerCustomerModel.updateOne(
                        { myId: sellerId },
                        {
                            $push: {
                                myFriends: {
                                    fdId: userId,
                                    name: user.name,
                                    image: ""
                                }
                            }
                        }
                    )
                }

                // Lấy lịch sử tin nhắn giữa khách hàng và người bán
                const messages = await sellerCustomerMessage.find({
                    $or: [
                        {
                            $and: [
                                { receverId: { $eq: sellerId } },
                                { senderId: { $eq: userId } }
                            ]
                        },
                        {
                            $and: [
                                { receverId: { $eq: userId } },
                                { senderId: { $eq: sellerId } }
                            ]
                        }
                    ]
                })

                // Lấy danh sách bạn bè của khách hàng
                const MyFriends = await sellerCustomerModel.findOne({ myId: userId })
                const currentFd = MyFriends.myFriends.find(s => s.fdId === sellerId)

                responseReturn(res, 200, {
                    MyFriends: MyFriends.myFriends,
                    currentFd,
                    messages
                })
            } else {
                // Nếu không có sellerId, chỉ trả về danh sách bạn bè
                const MyFriends = await sellerCustomerModel.findOne({ myId: userId })
                responseReturn(res, 200, {
                    MyFriends: MyFriends.myFriends
                })
            }
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Thêm tin nhắn từ khách hàng tới người bán
     */
    customer_message_add = async (req, res) => {
        const { userId, text, sellerId, name } = req.body

        try {
            // Tạo tin nhắn mới
            const message = await sellerCustomerMessage.create({
                senderId: userId,
                senderName: name,
                receverId: sellerId,
                message: text
            })

            // Cập nhật vị trí người bán lên đầu danh sách bạn bè của khách hàng
            const data = await sellerCustomerModel.findOne({ myId: userId })
            let myFriends = data.myFriends
            let index = myFriends.findIndex(f => f.fdId === sellerId)
            while (index > 0) {
                let temp = myFriends[index]
                myFriends[index] = myFriends[index - 1]
                myFriends[index - 1] = temp
                index--
            }
            await sellerCustomerModel.updateOne(
                { myId: userId },
                { myFriends }
            )

            // Cập nhật vị trí khách hàng lên đầu danh sách bạn bè của người bán
            const data1 = await sellerCustomerModel.findOne({ myId: sellerId })
            let myFriends1 = data1.myFriends
            let index1 = myFriends1.findIndex(f => f.fdId === userId)
            while (index1 > 0) {
                let temp1 = myFriends1[index1]
                myFriends1[index1] = myFriends1[index1 - 1]
                myFriends1[index1 - 1] = temp1
                index1--
            }
            await sellerCustomerModel.updateOne(
                { myId: sellerId },
                { myFriends: myFriends1 }
            )

            responseReturn(res, 201, { message })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Lấy danh sách khách hàng của một người bán
     */
    get_customers = async (req, res) => {
        const { sellerId } = req.params
        try {
            const data = await sellerCustomerModel.findOne({ myId: sellerId })
            responseReturn(res, 200, {
                customers: data.myFriends
            })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Lấy tin nhắn giữa người bán và khách hàng
     */
    get_customers_seller_message = async (req, res) => {
        const { customerId } = req.params
        const { id } = req

        try {
            // Lấy tin nhắn giữa người bán và khách hàng
            const messages = await sellerCustomerMessage.find({
                $or: [
                    {
                        $and: [
                            { receverId: { $eq: customerId } },
                            { senderId: { $eq: id } }
                        ]
                    },
                    {
                        $and: [
                            { receverId: { $eq: id } },
                            { senderId: { $eq: customerId } }
                        ]
                    }
                ]
            })

            // Lấy thông tin khách hàng
            const currentCustomer = await customerModel.findById(customerId)
            responseReturn(res, 200, {
                messages,
                currentCustomer
            })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Thêm tin nhắn từ người bán tới khách hàng

     */
    seller_message_add = async (req, res) => {
        const { senderId, receverId, text, name } = req.body
        try {
            // Tạo tin nhắn mới
            const message = await sellerCustomerMessage.create({
                senderId,
                senderName: name,
                receverId,
                message: text
            })

            // Cập nhật vị trí khách hàng lên đầu danh sách bạn bè của người bán
            const data = await sellerCustomerModel.findOne({ myId: senderId })
            let myFriends = data.myFriends
            let index = myFriends.findIndex(f => f.fdId === receverId)
            while (index > 0) {
                let temp = myFriends[index]
                myFriends[index] = myFriends[index - 1]
                myFriends[index - 1] = temp
                index--
            }
            await sellerCustomerModel.updateOne(
                { myId: senderId },
                { myFriends }
            )

            // Cập nhật vị trí người bán lên đầu danh sách bạn bè của khách hàng
            const data1 = await sellerCustomerModel.findOne({ myId: receverId })
            let myFriends1 = data1.myFriends
            let index1 = myFriends1.findIndex(f => f.fdId === senderId)
            while (index1 > 0) {
                let temp1 = myFriends1[index1]
                myFriends1[index1] = myFriends1[index1 - 1]
                myFriends1[index1 - 1] = temp1
                index1--
            }
            await sellerCustomerModel.updateOne(
                { myId: receverId },
                { myFriends: myFriends1 }
            )

            responseReturn(res, 201, { message })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Lấy danh sách tất cả người bán
     */
    get_sellers = async (req, res) => {
        try {
            const sellers = await sellerModel.find({})
            responseReturn(res, 200, {
                sellers
            })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Thêm tin nhắn từ admin tới người bán
     */
    seller_admin_message_insert = async (req, res) => {
        const { senderId, receverId, message, senderName } = req.body

        try {
            const messageData = await adminSellerMessage.create({
                senderId,
                receverId,
                message,
                senderName
            })
            responseReturn(res, 200, { message: messageData })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Lấy tin nhắn giữa admin và người bán
     */
    get_admin_messages = async (req, res) => {
        const { receverId } = req.params
        const id = ""

        try {
            const messages = await adminSellerMessage.find({
                $or: [
                    {
                        $and: [
                            { receverId: { $eq: receverId } },
                            { senderId: { $eq: id } }
                        ]
                    },
                    {
                        $and: [
                            { receverId: { $eq: id } },
                            { senderId: { $eq: receverId } }
                        ]
                    }
                ]
            })

            let currentSeller = {}
            if (receverId) {
                currentSeller = await sellerModel.findById(receverId)
            }
            responseReturn(res, 200, {
                messages,
                currentSeller
            })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }

    /**
     * Lấy tin nhắn giữa người bán và admin
     */
    get_seller_messages = async (req, res) => {
        const receverId = "" // ID của admin (cần được xác định rõ)
        const { id } = req // ID của người bán

        try {
            const messages = await adminSellerMessage.find({
                $or: [
                    {
                        $and: [
                            { receverId: { $eq: receverId } },
                            { senderId: { $eq: id } }
                        ]
                    },
                    {
                        $and: [
                            { receverId: { $eq: id } },
                            { senderId: { $eq: receverId } }
                        ]
                    }
                ]
            })

            responseReturn(res, 200, {
                messages
            })
        } catch (error) {
            console.log(error)
            responseReturn(res, 500, { error: error.message })
        }
    }
}

module.exports = new ChatController()
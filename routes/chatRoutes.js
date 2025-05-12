const ChatController = require('../controllers/chat/ChatController')
const { authMiddleware } = require('../middlewares/authMiddleware')
const { responseReturn } = require('../utils/response')
const router = require('express').Router()
const multer = require('multer')
const path = require('path')

// Cấu hình multer để lưu file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/chat')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error('File type not supported'))
        }
    }
})

router.post('/chat/customer/add-customer-friend',ChatController.add_customer_friend)
router.post('/chat/customer/send-message-to-seller',ChatController.customer_message_add)

router.get('/chat/seller/get-customers/:sellerId',ChatController.get_customers)
router.get('/chat/seller/get-customer-message/:customerId',authMiddleware,ChatController.get_customers_seller_message)
router.post('/chat/seller/send-message-to-customer',authMiddleware,ChatController.seller_message_add)

router.get('/chat/admin/get-sellers',authMiddleware,ChatController.get_sellers)
router.post('/chat/message-send-seller-admin',authMiddleware,ChatController.seller_admin_message_insert)
router.get('/chat/get-admin-messages/:receverId',authMiddleware,ChatController.get_admin_messages)
router.get('/chat/get-seller-messages',authMiddleware,ChatController.get_seller_messages)

router.get('/chat/search-sellers', ChatController.search_sellers)

router.post('/chat/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return responseReturn(res, 400, { error: 'No file uploaded' })
        }
        const fileUrl = `/uploads/chat/${req.file.filename}`
        responseReturn(res, 200, { url: fileUrl })
    } catch (error) {
        console.log(error)
        responseReturn(res, 500, { error: error.message })
    }
})

module.exports = router 
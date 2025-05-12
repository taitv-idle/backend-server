const customerAuthController = require('../../controllers/home/customerAuthController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')
const upload = require('../../middlewares/upload-middleware')

router.post('/customer/customer-register', customerAuthController.customer_register)
router.post('/customer/customer-login', customerAuthController.customer_login)
router.get('/customer/logout', customerAuthController.customer_logout)
router.post('/customer/update-profile', authMiddleware, upload.single('image'), customerAuthController.update_user_profile)

module.exports = router 
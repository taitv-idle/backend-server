const customerAuthController = require('../../controllers/home/customerAuthController')
const router = require('express').Router()
const { authMiddleware, customerAuthMiddleware } = require('../../middlewares/authMiddleware')
const upload = require('../../middlewares/upload-middleware')

router.post('/customer/customer-register', customerAuthController.customer_register)
router.post('/customer/customer-login', customerAuthController.customer_login)
router.get('/customer/logout', customerAuthController.customer_logout)
router.post('/customer/update-profile', customerAuthMiddleware, upload.single('image'), customerAuthController.update_user_profile)
router.get('/customer/me', customerAuthMiddleware, customerAuthController.get_current_customer)

module.exports = router 
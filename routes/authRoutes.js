const authControllers = require('../controllers/authControllers')
const { authMiddleware } = require('../middlewares/authMiddleware')
const router = require('express').Router()

router.post('/admin-login',authControllers.admin_login)
router.get('/get-user',authMiddleware, authControllers.getUser)
router.post('/seller-register',authControllers.seller_register)
router.post('/seller-login',authControllers.seller_login)
router.post('/profile-image-upload',authMiddleware, authControllers.profile_image_upload)
router.post('/profile-info-add',authMiddleware, authControllers.profile_info_add)

router.post('/change-password',authMiddleware, authControllers.change_password)

// Thêm các route cho quên mật khẩu và đặt lại mật khẩu
router.post('/forgot-password', authControllers.forgot_password)
router.post('/reset-password', authControllers.reset_password)

router.get('/logout',authMiddleware, authControllers.logout)

module.exports = router 
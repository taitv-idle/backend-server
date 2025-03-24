const router = require('express').Router();
const authController = require('../controllers/authController');
const {authMiddleware} = require("../middlewares/authMiddleware");

router.post('/admin-login', authController.admin_login);
router.get('/get-user', authMiddleware, authController.getUser);
module.exports = router;
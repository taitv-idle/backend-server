const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/admin-login', authController.admin_login);

module.exports = router;
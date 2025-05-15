const orderController = require('../../controllers/order/orderController')
const router = require('express').Router()

// Customer
router.post('/home/order/place-order',orderController.place_order) 
router.get('/home/coustomer/get-dashboard-data/:userId',orderController.get_customer_dashboard_data)
router.get('/home/coustomer/get-orders/:customerId/:status',orderController.get_orders)
router.get('/home/coustomer/get-order-details/:orderId',orderController.get_order_details)

// Payment endpoints
router.post('/order/create-payment',orderController.create_payment)
router.post('/order/create-payment-intent',orderController.create_payment_intent)
router.post('/order/confirm-client-payment/:orderId',orderController.confirm_client_payment)
router.get('/order/confirm/:orderId',orderController.order_confirm)
router.get('/order/payment-success',orderController.order_payment_success)
router.get('/order-confirmation/:orderId',orderController.get_order_details)

// Admin
router.get('/admin/orders',orderController.get_admin_orders)
router.get('/admin/order/:orderId',orderController.get_admin_order)
router.put('/admin/order-status/update/:orderId',orderController.admin_order_status_update)

// Seller
router.get('/seller/orders/:sellerId',orderController.get_seller_orders)
router.get('/seller/order/:orderId',orderController.get_seller_order)
router.put('/seller/order-status/update/:orderId',orderController.seller_order_status_update)
module.exports = router  
const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const { dbConnect } = require('./utiles/db')

// Thiết lập socket.io
const socket = require('socket.io')
const http = require('http')
const server = http.createServer(app)

// Cấu hình CORS cho ứng dụng
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}))

// Cấu hình CORS cho socket.io
const io = socket(server, {
    cors: {
        origin: '*',
        credentials: true
    }
})

// Khai báo các biến toàn cục để lưu trữ thông tin người dùng
var allCustomer = []
var allSeller = []
let admin = {}

/**
 * Thêm người dùng (khách hàng) vào danh sách đang kết nối
 */
const addUser = (customerId, socketId, userInfo) => {
    const checkUser = allCustomer.some(u => u.customerId === customerId)
    if (!checkUser) {
        allCustomer.push({
            customerId,
            socketId,
            userInfo
        })
    }
}

/**
 * Thêm người bán vào danh sách đang kết nối
 */
const addSeller = (sellerId, socketId, userInfo) => {
    const checkSeller = allSeller.some(u => u.sellerId === sellerId)
    if (!checkSeller) {
        allSeller.push({
            sellerId,
            socketId,
            userInfo
        })
    }
}

/**
 * Tìm khách hàng theo ID
 */
const findCustomer = (customerId) => {
    return allCustomer.find(c => c.customerId === customerId)
}

/**
 * Tìm người bán theo ID
 */
const findSeller = (sellerId) => {
    return allSeller.find(c => c.sellerId === sellerId)
}

/**
 * Xóa người dùng khỏi danh sách khi ngắt kết nối
 * @param {string} socketId - ID socket của kết nối cần xóa
 */
const remove = (socketId) => {
    allCustomer = allCustomer.filter(c => c.socketId !== socketId)
    allSeller = allSeller.filter(c => c.socketId !== socketId)
}

// Xử lý các sự kiện socket.io
io.on('connection', (soc) => {
    console.log('Socket server đang chạy...')

    // Sự kiện khi khách hàng kết nối
    soc.on('add_user', (customerId, userInfo) => {
        addUser(customerId, soc.id, userInfo)
        io.emit('activeSeller', allSeller) // Gửi danh sách người bán đang hoạt động cho tất cả client
    })

    // Sự kiện khi người bán kết nối
    soc.on('add_seller', (sellerId, userInfo) => {
        addSeller(sellerId, soc.id, userInfo)
        io.emit('activeSeller', allSeller) // Gửi danh sách người bán đang hoạt động cho tất cả client
    })

    // Sự kiện khi người bán gửi tin nhắn cho khách hàng
    soc.on('send_seller_message', (msg) => {
        const customer = findCustomer(msg.receverId)
        if (customer !== undefined) {
            soc.to(customer.socketId).emit('seller_message', msg)
        }
    })

    // Sự kiện khi khách hàng gửi tin nhắn cho người bán
    soc.on('send_customer_message', (msg) => {
        const seller = findSeller(msg.receverId)
        if (seller !== undefined) {
            soc.to(seller.socketId).emit('customer_message', msg)
        }
    })

    // Sự kiện khi admin gửi tin nhắn cho người bán
    soc.on('send_message_admin_to_seller', (msg) => {
        const seller = findSeller(msg.receverId)
        if (seller !== undefined) {
            soc.to(seller.socketId).emit('receved_admin_message', msg)
        }
    })

    // Sự kiện khi người bán gửi tin nhắn cho admin
    soc.on('send_message_seller_to_admin', (msg) => {
        if (admin.socketId) {
            soc.to(admin.socketId).emit('receved_seller_message', msg)
        }
    })

    // Sự kiện khi admin kết nối
    soc.on('add_admin', (adminInfo) => {
        // Xóa thông tin nhạy cảm trước khi lưu
        delete adminInfo.email
        delete adminInfo.password
        admin = adminInfo
        admin.socketId = soc.id
        io.emit('activeSeller', allSeller) // Gửi danh sách người bán đang hoạt động
    })

    // Sự kiện khi ngắt kết nối
    soc.on('disconnect', () => {
        console.log('Người dùng ngắt kết nối')
        remove(soc.id)
        io.emit('activeSeller', allSeller) // Cập nhật danh sách người bán đang hoạt động
    })
})

// Cấu hình các middleware và routes
require('dotenv').config() // Load biến môi trường

app.use(bodyParser.json()) // Middleware phân tích request body dạng JSON
app.use(cookieParser())    // Middleware phân tích cookie

// Đăng ký các routes
app.use('/api/home', require('./routes/home/homeRoutes'))
app.use('/api', require('./routes/authRoutes'))
app.use('/api', require('./routes/order/orderRoutes'))
app.use('/api', require('./routes/home/cardRoutes'))
app.use('/api', require('./routes/dashboard/categoryRoutes'))
app.use('/api', require('./routes/dashboard/productRoutes'))
app.use('/api', require('./routes/dashboard/sellerRoutes'))
app.use('/api', require('./routes/home/customerAuthRoutes'))
app.use('/api', require('./routes/chatRoutes'))
app.use('/api', require('./routes/paymentRoutes'))
app.use('/api/payment', require('./routes/payment/stripeRoutes'))
app.use('/api', require('./routes/dashboard/dashboardRoutes'))
app.use('/api/order', require('./routes/order/shippingAddressRoutes'))
app.use('/api/order', require('./routes/order/shippingFeeRoutes'))

// Stripe webhook endpoint cần raw body
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), require('./routes/payment/stripeRoutes'));

// Route test
app.get('/', (req, res) => res.send('Hello Server'))

// Khởi động server
const port = process.env.PORT || 5000
dbConnect() // Kết nối database
server.listen(port, () => console.log(`Server đang chạy trên cổng ${port}`))
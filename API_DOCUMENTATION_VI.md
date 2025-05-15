# Tài liệu API - E-commerce Backend

## Thông tin chung
- Base URL: `http://localhost:5000/api`
- Server sử dụng JWT để xác thực
- Các request POST cần gửi dữ liệu dưới dạng JSON với header `Content-Type: application/json`
- Upload file sử dụng `multipart/form-data`

## Xác thực (Authentication)

### Xác thực Admin
- **POST** `/admin-login`: Đăng nhập cho admin
  - Body: `{ "email": "string", "password": "string" }`
  - Response: `{ "token": "string", "message": "string", "user": object }`

### Xác thực Seller (Người bán)
- **POST** `/seller-register`: Đăng ký tài khoản người bán
  - Body: `{ "name": "string", "email": "string", "password": "string" }`
  - Response: `{ "message": "string", "status": boolean }`

- **POST** `/seller-login`: Đăng nhập cho người bán
  - Body: `{ "email": "string", "password": "string" }`
  - Response: `{ "token": "string", "message": "string", "user": object }`

### Xác thực Customer (Khách hàng)
- **POST** `/customer/customer-register`: Đăng ký tài khoản khách hàng
  - Body: `{ "name": "string", "email": "string", "password": "string" }`
  - Response: `{ "message": "string", "status": boolean }`

- **POST** `/customer/customer-login`: Đăng nhập cho khách hàng
  - Body: `{ "email": "string", "password": "string" }`
  - Response: `{ "token": "string", "message": "string", "user": object }`

- **GET** `/customer/logout`: Đăng xuất khách hàng
  - Response: `{ "message": "string", "status": boolean }`

- **GET** `/customer/me`: Lấy thông tin khách hàng hiện tại
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "user": object }`

- **POST** `/customer/update-profile`: Cập nhật thông tin cá nhân khách hàng
  - Headers: `Authorization: Bearer <token>`
  - Body: Multipart form data với trường `image` (file) và các trường thông tin khác
  - Response: `{ "message": "string", "user": object }`

### Chung
- **GET** `/get-user`: Lấy thông tin người dùng hiện tại (admin/seller)
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "user": object }`

- **GET** `/logout`: Đăng xuất người dùng (admin/seller)
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "message": "string" }`

- **POST** `/profile-image-upload`: Upload ảnh đại diện
  - Headers: `Authorization: Bearer <token>`
  - Body: Multipart form data với trường `image`
  - Response: `{ "message": "string", "imageUrl": "string" }`

- **POST** `/profile-info-add`: Cập nhật thông tin profile
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "name": "string", "shopInfo": "string"... }`
  - Response: `{ "message": "string", "userInfo": object }`

- **POST** `/change-password`: Thay đổi mật khẩu
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "oldPassword": "string", "newPassword": "string" }`
  - Response: `{ "message": "string", "success": boolean }`

## Quản lý sản phẩm

### Thao tác của người bán
- **POST** `/product-add`: Thêm sản phẩm mới
  - Headers: `Authorization: Bearer <token>`
  - Body: 
  ```json
  { 
    "name": "string",
    "category": "string",
    "brand": "string",
    "price": number,
    "stock": number,
    "discount": number,
    "description": "string",
    "images": [array of image urls],
    "size": [array of sizes],
    "color": [array of colors]
  }
  ```
  - Response: `{ "message": "string", "product": object }`

- **GET** `/products-get`: Lấy danh sách sản phẩm của người bán
  - Headers: `Authorization: Bearer <token>`
  - Query params: `page`, `searchValue`, `perPage`
  - Response: `{ "products": array, "totalProducts": number }`

- **GET** `/product-details/:productId`: Lấy chi tiết sản phẩm theo ID
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "product": object }`

- **POST** `/product-update`: Cập nhật thông tin sản phẩm
  - Headers: `Authorization: Bearer <token>`
  - Body: Thông tin sản phẩm cập nhật kèm `productId`
  - Response: `{ "message": "string", "product": object }`

- **POST** `/product-image-update`: Cập nhật hình ảnh sản phẩm
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "oldImage": "string", "newImage": "string", "productId": "string" }`
  - Response: `{ "message": "string" }`

- **GET** `/discount-products-get`: Lấy danh sách sản phẩm khuyến mãi
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "products": array }`

- **DELETE** `/product-delete/:productId`: Xóa sản phẩm
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "message": "string", "success": boolean }`

## Danh mục (Category)

- **POST** `/category-add`: Thêm danh mục mới (Admin)
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "name": "string" }`
  - Response: `{ "category": object, "message": "string" }`

- **GET** `/category-get`: Lấy danh sách danh mục
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "categories": array }`

## Giỏ hàng (Cart)

- **POST** `/home/cart/add`: Thêm sản phẩm vào giỏ hàng
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "productId": "string", "quantity": number, "size": "string", "color": "string" }`
  - Response: `{ "message": "string", "cart": object }`

- **GET** `/home/cart/get`: Lấy thông tin giỏ hàng
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "cart": array, "price": number, "cartCount": number }`

- **DELETE** `/home/cart/delete/:cartId`: Xóa sản phẩm khỏi giỏ hàng
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "message": "string" }`

- **PUT** `/home/cart/update`: Cập nhật số lượng sản phẩm trong giỏ hàng
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "cartId": "string", "quantity": number }`
  - Response: `{ "message": "string" }`

## Đặt hàng (Order)

- **POST** `/order/place-order`: Đặt hàng
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "shippingInfo": object, "products": array, "price": number, "paymentMethod": "string" }`
  - Response: `{ "message": "string", "orderId": "string" }`

- **GET** `/customer/get-orders`: Lấy danh sách đơn hàng của khách hàng
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "orders": array }`

- **GET** `/customer/get-order/:orderId`: Xem chi tiết đơn hàng
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "order": object }`

- **GET** `/seller/get-orders`: Lấy danh sách đơn hàng của người bán
  - Headers: `Authorization: Bearer <token>`
  - Query params: `page`, `perPage`, `searchValue`
  - Response: `{ "orders": array, "totalOrders": number }`

- **PUT** `/seller/order-status-update`: Cập nhật trạng thái đơn hàng
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "orderId": "string", "status": "string" }`
  - Response: `{ "message": "string" }`

## Địa chỉ giao hàng (Shipping Address)

- **POST** `/order/shipping-address/add`: Thêm địa chỉ giao hàng mới
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "name": "string", "phone": "string", "address": "string", "city": "string", "district": "string", "ward": "string", "zipCode": "string", "isDefault": boolean }`
  - Response: `{ "message": "string", "address": object }`

- **GET** `/order/shipping-address/get`: Lấy danh sách địa chỉ giao hàng
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "addresses": array }`

- **GET** `/order/shipping-fee/get`: Lấy phí vận chuyển
  - Headers: `Authorization: Bearer <token>`
  - Query params: `district`, `cityId`
  - Response: `{ "shippingFee": number }`

## Thanh toán (Payment)

- **POST** `/payment/stripe`: Thanh toán qua Stripe
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "price": number, "orderId": "string" }`
  - Response: `{ "clientSecret": "string", "stripeInfo": object }`

- **POST** `/payment/create-payment-intent`: Tạo payment intent (Stripe)
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "price": number }`
  - Response: `{ "clientSecret": "string" }`

## Chat và hỗ trợ

- **POST** `/chat/customer/send-message`: Gửi tin nhắn từ khách hàng đến người bán
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "sellerId": "string", "text": "string", "images": [array] }`
  - Response: `{ "message": object }`

- **GET** `/chat/customer/get-sellers`: Lấy danh sách người bán đã trò chuyện với khách hàng
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "sellers": array }`

- **GET** `/chat/customer/get-messages/:sellerId`: Lấy lịch sử tin nhắn với người bán
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ "messages": array }`

- **POST** `/ai-chat/chat`: Gửi tin nhắn đến chatbot AI
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ "prompt": "string" }`
  - Response: `{ "response": "string" }`

## Ghi chú

1. Tất cả các API có header `Authorization: Bearer <token>` đều yêu cầu xác thực.
2. Phản hồi lỗi thường có định dạng: `{ "error": "string" }` với HTTP status code phù hợp.
3. Khi upload file, cần gửi yêu cầu dưới dạng `multipart/form-data`.
4. API hỗ trợ phân trang, tìm kiếm và lọc dữ liệu thông qua query params. 
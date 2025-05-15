# Tài liệu tích hợp thanh toán và đặt hàng cho Backend E-commerce

## 1. Tổng quan hệ thống

Hệ thống thanh toán của backend E-commerce hỗ trợ nhiều phương thức thanh toán, trong đó có:
- Thanh toán khi nhận hàng (COD)
- Thanh toán qua thẻ (Stripe)

## 2. Luồng đặt hàng và thanh toán

```
Tạo đơn hàng -> Chọn phương thức thanh toán -> Xử lý thanh toán -> Xác nhận thanh toán -> Cập nhật trạng thái đơn hàng
```

### 2.1. Đặt hàng

#### Endpoint API:
```
POST /api/order/place-order
```

#### Request Body:
```json
{
  "price": 1000000, // Tổng tiền sản phẩm (chưa bao gồm phí vận chuyển)
  "products": [
    {
      "productId": "productId123",
      "quantity": 2,
      "price": 500000,
      "discount": 0
    }
  ],
  "shippingInfo": {
    "name": "Nguyễn Văn A",
    "phone": "0123456789",
    "address": "123 Đường ABC",
    "province": "Hồ Chí Minh",
    "city": "Quận 1",
    "area": "Phường XYZ",
    "post": "" // Tùy chọn
  },
  "userId": "userId123",
  "paymentMethod": "stripe" // Hoặc "cod"
}
```

#### Response:
```json
{
  "message": "Đặt hàng thành công",
  "orderId": "orderId123",
  "paymentMethod": "stripe",
  "shipping_fee": 40000,
  "totalPrice": 1040000
}
```

### 2.2. Thanh toán qua Stripe

#### Quy trình thanh toán Stripe:
1. Tạo Payment Intent (backend)
2. Hiển thị form thanh toán (frontend)
3. Xác nhận thanh toán (frontend -> Stripe -> backend)
4. Xử lý kết quả thanh toán (backend)

#### A. Tạo Payment Intent:

```
POST /api/payment/create-payment-intent
```

##### Request Body:
```json
{
  "price": 1040000, // Tổng tiền đơn hàng bao gồm phí vận chuyển
  "orderId": "orderId123"
}
```

##### Response:
```json
{
  "clientSecret": "pi_3ROsHXLGiNne9ofS0b1VS35j_secret_IcWnIcQoObMtWzgR9SxzqA70h",
  "paymentIntentId": "pi_3ROsHXLGiNne9ofS0b1VS35j"
}
```

#### B. Xác nhận thanh toán (Từ client):

```
POST /api/order/confirm-client-payment/:orderId
```

##### Request Body:
```json
{
  "paymentIntentId": "pi_3ROsHXLGiNne9ofS0b1VS35j"
}
```

##### Response thành công:
```json
{
  "message": "Xác nhận thanh toán thành công",
  "success": true,
  "order": { ... } // Thông tin đơn hàng
}
```

##### Response lỗi:
```json
{
  "message": "Phiên thanh toán đã hết hạn. Vui lòng tạo một phiên thanh toán mới.",
  "success": false,
  "paymentStatus": "requires_payment_method",
  "requiresNewPaymentIntent": true
}
```

## 3. Trạng thái đơn hàng

### 3.1. Trạng thái thanh toán:
- `unpaid`: Chưa thanh toán (mặc định cho đơn Stripe)
- `pending`: Đang chờ xử lý (mặc định cho đơn COD)
- `paid`: Đã thanh toán

### 3.2. Trạng thái giao hàng:
- `pending`: Chờ xử lý
- `processing`: Đang xử lý
- `shipped`: Đã giao cho đơn vị vận chuyển
- `delivered`: Đã giao hàng
- `cancelled`: Đã hủy

## 4. Xử lý các trường hợp đặc biệt

### 4.1. Phiên thanh toán hết hạn

Khi phiên thanh toán Stripe hết hạn (payment intent ở trạng thái `requires_payment_method`), backend sẽ:
1. Hủy payment intent cũ
2. Tạo payment intent mới

Frontend cần:
- Xử lý lỗi `resource_missing` từ Stripe
- Bắt response có thuộc tính `requiresNewPaymentIntent: true`
- Tạo lại payment intent bằng cách gọi API `create-payment-intent`

### 4.2. Đơn hàng không thanh toán

Đơn hàng sử dụng phương thức Stripe nếu không thanh toán trong vòng 15 phút sẽ tự động bị hủy.

### 4.3. Xác thực 3D Secure

Một số thẻ có thể yêu cầu xác thực 3D Secure, khi đó:
1. Stripe sẽ hiển thị màn hình xác thực
2. Sau khi xác thực, người dùng sẽ được chuyển hướng đến trang xác nhận
3. Frontend cần gửi kết quả thanh toán lên server qua endpoint `/api/order/order-payment-success`

## 5. Các thẻ test Stripe

- Thẻ thành công: `4242 4242 4242 4242`
- Thẻ yêu cầu xác thực (3DS): `4000 0000 0000 3220`
- Thẻ bị từ chối: `4000 0000 0000 0002`
- Ngày hết hạn: Bất kỳ ngày nào trong tương lai
- CVC: Bất kỳ 3 con số nào

## 6. Các lưu ý quan trọng

1. **Đơn vị tiền tệ**: Hệ thống sử dụng VND, không cần nhân với 100 khi gửi lên Stripe (khác với USD)
2. **Xử lý thanh toán hết hạn**: Backend sẽ tự động xử lý các payment intent hết hạn, frontend cần xử lý lỗi và tạo lại payment intent mới
3. **Webhook**: Cấu hình webhook là cần thiết để nhận thông báo từ Stripe về trạng thái thanh toán
4. **Vòng đời đơn hàng**: Đơn hàng không thanh toán trong 15 phút sẽ tự động bị hủy

## 7. Xử lý lỗi phổ biến

1. **No such payment_intent**: Payment intent đã bị hủy hoặc hết hạn, cần tạo mới
2. **Card declined**: Thẻ bị từ chối, người dùng cần sử dụng thẻ khác
3. **Expired card**: Thẻ đã hết hạn
4. **Insufficient funds**: Số dư không đủ
5. **Network error**: Vấn đề kết nối, có thể do ad blocker

## 8. Mã lỗi và cách xử lý

| Mã lỗi | Mô tả | Cách xử lý |
|--------|-------|------------|
| `resource_missing` | Payment intent không tồn tại | Tạo mới payment intent |
| `payment_intent_expired` | Payment intent đã hết hạn | Tạo mới payment intent |
| `card_declined` | Thẻ bị từ chối | Thông báo người dùng sử dụng thẻ khác |
| `expired_card` | Thẻ đã hết hạn | Thông báo người dùng sử dụng thẻ khác |
| `insufficient_funds` | Số dư không đủ | Thông báo người dùng sử dụng thẻ khác |
| `invalid_card_number` | Số thẻ không hợp lệ | Kiểm tra lại thông tin thẻ |
| `invalid_expiry_month` | Tháng hết hạn không hợp lệ | Kiểm tra lại thông tin thẻ |
| `invalid_expiry_year` | Năm hết hạn không hợp lệ | Kiểm tra lại thông tin thẻ |
| `invalid_cvc` | Mã CVC không hợp lệ | Kiểm tra lại thông tin thẻ |

## 9. API Endpoints

### 9.1. Đặt hàng và Thanh toán

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/order/place-order` | Tạo đơn hàng mới |
| POST | `/api/payment/create-payment-intent` | Tạo payment intent Stripe |
| POST | `/api/order/confirm-client-payment/:orderId` | Xác nhận thanh toán từ client |
| GET | `/api/order/order-payment-success` | Xác nhận thanh toán thành công (redirect từ Stripe) |

### 9.2. Quản lý đơn hàng

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/order/get-orders/:customerId/:status` | Lấy danh sách đơn hàng của khách hàng |
| GET | `/api/order/get-order-details/:orderId` | Lấy chi tiết đơn hàng |
| GET | `/api/order/get-customer-dashboard-data/:userId` | Lấy dữ liệu dashboard khách hàng |
| PATCH | `/api/order/order-status-update/:orderId` | Cập nhật trạng thái đơn hàng |

### 9.3. Seller API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/order/get-seller-orders/:sellerId` | Lấy danh sách đơn hàng của seller |
| GET | `/api/order/get-seller-order/:orderId` | Lấy chi tiết đơn hàng của seller |
| PATCH | `/api/order/seller-order-status-update/:orderId` | Cập nhật trạng thái đơn hàng của seller | 
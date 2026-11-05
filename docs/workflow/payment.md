# Workflow: Payment — Thanh toán

> Khi nhận issue liên quan đến thanh toán, giao dịch, hoàn tiền, idempotency → đọc file này.

---

## 📂 Files liên quan

| File | Vai trò |
|------|---------|
| `my-server-mongodb/src/domain/payment.js` | Business logic thuần — validate payment, constants |
| `my-server-mongodb/src/routes/payments.js` | HTTP endpoints thanh toán |
| `my-server-mongodb/src/config/indexes.js` | Index `idempotency_key` unique, `booking_id`, `user_id` |
| `my-server-mongodb/test/payment_catalog.test.js` | Tests payment + catalog |
| `my-server-mongodb/src/middleware/auth.js` | `requireAuth`, `requireRole` dùng trong route |
| `my-server-mongodb/src/utils/http.js` | `wrap`, `fail`, `str` |

---

## 🗄️ Collections MongoDB

| Collection | Mô tả |
|------------|-------|
| `payment_transactions` | Lịch sử giao dịch: PENDING/SUCCESS/FAILED/CANCELLED/REFUNDED |
| `bookings` | Nguồn validate — cần `status = PENDING_PAYMENT`, `final_amount`, `paymentExpiresAt` |

### Schema `payment_transactions`
```js
{
  _id:             ObjectId,
  booking_id:      ObjectId,         // ref: bookings
  user_id:         ObjectId,         // ref: users
  idempotency_key: String,           // unique — client tự sinh
  method:          String,           // CASH | BANK_TRANSFER | MOMO | VNPAY | ZALOPAY | CARD
  amount:          Number,           // integer VNĐ
  status:          String,           // PENDING | SUCCESS | FAILED | CANCELLED | REFUNDED
  created_at:      Date,
  updated_at:      Date,
}
// Indexes: idempotency_key unique; (booking_id, created_at DESC); (user_id, created_at DESC)
```

---

## 🔧 Functions quan trọng

### `src/domain/payment.js`

| Export | Mô tả |
|--------|-------|
| `PAYMENT_STATUSES` | `{PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED}` |
| `PAYMENT_METHODS` | `['CASH','BANK_TRANSFER','MOMO','VNPAY','ZALOPAY','CARD']` |
| `validatePayment({booking, amount, now})` | Trả `{ok, reason}` — kiểm tra BR-E01/E02/E03 |
| `bookingStatusAfterPayment(paymentStatus)` | `SUCCESS→CONFIRMED`, khác→`PENDING_PAYMENT` |

### `src/routes/payments.js`

| Route | Method | Auth | Mô tả |
|-------|--------|------|-------|
| `/api/payments` | POST | requireAuth | Tạo giao dịch (idempotent) |
| `/api/payments/:id/cancel` | POST | requireAuth | Huỷ giao dịch PENDING |
| `/api/payments/booking/:bookingId` | GET | requireAuth | Lịch sử theo booking |
| `/api/payments` | GET | requireRole('ADMIN') | Tất cả giao dịch (paginated) |

---

## 🔄 Luồng xử lý chính

### Tạo thanh toán (POST /api/payments)
```
Body: { bookingId, amount, method, idempotencyKey, status? }
  → validate bookingId (ObjectId.isValid)
  → validate idempotencyKey (bắt buộc, ≤128 ký tự)
  → validate method ∈ PAYMENT_METHODS
  → findOne payment_transactions { idempotency_key } → trả lại cũ nếu tồn tại (idempotent)
  → findOne bookings { _id: bookingId }
  → check ownership (booking.user_id === session.user.id || ADMIN)
  → validatePayment({ booking, amount, now }) → BR-E01/E02/E03
  → insertOne payment_transactions
  → if SUCCESS: updateOne bookings { status: CONFIRMED, paid_at }
  → res 201
```

---

## ✅ Business Rules

| BR | Nội dung | Nơi implement |
|----|----------|---------------|
| BR-E01 | Booking PENDING_PAYMENT mới được thanh toán | `validatePayment` → `BOOKING_NOT_PAYABLE` |
| BR-E02 | Số tiền phải khớp `booking.final_amount` | `validatePayment` → `AMOUNT_MISMATCH` |
| BR-E03 | Phải trong thời hạn hold | `validatePayment` → `HOLD_EXPIRED` |
| — | Idempotent: cùng `idempotencyKey` → trả cũ | `findOne(idempotency_key)` trước khi insert |
| — | Thử lại sau FAILED: booking vẫn PENDING_PAYMENT | `bookingStatusAfterPayment('FAILED')` = PENDING_PAYMENT |

---

## 🔍 Search keywords khi debug

- **Thanh toán 2 lần**: tìm `idempotency_key`, `ALREADY_EARNED`, `idempotent`
- **Amount không khớp**: tìm `AMOUNT_MISMATCH`, `final_amount`, `validatePayment`
- **Hết hạn hold**: tìm `HOLD_EXPIRED`, `paymentExpiresAt`
- **Booking không chuyển CONFIRMED**: tìm `bookingStatusAfterPayment`, `updateOne bookings`
- **403 khi thanh toán**: tìm `booking.user_id`, ownership check

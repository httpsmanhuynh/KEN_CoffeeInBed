# Tech Spec: Payment Transactions

---

## 📌 Business Rules

| BR | Nội dung |
|----|----------|
| BR-E01 | Booking phải ở trạng thái `PENDING_PAYMENT` mới được thanh toán |
| BR-E02 | Số tiền thanh toán phải khớp đúng `booking.final_amount` |
| BR-E03 | Phải thanh toán trong thời hạn hold (`paymentExpiresAt`) |
| — | Idempotent: cùng `idempotencyKey` → trả lại transaction cũ |
| — | FAILED → booking vẫn `PENDING_PAYMENT` (có thể thử lại) |

---

## 🗄️ Schema: `payment_transactions`

```js
{
  _id:             ObjectId,
  booking_id:      ObjectId,         // ref: bookings
  user_id:         ObjectId,         // ref: users (người thanh toán)
  idempotency_key: String,           // unique — client tự sinh (UUID hoặc tương đương)
  method:          'CASH'|'BANK_TRANSFER'|'MOMO'|'VNPAY'|'ZALOPAY'|'CARD',
  amount:          Number,           // integer VNĐ — phải khớp booking.final_amount
  status:          'PENDING'|'SUCCESS'|'FAILED'|'CANCELLED'|'REFUNDED',
  created_at:      Date,
  updated_at:      Date,
}
```

**Indexes:**
```js
{ idempotency_key: 1 }  unique — idempotency chính
{ booking_id: 1, created_at: -1 }
{ user_id:   1, created_at: -1 }
```

---

## 🔄 State diagram: Payment Status

```
           POST /payments (SUCCESS)
PENDING ──────────────────────────► SUCCESS → booking CONFIRMED
   │
   │ POST /payments (FAILED)
   ├──────────────────────────────► FAILED  → booking vẫn PENDING_PAYMENT
   │
   │ POST /:id/cancel
   └──────────────────────────────► CANCELLED

Chú ý: REFUNDED là trạng thái cuối — set thủ công bởi Admin khi hoàn tiền.
```

---

## 📡 API

| Method | Path | Auth | Body / Query |
|--------|------|------|-------------|
| POST | `/api/payments` | requireAuth | `{bookingId, amount, method, idempotencyKey, status?}` |
| POST | `/api/payments/:id/cancel` | requireAuth | — |
| GET | `/api/payments/booking/:bookingId` | requireAuth | — |
| GET | `/api/payments` | requireRole('ADMIN') | `?status=&page=&limit=` |

---

## ⚠️ Known Limitations & TODO

| Item | Priority |
|------|----------|
| `/earn` trong loyalty chưa check ownership của booking | High |
| REFUNDED chưa có route — phải update thủ công | Medium |
| Payment gateway thật (VNPAY/MoMo) chưa tích hợp — đang mock status | Low |

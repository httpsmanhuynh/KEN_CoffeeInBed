# Backend Rules — Quy tắc Code bắt buộc

> Áp dụng cho toàn bộ `my-server-mongodb/`. Mọi PR phải pass checklist này.

---

## 1. Input Validation & Sanitization

```js
// LUÔN dùng str() cho string từ req.body — chặn NoSQL injection
const phone = str(req.body.phone);       // ✅
const phone = req.body.phone;            // ❌ có thể là object

// LUÔN validate ObjectId trước khi dùng
if (!ObjectId.isValid(id)) return fail(res, 422, ...);  // ✅
new ObjectId(req.body.id)               // ❌ throw nếu invalid
```

---

## 2. Tiền VNĐ luôn là Integer

```js
// ✅ Đúng
const n = Math.floor(finalAmount / 10000);
assertMoney(packagePrice); // Number.isInteger && >= 0

// ❌ Sai
const price = 100000.5;
const discount = amount * 0.1; // → float, phải Math.floor()
```

---

## 3. Async Route phải dùng `wrap()`

```js
// ✅ Lỗi được forward về error handler chung
router.post('/earn', requireAuth, wrap(async (req, res) => { ... }));

// ❌ Lỗi async không được catch → server crash
router.post('/earn', requireAuth, async (req, res) => { ... });
```

---

## 4. Error Response nhất quán

```js
// LUÔN dùng fail() — không tự res.json() error
return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');   // ✅
return res.status(404).json({ error: 'not found' });                  // ❌ format khác nhau
```

---

## 5. Idempotent — Check trước Insert

```js
// ✅ Check tồn tại trước → trả lỗi rõ ràng
const existing = await db.collection('loyalty_transactions').findOne({ booking_id, type: 'EARN' });
if (existing) return fail(res, 409, 'ALREADY_EARNED', '...');
await db.collection('loyalty_transactions').insertOne(...);

// ❌ Chỉ dựa vào unique index → lỗi DB khó debug, message không friendly
```

---

## 6. MongoDB: ObjectId khi query `_id`

```js
// ✅
db.collection('users').findOne({ _id: new ObjectId(userId) });

// ❌ MongoDB sẽ không match — _id là ObjectId, không phải string
db.collection('users').findOne({ _id: userId });
```

---

## 7. Auth Middleware Order

```js
// Thứ tự chuẩn trong route
router.post('/earn',
  requireAuth,      // 1. Có session không?
  requireRole('ADMIN'), // 2. Đúng role không? (nếu cần)
  wrap(async ...)   // 3. Handler
);
```

---

## 8. Session Security

```js
// SAU KHI xác thực xong MỚI gọi startSession
await startSession(req, user);  // tự regenerate session ID

// KHÔNG gán trực tiếp
req.session.user = { id: user._id }; // ❌ session fixation risk
```

---

## 9. Rate Limit — Gắn trực tiếp từng route

```js
// ✅ Gắn per-route — tránh đếm đôi khi mount kép
router.post('/login', ipLimiter, loginLimiter, wrap(...));

// ❌ router.use(ipLimiter) — đếm 2x nếu router mount ở 2 path
```

---

## 10. Test phải chạy pass trước commit

```bash
# Chạy trong my-server-mongodb/
node --test test/*.test.js

# Phải: 0 fail, 0 cancelled
```

---

## 11. Dead Code & Import

- Không để `console.log` debug trong production code
- Không import module không dùng
- Không có hàm/biến khai báo nhưng không dùng
- Comment cũ sai phải xóa hoặc cập nhật

---

## 12. Partial Index cho Unique Constraint linh hoạt

```js
// Unique chỉ khi field tồn tại (booking_id không phải lúc nào cũng có)
db.collection('loyalty_transactions').createIndex(
  { booking_id: 1, type: 1 },
  { unique: true, partialFilterExpression: { booking_id: { $exists: true } } }
);
```

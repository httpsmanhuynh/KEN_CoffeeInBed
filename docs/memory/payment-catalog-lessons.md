# Memory: Payment & Catalog — Bài học & Gotcha

---

## 🐛 Payment Gotcha

### 1. `paymentExpiresAt` có thể là Date object hoặc số (ms)
**Triệu chứng**: `validatePayment` cho `ok: false` dù chưa hết hạn khi field là `Date`.  
**Nguyên nhân**: So sánh `now >= booking.paymentExpiresAt` — nếu là `Date` thì JS tự ép kiểu, nhưng dễ nhầm.  
**Fix**: Luôn convert về ms:
```js
const expiresAt = booking.paymentExpiresAt instanceof Date
  ? booking.paymentExpiresAt.getTime()
  : Number(booking.paymentExpiresAt);
```

### 2. Idempotency conflict cần kiểm tra bookingId
**Triệu chứng**: Hai booking khác nhau vô tình dùng cùng `idempotencyKey` → tạo giao dịch sai booking.  
**Fix**: Khi tìm thấy key cũ, so sánh `existing.booking_id` với `bookingId` request:
```js
if (String(existing.booking_id) !== String(new ObjectId(bookingId)))
  return fail(res, 409, 'IDEMPOTENCY_CONFLICT', '...');
```

### 3. Booking vẫn PENDING_PAYMENT sau FAILED — đúng spec
**Mô tả**: Nhiều người nghĩ FAILED → booking bị khoá. Thực ra booking vẫn `PENDING_PAYMENT` để customer thử lại.  
**Lesson**: `bookingStatusAfterPayment('FAILED') = 'PENDING_PAYMENT'` — không update booking khi FAILED.

### 4. Ownership check: booking.user_id vs session.user.id
**Mô tả**: Route `/earn` trong loyalty không check ownership — bất kỳ user nào cũng gọi được.  
**Fix trong payments**: Check `booking.user_id !== session.user.id` và trả 403 nếu không phải ADMIN.  
**TODO**: Cần backport check này vào `/api/loyalty/earn`.

---

## 🐛 Catalog Gotcha

### 5. camelCase từ body → snake_case trong MongoDB
**Triệu chứng**: PATCH gửi `minGuests` nhưng DB lưu field `min_guests` → không update được.  
**Fix pattern**:
```js
if ('minGuests' in set) { set.min_guests = set.minGuests; delete set.minGuests; }
if ('unitPrice' in set) { set.unit_price = set.unitPrice; delete set.unitPrice; }
```
**Lesson**: Luôn map camelCase → snake_case trước khi `$set`.

### 6. `pick()` bắt buộc — không dùng spread `...req.body`
**Mô tả**: `$set: req.body` → user có thể inject field tùy ý (`_id`, `created_at`, field bí mật).  
**Fix**: Luôn dùng `pick(req.body, whitelist)`:
```js
const set = pick(req.body, ['name', 'description', 'status']); // chỉ 3 field này
```

### 7. Soft delete vs Hard delete
| Collection | Kiểu delete | Lý do |
|------------|------------|-------|
| zones, spaces, packages, addons, products | Soft (INACTIVE) | Có foreign key từ bookings |
| space_pricing, recipes | Hard (deleteOne) | Không có booking reference |

### 8. Admin thấy INACTIVE, Customer/Public không thấy
**Pattern**:
```js
// Customer/public: chỉ ACTIVE
const filter = req.session?.user?.role === 'ADMIN' ? {} : { status: 'ACTIVE' };
```
**Lesson**: Check `req.session?.user` với optional chaining vì public route không có auth.

### 9. `assertMoney` throw với `status: 422` để route bắt được
```js
function assertMoney(v, name) {
  if (!Number.isInteger(v) || v < 0)
    throw Object.assign(new Error(`${name}...`), { status: 422 });
}
// Route:
try { assertMoney(unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, ...); }
```

### 10. pre-existing test `auth.test.js` thiếu `pwdAt`
**Mô tả**: `startSession` lưu `{id, role, pwdAt}` nhưng test cũ chỉ assert `{id, role}`.  
**Fix**: Cập nhật assert thêm `pwdAt: 0` (user không có `password_changed_at`).

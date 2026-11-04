# Memory: Loyalty — Bài học & Gotcha

> Những điều đã gặp phải khi implement hệ thống Loyalty. Đọc trước khi sửa code liên quan.

---

## 🐛 Gotcha đã gặp

### 1. `ObjectId` không tự có trong test file
**Triệu chứng**: `ReferenceError: ObjectId is not defined` trong test  
**Nguyên nhân**: Quên import — `ObjectId` không phải global trong Node.js  
**Fix**:
```js
const { ObjectId } = require('mongodb'); // phải require rõ ràng
```
**Lesson**: Mọi file test dùng `ObjectId` đều phải require từ `mongodb`.

---

### 2. `insertOne` trong mock không throw khi duplicate nếu không implement
**Triệu chứng**: Test "không cộng điểm 2 lần" pass nhưng logic sai  
**Nguyên nhân**: Mock collection không implement duplicate check  
**Fix**: Mock phải simulate unique index check theo `(booking_id, type)`:
```js
insertOne(doc) {
  const dup = docs.find(d => String(d.booking_id) === String(doc.booking_id) && d.type === doc.type);
  if (dup) { const e = new Error('dup'); e.code = 11000; return Promise.reject(e); }
  docs.push(doc);
  return Promise.resolve({});
}
```

---

### 3. Race condition tiềm ẩn trong `/earn`
**Triệu chứng**: Hai request đồng thời cho cùng `bookingId` đều pass qua `findOne` check trước khi `insertOne`  
**Hiện trạng**: Được bảo vệ bởi unique index `(booking_id, type)` ở DB — request thứ 2 sẽ bị MongoDB reject với code 11000  
**Lesson**: Check trước + unique index là "defense in depth" — cả hai cần thiết.  
**TODO**: Route `/earn` nên bắt lỗi `code 11000` từ `insertOne` và trả `409 ALREADY_EARNED`.

---

### 4. `year-rollover` không dùng transaction MongoDB
**Triệu chứng**: Nếu server crash giữa chừng, một số user bị rollover còn số khác chưa  
**Hiện trạng**: Chạy tuần tự qua vòng for — nếu crash → partial update  
**Lesson**: Với rollover hàng loạt, cần bulk write hoặc đánh dấu từng user đã xử lý.  
**TODO**: Thêm field `last_rollover_year` vào `users` để idempotent khi chạy lại.

---

### 5. `final_amount = 0` vẫn gọi được `/earn`
**Triệu chứng**: Booking miễn phí hoặc booking bị discount 100% → `earn(0)` = 0 điểm, nhưng vẫn tạo transaction  
**Hiện trạng**: Hành vi hợp lệ — tạo transaction 0 điểm để ghi lịch sử  
**Lesson**: Không cần filter — `earnFromAmount(0)` trả `{points: 0, coins: 0}` đúng spec.

---

## 📐 Pattern đúng đã dùng

### Idempotent EARN
```js
// 1. Check TRƯỚC khi tính toán
const existing = await db.collection('loyalty_transactions').findOne({
  booking_id: new ObjectId(bookingId),
  type: 'EARN',
});
if (existing) return fail(res, 409, 'ALREADY_EARNED', '...');

// 2. Unique index làm lớp bảo vệ thứ hai
// { booking_id: 1, type: 1 } unique với partialFilterExpression
```

### Ghi cả transactions + histories
```
loyalty_transactions → giao dịch (EARN/REDEEM/EXPIRE)
loyalty_histories    → snapshot trước/sau (audit trail đầy đủ)
```
Luôn ghi **cả hai** — đừng bỏ 1 cái.

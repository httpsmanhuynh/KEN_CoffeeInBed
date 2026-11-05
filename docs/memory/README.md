# Memory Index — Bài học & Gotcha

> Những sai lầm, surprise, hoặc pattern không rõ ràng đã gặp. Đọc trước khi bắt tay vào feature liên quan.

---

## 📋 Danh sách bài học

| Feature | File | Tóm tắt |
|---------|------|---------|
| Loyalty | [loyalty-lessons.md](loyalty-lessons.md) | Idempotent earn, ObjectId trong test, race condition |
| Auth | [auth-lessons.md](auth-lessons.md) | DUMMY_HASH timing, session regenerate, pwdStamp |
| Payment & Catalog | [payment-catalog-lessons.md](payment-catalog-lessons.md) | Idempotency conflict, camelCase→snake_case, soft/hard delete, pick() |

---

## ⚡ Top gotcha hay gặp nhất

1. **ObjectId trong test**: Phải `require('mongodb').ObjectId` — không tự có global.
2. **Tiền VNĐ luôn integer**: Dùng `Math.floor()`, không dùng float.
3. **Session cũ bị revoke**: `pwdStamp` trong session phải khớp DB — đổi mật khẩu → session khác bị kick.
4. **Unique index partial**: Loyalty transaction dùng `partialFilterExpression` để index chỉ áp dụng khi `booking_id` tồn tại.

# Principle Index — Quy tắc Code bắt buộc

> Mọi AI Agent và developer **phải tuân thủ** các quy tắc này. Cập nhật khi phát hiện pattern mới.

---

## 📋 Danh sách quy tắc

| File | Phạm vi | Nội dung chính |
|------|---------|----------------|
| [backend-rules.md](backend-rules.md) | Backend Express/MongoDB | Validation, error handling, auth, idempotent |

---

## 🔑 Quy tắc nhanh (Top 10)

1. **Tiền VNĐ = integer** — Không bao giờ float.
2. **ObjectId khi query `_id`** — Không dùng string.
3. **`str()` cho mọi input từ body** — Chặn NoSQL injection.
4. **`wrap()` cho mọi async route** — Catch lỗi về error handler chung.
5. **Idempotent trước khi insert** — Check tồn tại trước, không dựa vào lỗi DB.
6. **Unique index với `partialFilterExpression`** — Khi field không phải lúc nào cũng có.
7. **Session regenerate sau login** — Chống session fixation.
8. **`pwdStamp` trong session** — Thu hồi session cũ khi đổi mật khẩu.
9. **Rate limit theo user + IP** — Không chỉ theo IP.
10. **Test chạy pass trước commit** — `node --test test/*.test.js`.

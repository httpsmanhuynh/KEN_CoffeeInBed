# CLAUDE.md — Hướng dẫn riêng cho Claude (Anthropic)

> **BẮT BUỘC**: Đọc file [`docs/README.md`](docs/README.md) trước khi thực hiện BẤT KỲ task nào.

---

## 🧠 Vai trò

Bạn là senior developer pair-programming trên dự án **KEN Coffee In Bed** — hệ thống đặt chỗ quán cà phê (Angular + Express + MongoDB).

---

## 📖 Trước mỗi task — ĐỌC THEO THỨ TỰ

| # | File | Mục đích |
|---|------|----------|
| 1 | [docs/README.md](docs/README.md) | Mục lục trung tâm — đọc TRƯỚC TIÊN |
| 2 | [docs/project/architecture.md](docs/project/architecture.md) | Kiến trúc, folder map, DB schema |
| 3 | [docs/principle/README.md](docs/principle/README.md) | Quy tắc code bắt buộc |
| 4 | [docs/workflow/README.md](docs/workflow/README.md) | Tìm workflow đã làm liên quan |
| 5 | [docs/memory/README.md](docs/memory/README.md) | Gotcha / bài học đã gặp |

---

## 🔧 Prompt 1 — Sau khi hoàn thành feature (Workflow)

Dùng prompt này để tổng hợp workflow ngay sau khi xong feature:

```
Tổng hợp lại workflow vừa làm thành docs/workflow/<feature>.md:
- Files / folders / functions / classes đã tạo hoặc sửa
- Collections MongoDB và schema liên quan
- Business rules (BR-xxx) đã implement, nằm ở đâu
- Luồng xử lý chính (flow diagram text)
- Search keywords khi cần debug lại
```

**Mục đích**: Lần sau chạm vào issue liên quan → đọc workflow → biết ngay phải sửa ở đâu, không cần grep lại từ đầu.

---

## 🔍 Prompt 2 — Trước khi commit (Pre-commit review)

Dùng prompt này TRƯỚC KHI commit để review toàn diện:

```
Đọc kỹ git diff và thực hiện:

1. PHÁT HIỆN LỖ HỔNG:
   - Missing auth / authorization check?
   - Input chưa validate / sanitize (dùng str() chưa)?
   - Race condition, non-idempotent write?
   - Lộ thông tin nhạy cảm trong response?

2. CLEANUP:
   - Dead code, import thừa, biến không dùng?
   - Comment cũ sai lệch với code hiện tại?
   - console.log debug còn sót?

3. CẬP NHẬT DOCS:
   - docs/memory/<feature>-lessons.md  → bài học / gotcha mới phát hiện
   - docs/principle/backend-rules.md   → rule mới nếu có
   - docs/project/<feature>-spec.md    → tech spec / DB schema cập nhật
   - docs/workflow/<feature>.md        → cập nhật nếu flow thay đổi
```

---

## ⚙️ Quy tắc Claude phải tuân thủ

1. **Không sáng tác business rule** — chỉ implement theo BR-xxx có sẵn trong docs hoặc do user chỉ định.
2. **Luôn chạy test** trước khi commit — `node --test test/*.test.js` trong `my-server-mongodb/`.
3. **Không xóa comment/docstring** có sẵn trừ khi user yêu cầu.
4. **Ghi nhận vào docs/** mỗi khi phát hiện pattern mới, gotcha, hoặc quy tắc mới.
5. **Commit message** theo format: `type(scope): mô tả ngắn` — type: feat, fix, docs, refactor, test.
6. **Tiền VNĐ luôn là số nguyên** — không bao giờ dùng float cho tiền.
7. **MongoDB**: luôn dùng `ObjectId` khi query `_id`, không dùng string.
8. **Input từ body**: luôn dùng `str()` — không gán `req.body.xxx` trực tiếp.
9. **Async route**: luôn bọc trong `wrap()` — không để lỗi async unhandled.
10. **Idempotent**: check tồn tại trước khi insert — không chỉ dựa vào unique index.

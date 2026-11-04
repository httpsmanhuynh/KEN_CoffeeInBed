# 📚 KEN Coffee In Bed — Docs Hub

> **Mục đích**: Đây là bản đồ trung tâm cho toàn bộ tài liệu dự án.  
> AI Agent (Claude, Cursor, Copilot…) và developer **BẮT BUỘC đọc file này trước** khi bắt tay vào bất kỳ task nào.

---

## 📂 Cấu trúc thư mục

```
docs/
├── README.md                      ← BẠN ĐANG Ở ĐÂY — Mục lục & hướng dẫn
│
├── workflow/                      ← Quy trình từng feature/issue đã làm
│   ├── README.md                  ← Index tất cả workflow
│   ├── auth.md                    ← Đăng ký, login, 2FA, session, OTP
│   └── loyalty.md                 ← Hạng thành viên, Điểm, Coins, rollover
│
├── memory/                        ← Bài học, gotcha, sai lầm đã gặp
│   ├── README.md                  ← Index + top gotcha
│   ├── auth-lessons.md            ← DUMMY_HASH, session fixation, pwdStamp, ...
│   └── loyalty-lessons.md         ← ObjectId trong test, race condition, idempotent, ...
│
├── principle/                     ← Quy tắc code bắt buộc
│   ├── README.md                  ← Index + top 10 rules
│   └── backend-rules.md           ← 12 quy tắc backend Express/MongoDB
│
└── project/                       ← Tech specs, kiến trúc, DB schema
    ├── README.md                  ← Index + tech stack nhanh
    ├── architecture.md            ← Folder map, DB schema đầy đủ, API list
    └── loyalty-spec.md            ← Spec chi tiết hệ thống Loyalty
```

---

## 🔑 Quy tắc cho AI Agent

| Thời điểm | Việc cần làm |
|-----------|-------------|
| **Bắt đầu task** | Đọc `docs/workflow/README.md` → tìm workflow liên quan |
| **Chưa có workflow** | Tìm hiểu codebase → tạo `docs/workflow/<feature>.md` sau khi xong |
| **Gặp bug lạ** | Đọc `docs/memory/README.md` → xem đã có ai gặp chưa |
| **Trước khi code** | Đọc `docs/principle/backend-rules.md` → đảm bảo đúng pattern |
| **Trước khi commit** | Chạy `git diff` → review lỗ hổng → cập nhật docs/ nếu cần |
| **Sau khi commit** | Ghi bài học vào `docs/memory/`, spec vào `docs/project/` |

---

## 🗺️ Quick Navigation

| Bạn muốn... | Đọc file |
|-------------|----------|
| Hiểu kiến trúc tổng thể, folder map, DB schema | [project/architecture.md](project/architecture.md) |
| Spec chi tiết hệ thống Loyalty | [project/loyalty-spec.md](project/loyalty-spec.md) |
| Tìm files/functions liên quan đến Auth | [workflow/auth.md](workflow/auth.md) |
| Tìm files/functions liên quan đến Loyalty | [workflow/loyalty.md](workflow/loyalty.md) |
| Tránh lỗi đã gặp trong Loyalty | [memory/loyalty-lessons.md](memory/loyalty-lessons.md) |
| Tránh lỗi đã gặp trong Auth | [memory/auth-lessons.md](memory/auth-lessons.md) |
| Kiểm tra quy tắc code trước commit | [principle/backend-rules.md](principle/backend-rules.md) |

---

## 📝 Prompt mẫu cho AI Agent

### Prompt 1 — Sau khi hoàn thành feature (tạo workflow)

```
Tổng hợp lại workflow vừa làm thành docs/workflow/<feature>.md:
- Files / folders / functions / classes đã tạo hoặc sửa
- Collections MongoDB và schema liên quan
- Business rules (BR-xxx) đã implement, nằm ở đâu
- Luồng xử lý chính (flow diagram text)
- Search keywords khi cần debug lại
```

### Prompt 2 — Trước khi commit (pre-commit review)

```
Đọc kỹ git diff và thực hiện:

1. PHÁT HIỆN LỖ HỔNG:
   - Missing auth / authorization check?
   - Input chưa validate / sanitize?
   - Race condition, non-idempotent?
   - Lộ thông tin nhạy cảm?

2. CLEANUP:
   - Dead code, import thừa, biến không dùng?
   - Comment cũ sai lệch với code?

3. CẬP NHẬT DOCS:
   - docs/memory/<feature>-lessons.md  → bài học / gotcha mới
   - docs/principle/backend-rules.md   → rule mới nếu có
   - docs/project/<feature>-spec.md    → tech spec / DB schema
   - docs/workflow/<feature>.md        → cập nhật nếu flow thay đổi
```

# AGENTS.md — Hướng dẫn cho AI Agent (Cursor, Copilot, Gemini, v.v.)

> **BẮT BUỘC**: Đọc file [`docs/README.md`](docs/README.md) trước khi thực hiện BẤT KỲ task nào.

---

## 📖 Trước khi bắt đầu

1. Đọc **[docs/README.md](docs/README.md)** — mục lục trung tâm của dự án.
2. Đọc **[docs/project/architecture.md](docs/project/architecture.md)** — hiểu kiến trúc, cấu trúc thư mục, DB schema.
3. Đọc **[docs/principle/README.md](docs/principle/README.md)** — danh sách quy tắc bắt buộc.

## 🔍 Khi nhận task mới

1. Tìm trong **[docs/workflow/README.md](docs/workflow/README.md)** xem đã có workflow liên quan chưa.
   - Nếu có → đọc file workflow đó để biết **files / functions / classes** nằm ở đâu.
   - Nếu chưa → tìm hiểu codebase, rồi **tạo workflow mới** khi hoàn thành.
2. Đọc **[docs/memory/README.md](docs/memory/README.md)** — xem có gotcha / bài học nào liên quan.

## ✅ Trước khi commit

1. Chạy `git diff --cached` hoặc `git diff` — review kỹ mọi thay đổi.
2. Kiểm tra theo **[docs/principle/backend-rules.md](docs/principle/backend-rules.md)**:
   - Không có dead code / import thừa?
   - Idempotent? Race condition?
   - Validation đầu vào đầy đủ?
   - Error handling nhất quán?
3. Cập nhật docs nếu có phát hiện mới:
   - `docs/memory/<feature>-lessons.md` — bài học rút ra.
   - `docs/principle/*.md` — quy tắc mới.
   - `docs/project/<feature>-spec.md` — tech spec nếu phức tạp.
4. Ghi workflow: `docs/workflow/<feature>.md` — quy trình đã làm.

## 📂 Cấu trúc docs

```
docs/
├── README.md              ← Đọc đầu tiên
├── workflow/*.md           ← Quy trình từng feature (search map)
├── memory/*.md             ← Bài học, gotcha, sai lầm
├── principle/*.md          ← Quy tắc code bắt buộc
└── project/*.md            ← Tech specs, kiến trúc, DB schema
```

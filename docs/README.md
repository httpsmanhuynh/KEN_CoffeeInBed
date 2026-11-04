# 📚 KEN Coffee In Bed — Docs Hub

> **Mục đích**: Đây là bản đồ trung tâm cho toàn bộ tài liệu dự án. AI Agent (Claude, Cursor, Copilot…) và developer **BẮT BUỘC đọc file này trước** khi bắt tay vào bất kỳ task nào.

---

## 📂 Cấu trúc thư mục

```
docs/
├── README.md              ← BẠN ĐANG Ở ĐÂY — Mục lục & hướng dẫn
├── workflow/              ← Quy trình từng feature/issue đã làm
│   ├── README.md          ← Index các workflow
│   └── loyalty.md         ← Ví dụ: Hệ thống Loyalty
├── memory/                ← Bài học, gotcha, sai lầm đã gặp
│   ├── README.md
│   └── loyalty-lessons.md
├── principle/             ← Quy tắc code & thiết kế bắt buộc
│   ├── README.md
│   └── backend-rules.md
└── project/               ← Tech specs, kiến trúc, DB schema
    ├── README.md
    ├── architecture.md
    └── loyalty-spec.md
```

---

## 🔑 Quy tắc cho AI Agent

1. **Đọc `docs/README.md` (file này) trước tiên** — để biết tổng quan.
2. **Trước khi code feature mới** → đọc `docs/workflow/README.md` để tìm workflow liên quan.
3. **Trước khi commit** → đọc `docs/principle/README.md` để kiểm tra quy tắc.
4. **Khi gặp bug lạ** → đọc `docs/memory/README.md` để xem đã có ai gặp chưa.
5. **Khi cần hiểu kiến trúc** → đọc `docs/project/README.md`.

---

## 🗺️ Quick Navigation

| Bạn muốn...                        | Đọc file                                   |
|-------------------------------------|---------------------------------------------|
| Hiểu kiến trúc tổng thể            | [project/architecture.md](project/architecture.md) |
| Biết business rules (BR-xxx)        | [project/loyalty-spec.md](project/loyalty-spec.md) |
| Xem quy trình đã làm feature nào   | [workflow/README.md](workflow/README.md)    |
| Tìm gotcha / bài học kinh nghiệm   | [memory/README.md](memory/README.md)        |
| Kiểm tra quy tắc code              | [principle/README.md](principle/README.md)  |

---

## 🏗️ Cách bổ sung tài liệu

### Khi hoàn thành 1 feature/issue:
```
docs/workflow/<tên-feature>.md    ← Ghi lại flow đã tìm/làm
docs/memory/<tên-feature>-lessons.md ← Ghi bài học rút ra
docs/project/<tên-feature>-spec.md   ← Ghi tech spec nếu phức tạp
```

### Khi phát hiện quy tắc mới:
```
docs/principle/<chủ-đề>.md       ← Thêm rule mới
```

### Khi commit:
Chạy review diff → cập nhật `docs/memory/` và `docs/principle/` nếu có phát hiện mới.

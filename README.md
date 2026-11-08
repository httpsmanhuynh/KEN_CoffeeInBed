# ☕ KÉN - Coffee In Bed
> Hệ thống Website & Dịch vụ Phòng nghỉ tích hợp Đặt món trực tuyến.

---

## 🧭 Mục lục điều hướng nhanh cho Lead & Reviewer

Kho lưu trữ trên nhánh **`mhung`** được tổ chức thành **3 nhóm chức năng chính** để dễ dàng tra cứu, kiểm thử và quản lý:

```
KEN_CoffeeInBed/
├── ⚙️ my-server-mongodb/         # NHÓM 1: MÃ NGUỒN BACKEND (5 MODULE)
│   ├── src/routes/              # API Endpoints
│   ├── src/domain/              # Domain logic & Business Rules
│   ├── src/services/            # Services (OTP, ...)
│   ├── src/middleware/          # Auth, Rate limit
│   └── test/                    # Test backend trực tiếp với MongoDB
│
├── 🧪 ken-tests/                # NHÓM 2: BỘ CODE TEST AUTO & EXCEL
│   ├── tests/integration/       # Test API tự động (Admin, Catalog, Payment)
│   ├── tests/unit/              # Test Unit validators
│   ├── src/                     # Mock server & Validators độc lập
│   ├── tools/                   # Script Python sinh Test Case Excel
│   └── KEN_TestCase_*.xlsx      # 3 File Excel Test Case chi tiết
│
├── 📮 postman/                  # NHÓM 3: TEST POSTMAN
│   ├── KEN_Postman_Runner_Collection.json      # Runner chạy toàn bộ test
│   ├── KEN_Environment.postman_environment.json # Biến môi trường Postman
│   └── collections/             # 7 Thư mục Collection chia theo module
│
├── 📚 docs/                     # Tài liệu kiến trúc, workflow, memory
└── 🖥️ src/                      # Frontend Angular
```

---

## 📊 Bảng tổng hợp ánh xạ 5 Module

| Module | ⚙️ Backend Code (`my-server-mongodb`) | 🧪 Test Auto (`ken-tests` & `test/`) | 📮 Postman Collection (`postman/collections/`) | 📋 Test Case Excel (`ken-tests/`) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Auth & Profile** | `src/routes/auth.js`<br>`src/routes/profile.js`<br>`src/services/otp.js`<br>`src/middleware/auth.js` | `my-server-mongodb/test/auth.test.js` | `KÉN - Module 01- Authentication & Authorization (195 TCs)` | `KEN_TestCase_Admin.xlsx` *(Sheet Auth/RBAC)* |
| **2. Loyalty (Thành viên)** | `src/routes/loyalty.js`<br>`src/domain/loyalty.js` | `my-server-mongodb/test/loyalty.test.js` | `KÉN - Module 09- Loyalty Management (20 TCs)` | `KEN_TestCase_Admin.xlsx` *(Sheet Loyalty)* |
| **3. Payment (Thanh toán)** | `src/routes/payments.js`<br>`src/domain/payment.js` | `ken-tests/tests/integration/payment.api.test.js`<br>`my-server-mongodb/test/payment_catalog.test.js` | Có trong runner `KEN_Postman_Runner_Collection.json` | `KEN_TestCase_Payment.xlsx` |
| **4. Catalog & Admin CRUD** | `src/routes/catalog.js`<br>`src/domain/pricing.js` | `ken-tests/tests/integration/catalog.api.test.js`<br>`ken-tests/tests/unit/catalog.validators.test.js` | `KÉN - Module 06- Pricing Engine (18 TCs)` | `KEN_TestCase_Catalog.xlsx` |
| **5. Booking & Quản trị Admin** | `src/domain/bookingStateMachine.js`<br>`src/domain/availability.js` | `ken-tests/tests/integration/admin.api.test.js`<br>`my-server-mongodb/test/domain.test.js` | `KÉN - Module 05- Booking Management (38 TCs)`<br>`KÉN - Module 13- System Config (29 TCs)` | `KEN_TestCase_Admin.xlsx` |

---

## 🚀 Hướng dẫn khởi chạy & kiểm thử cho Lead

### 1. Khởi chạy Backend (`my-server-mongodb`)
```bash
cd my-server-mongodb
npm install
npm run setup     # Tạo MongoDB indexes
npm start         # Chạy backend tại http://localhost:3000 (nodemon)
```

### 2. Chạy Bộ Test Auto (`ken-tests`)
Bộ test độc lập bằng `node:test`, không cần MongoDB live, chạy siêu nhanh (120/120 pass):
```bash
cd ken-tests
npm test                # Chạy toàn bộ 120 test cases unit + integration
npm run test:admin      # Test riêng module Admin
npm run test:payment    # Test riêng module Payment
npm run test:coverage   # Báo cáo độ bao phủ kiểm thử
```

Nếu muốn chạy test tích hợp trực tiếp MongoDB backend:
```bash
cd my-server-mongodb
npm test                # Chạy test suite node:test trực tiếp với MongoDB
```

### 3. Kiểm thử với Postman (`postman`)
1. Mở ứng dụng **Postman**.
2. Chọn **Import**:
   - File môi trường: `postman/KEN_Environment.postman_environment.json`.
   - File collection tổng: `postman/KEN_Postman_Runner_Collection.json`.
   - Hoặc import các collection chi tiết từng module trong thư mục `postman/collections/`.
3. Chọn môi trường `KÉN Environment` và chạy qua **Collection Runner**.

---

## 📑 Tài liệu chi tiết khác
- **Kiến trúc & DB Schema:** [docs/project/architecture.md](docs/project/architecture.md)
- **Quy tắc Backend:** [docs/principle/backend-rules.md](docs/principle/backend-rules.md)
- **Workflows từng chức năng:** [docs/workflow/README.md](docs/workflow/README.md)

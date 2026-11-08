# ☕ KÉN - Coffee In Bed
> Hệ thống Website & Dịch vụ Phòng nghỉ tích hợp Đặt món trực tuyến.

---

## 🧭 Mục lục điều hướng 5 Module Cốt Lõi (Modules 2, 3, 4, 7, 9)

Kho lưu trữ trên nhánh **`mhung`** tập trung toàn bộ mã nguồn, kịch bản kiểm thử tự động và tài liệu cho **5 Module cốt lõi** theo yêu cầu:

```
KEN_CoffeeInBed/
├── ⚙️ my-server-mongodb/         # NHÓM 1: MÃ NGUỒN BACKEND & TEST
│   ├── src/routes/              # catalog.js, payments.js, loyalty.js...
│   ├── src/domain/              # pricing.js, payment.js, loyalty.js...
│   └── test/                    # Test backend trực tiếp với MongoDB
│
├── 🧪 ken-tests/                # NHÓM 2: BỘ CODE TEST AUTO & EXCEL
│   ├── tests/integration/       # Test API tự động (Catalog, Payment, Admin)
│   ├── tests/unit/              # Test Unit validators & domain rules
│   └── KEN_TestCase_5_Modules.xlsx # File Excel Test Case chi tiết 5 module (153 TCs)
│
├── 📮 postman/                  # NHÓM 3: TEST POSTMAN (5 MODULES 2, 3, 4, 7, 9)
│   ├── KEN_Postman_Runner_Collection.json      # Runner chạy tự động 5 module
│   ├── KEN_Environment.postman_environment.json # Biến môi trường Postman
│   └── collections/             # 5 Thư mục Collection đúng chuẩn cho 5 Module:
│       ├── KÉN - Module 02- Space & Zone Management (42 TCs)
│       ├── KÉN - Module 03- Package & Inclusion Management (40 TCs)
│       ├── KÉN - Module 04- Add-on & Product Management (30 TCs)
│       ├── KÉN - Module 07- Payment Management (22 TCs)
│       └── KÉN - Module 09- Loyalty Management (20 TCs)
│
├── 📚 docs/                     # Tài liệu kiến trúc, workflow
└── 🖥️ src/                      # Frontend Angular
```

---

## 📊 Bảng tổng hợp ánh xạ 5 Module (2, 3, 4, 7, 9)

| Module | ⚙️ Backend Code (`my-server-mongodb`) | 🧪 Test Auto (`ken-tests` & `test/`) | 📮 Postman Collection (`postman/collections/`) | 📋 Test Case Excel (`KEN_TestCase_5_Modules.xlsx`) |
| :--- | :--- | :--- | :--- | :--- |
| **Module 02: Space & Zone Management** | `src/routes/catalog.js`<br>`src/models/zone.js`<br>`src/models/space.js` | `ken-tests/tests/integration/catalog.api.test.js`<br>`my-server-mongodb/test/payment_catalog.test.js` | `KÉN - Module 02- Space & Zone Management (42 TCs)` | Sheet: `2. Space & Zone`<br>(42 TCs: `TC-SZ-001` → `TC-SZ-042`) |
| **Module 03: Package & Inclusion Management** | `src/routes/catalog.js`<br>`src/domain/pricing.js`<br>`src/models/package.js` | `ken-tests/tests/integration/catalog.api.test.js`<br>`ken-tests/tests/unit/catalog.validators.test.js` | `KÉN - Module 03- Package & Inclusion Management (40 TCs)` | Sheet: `3. Package & Inclusion`<br>(40 TCs: `TC-PK-001` → `TC-PK-040`) |
| **Module 04: Add-on & Product Management** | `src/routes/catalog.js`<br>`src/models/product.js`<br>`src/models/addon.js` | `ken-tests/tests/integration/catalog.api.test.js`<br>`my-server-mongodb/test/payment_catalog.test.js` | `KÉN - Module 04- Add-on & Product Management (30 TCs)` | Sheet: `4. Add-on & Product`<br>(30 TCs: `TC-AD-001` → `TC-AD-030`) |
| **Module 07: Payment Management** | `src/routes/payments.js`<br>`src/domain/payment.js`<br>`src/models/paymentTransaction.js` | `ken-tests/tests/integration/payment.api.test.js`<br>`my-server-mongodb/test/payment_catalog.test.js` | `KÉN - Module 07- Payment Management (22 TCs)` | Sheet: `7. Payment`<br>(22 TCs: `TC-PM-001` → `TC-PM-022`) |
| **Module 09: Loyalty Management** | `src/routes/loyalty.js`<br>`src/domain/loyalty.js`<br>`src/models/user.js` | `my-server-mongodb/test/loyalty.test.js` | `KÉN - Module 09- Loyalty Management (20 TCs)` | Sheet: `9. Loyalty`<br>(19 TCs: `TC-LY-001` → `TC-LY-019`) |

---

## 🚀 Hướng dẫn khởi chạy & kiểm thử cho Lead

### 1. Khởi chạy Backend (`my-server-mongodb`)
```bash
cd my-server-mongodb
npm install
npm run setup     # Tạo MongoDB indexes
npm start         # Chạy backend tại http://localhost:3000 (hoặc PORT cấu hình)
```

### 2. Chạy Bộ Test Auto (`ken-tests`)
Bộ test độc lập bằng `node:test`, không cần MongoDB live, chạy siêu nhanh (120/120 pass):
```bash
cd ken-tests
npm test                # Chạy toàn bộ test cases unit + integration
npm run test:admin      # Test riêng module Admin & Catalog
npm run test:payment    # Test riêng module Payment
npm run test:coverage   # Báo cáo độ bao phủ kiểm thử
```

Nếu muốn chạy test tích hợp trực tiếp MongoDB backend:
```bash
cd my-server-mongodb
npm test                # Chạy test suite node:test trực tiếp với MongoDB
```

### 3. Kiểm thử với Postman Runner (`postman`)
1. Mở ứng dụng **Postman**.
2. Chọn **Import**:
   - File môi trường: `postman/KEN_Environment.postman_environment.json`.
   - File collection tổng: `postman/KEN_Postman_Runner_Collection.json`.
   - Hoặc import các collection chi tiết từng module trong thư mục `postman/collections/`:
     * `KÉN - Module 02- Space & Zone Management (42 TCs)`
     * `KÉN - Module 03- Package & Inclusion Management (40 TCs)`
     * `KÉN - Module 04- Add-on & Product Management (30 TCs)`
     * `KÉN - Module 07- Payment Management (22 TCs)`
     * `KÉN - Module 09- Loyalty Management (20 TCs)`
3. Chọn môi trường `KÉN Coffee In Bed - Local Environment` và chạy qua **Collection Runner**.
4. Toàn bộ kịch bản tự động nối kết chuỗi dữ liệu (Zone $\rightarrow$ Space $\rightarrow$ Package $\rightarrow$ Add-on $\rightarrow$ Payment $\rightarrow$ Loyalty) và hiển thị kết quả 100% Passed.

---

## 📑 Tài liệu chi tiết khác
- **Kiến trúc & DB Schema:** [docs/project/architecture.md](docs/project/architecture.md)
- **Quy tắc Backend:** [docs/principle/backend-rules.md](docs/principle/backend-rules.md)
- **Workflows từng chức năng:** [docs/workflow/README.md](docs/workflow/README.md)

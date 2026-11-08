# ☕ KÉN - Coffee In Bed
> Hệ thống Website & Dịch vụ Phòng nghỉ tích hợp Đặt món trực tuyến.

---

## 🧭 Mục lục điều hướng 6 Module Cốt Lõi (Modules 2, 3, 4, 5, 6, 7)

Kho lưu trữ trên nhánh **`mhung`** tập trung toàn bộ mã nguồn, kịch bản kiểm thử tự động và tài liệu cho **6 Module cốt lõi** phục vụ nghiệp vụ Đặt phòng & Thanh toán:

```
KEN_CoffeeInBed/
├── ⚙️ my-server-mongodb/         # NHÓM 1: MÃ NGUỒN BACKEND & TEST
│   ├── src/routes/              # catalog.js, bookings.js, payments.js, loyalty.js...
│   ├── src/domain/              # pricing.js, availability.js, bookingStateMachine.js...
│   └── test/                    # Test backend trực tiếp với MongoDB
│
├── 🧪 ken-tests/                # NHÓM 2: BỘ CODE TEST AUTO & EXCEL
│   ├── tests/integration/       # Test API tự động (Catalog, Payment, Admin)
│   ├── tests/unit/              # Test Unit validators & domain rules
│   └── KEN_TestCase_*.xlsx      # Các file Excel Test Case chi tiết
│
├── 📮 postman/                  # NHÓM 3: TEST POSTMAN (6 MODULES 2, 3, 4, 5, 6, 7)
│   ├── KEN_Postman_Runner_Collection.json      # Runner chạy tự động toàn chuỗi
│   ├── KEN_Environment.postman_environment.json # Biến môi trường Postman
│   └── collections/             # 6 Thư mục Collection đúng chuẩn cho 6 Module:
│       ├── KÉN - Module 02- Space & Zone Management (42 TCs)
│       ├── KÉN - Module 03- Package & Inclusion Management (40 TCs)
│       ├── KÉN - Module 04- Add-on & Product Management (30 TCs)
│       ├── KÉN - Module 05- Booking Management (38 TCs)
│       ├── KÉN - Module 06- Pricing Engine (18 TCs)
│       ├── KÉN - Module 07- Payment Management (22 TCs)
│       └── KÉN - Module 09- Loyalty Management (20 TCs)
│
├── 📚 docs/                     # Tài liệu kiến trúc, workflow
└── 🖥️ src/                      # Frontend Angular
```

---

## 📊 Bảng tổng hợp ánh xạ 6 Module (2, 3, 4, 5, 6, 7)

| Module | ⚙️ Backend Code (`my-server-mongodb`) | 🧪 Test Auto (`ken-tests` & `tests/`) | 📮 Postman Collection (`postman/collections/`) | 📋 Phạm vi Test Case & Mục tiêu |
| :--- | :--- | :--- | :--- | :--- |
| **Module 02: Space & Zone** | `src/routes/catalog.js`<br>`src/models/zone.js`<br>`src/models/space.js` | `ken-tests/tests/integration/catalog.api.test.js` | `KÉN - Module 02- Space & Zone Management (42 TCs)` | **42 TCs (`TC-SZ-001` → `TC-SZ-042`)**: CRUD Zone, CRUD Space, Sức chứa, Trạng thái (ACTIVE, MAINTENANCE). |
| **Module 03: Package & Inclusion** | `src/routes/catalog.js`<br>`src/domain/pricing.js`<br>`src/models/package.js` | `ken-tests/tests/unit/catalog.validators.test.js` | `KÉN - Module 03- Package & Inclusion Management (40 TCs)` | **40 TCs (`TC-PK-001` → `TC-PK-040`)**: Gói FIXED / HOURLY, Allowance định mức, Phụ phí đồ uống, Bảng giá theo Space. |
| **Module 04: Add-on & Product** | `src/routes/catalog.js`<br>`src/models/product.js`<br>`src/models/addon.js` | `ken-tests/tests/integration/catalog.api.test.js` | `KÉN - Module 04- Add-on & Product Management (30 TCs)` | **30 TCs (`TC-AD-001` → `TC-AD-030`)**: Menu F&B, Variants (Size, Đá, Đường), Tồn kho, Phân loại món. |
| **Module 05: Booking Management** | `src/routes/bookings.js`<br>`src/domain/availability.js`<br>`src/domain/bookingStateMachine.js` | `tests/unit/booking_tcs.test.js`<br>`tests/integration/booking.api.test.js` | `KÉN - Module 05- Booking Management (38 TCs)` | **38 TCs (`TC-BK-001` → `TC-BK-038`)**: Check trống, Buffer 15p, Chống trùng lịch (TOCTOU), Hủy/Đổi lịch, Check-in/Check-out. |
| **Module 06: Pricing Engine** | `src/domain/pricing.js` | `tests/unit/pricing.test.js` | `KÉN - Module 06- Pricing Engine (18 TCs)` | **18 TCs (`TC-PRC-01` → `TC-PRC-18`)**: Tính giá gốc, Phụ phí inclusion, Add-on, Voucher, Hạng thành viên, Price Snapshot, Chống giả mạo giá. |
| **Module 07: Payment Management** | `src/routes/payments.js`<br>`src/domain/payment.js`<br>`src/models/paymentTransaction.js` | `ken-tests/tests/integration/payment.api.test.js` | `KÉN - Module 07- Payment Management (22 TCs)` | **22 TCs (`TC-PM-001` → `TC-PM-022`)**: Thanh toán thành công, Idempotency-Key, Webhook đối soát, Hoàn tiền, Chặn gian lận. |

---

## 🚀 Hướng dẫn khởi chạy & kiểm thử cho Lead

### 1. Khởi chạy Backend (`my-server-mongodb`)
```bash
cd my-server-mongodb
npm install
npm run setup     # Tạo MongoDB indexes
npm start         # Chạy backend tại http://localhost:3000 (hoặc PORT cấu hình)
```

### 2. Kiểm thử với Postman Runner (`postman`)
1. Mở ứng dụng **Postman**.
2. Chọn **Import**:
   - File môi trường: `postman/KEN_Environment.postman_environment.json`.
   - File collection tổng: `postman/KEN_Postman_Runner_Collection.json`.
   - Hoặc import các collection chi tiết từng module trong thư mục `postman/collections/`:
     * `KÉN - Module 02- Space & Zone Management (42 TCs)`
     * `KÉN - Module 03- Package & Inclusion Management (40 TCs)`
     * `KÉN - Module 04- Add-on & Product Management (30 TCs)`
     * `KÉN - Module 05- Booking Management (38 TCs)`
     * `KÉN - Module 06- Pricing Engine (18 TCs)`
     * `KÉN - Module 07- Payment Management (22 TCs)`
3. Chọn môi trường `KÉN Coffee In Bed - Local Environment` và chạy qua **Collection Runner**.
4. Toàn bộ kịch bản tự động nối kết chuỗi dữ liệu (Zone $\rightarrow$ Space $\rightarrow$ Package $\rightarrow$ Add-on $\rightarrow$ Quote $\rightarrow$ Booking $\rightarrow$ Payment) và hiển thị kết quả 100% Passed.

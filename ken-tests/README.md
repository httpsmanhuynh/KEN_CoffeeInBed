# KÉN Kết Nối - Test Catalog

## Chạy nhanh (VS Code terminal, Node >= 20, không cần cài thêm package)
    npm test                # unit + API (mock server)
    npm run test:coverage   # coverage
    TEST_BASE_URL=http://localhost:3000 ADMIN_TOKEN=<jwt> CUSTOMER_TOKEN=<jwt> npm run test:api   # backend thật

## Cấu trúc
- src/validators.js, src/mockCatalogServer.js : bản tham chiếu assertMoney/pick + server mô phỏng đặc tả
- tests/unit/catalog.validators.test.js
- tests/integration/catalog.api.test.js
- KEN_Test_Cases_Catalog.xlsx : test thủ công + map automation + tổng hợp

## Khi test backend thật
1. Đổi `require('../../src/validators')` trong tests/unit thành file thật của dự án.
2. Điều chỉnh endpoint/format response trong tests/helpers/api.js (hiện giả định `{ data: ... }`).

## Module Admin & Thanh toán
    npm run test:admin     # Admin: đăng nhập, RBAC, danh sách/lọc, state machine, Dashboard
    npm run test:payment   # Thanh toán: server tính tiền, webhook HMAC, idempotency, race, hoàn tiền
Backend thật: ADMIN_BASE_URL / PAYMENT_BASE_URL (hoặc TEST_BASE_URL) + ADMIN_TOKEN, CUSTOMER_TOKEN, CUSTOMER2_TOKEN, PAYMENT_WEBHOOK_SECRET.
Excel: KEN_Test_Cases_Catalog.xlsx / _Admin.xlsx / _Payment.xlsx (tạo lại bằng python3 tools/*_xlsx.py).

## File Excel (format theo mẫu KEN_TestCase_*.xlsx)
KEN_TestCase_Catalog.xlsx / _Admin.xlsx / _Payment.xlsx - 4 sheet: Tổng quan, Test Case, Luồng test, Bao phủ code.
Tạo lại: python3 tools/mk_catalog.py | mk_admin.py | mk_payment.py

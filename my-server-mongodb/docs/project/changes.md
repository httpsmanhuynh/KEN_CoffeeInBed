# Thay đổi cấu hình dự án & Lịch sử hợp nhất (`Tman`)

## 1. Schema `users` & Database Validators (`database/schemas/*.validator.json`)
- Thêm field tùy chọn `password_changed_at` (date) trong `database/schemas/users.validator.json` và `database/tools/build_schemas.py`. Áp lên Atlas bằng `node setup.js --no-seed` (trong thư mục `database`).
- Tất cả các thao tác ghi trong `bookingService.js`, `catalog.js`, `loyalty.js`, `payments.js` đều tuân thủ nghiêm ngặt `additionalProperties: false` và `$expr` của 21 file `*.validator.json`.

## 2. Biến môi trường
- `CORS_ORIGIN` (mặc định `http://localhost:4200`).
- Production tự bật `trust proxy = 1`; bắt buộc có `SESSION_SECRET`.
- Các biến khác: `PORT` (mặc định `3002`), `MONGODB_URI`, `SESSION_SECRET`, `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `SMS_PROVIDER`.

## 3. Thư viện
- Bỏ `body-parser` (dùng `express.json` / `express.urlencoded`).
- Thêm `connect-mongo@^6` (session store).
- `morgan` chuyển sang `dependencies` vì `index.js` dùng ở production.

## 4. Scripts (`package.json`)
- `npm test` chạy `node --test test/*.test.js` (94 test cases).
- `npm run setup` tạo đầy đủ index MongoDB (`src/config/indexes.js`).
- `npm run start:prod` chạy `node index.js`.

## 5. Các file chính trên nhánh `Tman` (sau khi gộp `pkhanh`, `mhung` & bổ sung `Review Management`)
- `src/utils/http.js`: helper dùng chung cho toàn bộ routes (`wrap`, `fail`, `str`, `publicUser`, `tierOf`).
- `src/middleware/auth.js`: `requireAuth` (đọc lại DB nên session của tài khoản bị khóa bị thu hồi — cơ chế của `BR-A05`), `requireRole`, `startSession` (giữ `pendingBooking`), `destroySession`.
- `src/services/bookingService.js`: toàn bộ dịch vụ đặt chỗ theo quy trình chuẩn `BR-D01` (Bước 1: Khám phá & kiểm tra chỗ trống `searchAvailableSpaces` → Bước 2: Chọn Space & Package `selectSpaceAndPackage` → Bước 3: Chọn Inclusion & Add-on → Bước 4: Checkout & tạo đơn giữ chỗ 15 phút với khóa `lock_version` trong transaction → Bước 5: Payment → Confirmation → Check-in → Sử dụng → Check-out tích điểm, hủy/đổi giờ, thu hồi đơn quá hạn, đối soát hoàn tiền).
- `src/domain/review.js`, `src/services/reviewService.js` & `src/routes/reviews.js`: phân hệ Quản lý Đánh giá (Module 10 — `UC-16`, `BR-H01`, `FR-4.3`): kiểm tra điều kiện đơn chính chủ & đã `CHECKED_OUT` trong Transaction, chặn đánh giá trùng (tối đa 01 đánh giá/Booking), Tạo & Xem đánh giá (theo Booking, Space, User) và gắn cờ nhắc đánh giá (`review_reminder`) trong lịch sử đặt chỗ (`GET /api/bookings/me`, `GET /api/bookings/:id`).
- `src/routes/catalog.js`: kết hợp API khám phá chỗ trống (`UC-04`, `UC-05`), xem đánh giá theo không gian (`GET /api/spaces/:id/reviews`) và Admin CRUD Catalog (`zones`, `spaces`, `packages`, `package_prices`, `package_inclusions`, `products`, `addons`, `vouchers`, `recipes`) từ `mhung`.
- `src/routes/bookings.js`: API đặt chỗ 5 bước, vận hành đơn & đánh giá đơn (`select-package`, `quote`, `POST /`, `me`, `GET /`, `:id`, `:id/review`, `pay`, `cancel`, `reschedule`, `check-in`, `check-out`, `no-show`, `refund-reconcile`, `expire-holds`).
- `src/domain/payment.js` & `src/routes/payments.js`: kiểm tra thanh toán & API giao dịch thanh toán Idempotent (`gateway_ref`) gộp từ `mhung`.
- `src/routes/loyalty.js`: API bảng hạng (`/tiers`), cộng điểm idempotent (`/earn`), đổi Coins lấy Voucher vào `user_vouchers` (`/redeem`, `/my-vouchers`), lịch sử (`/history`) và rollover đầu năm (`/year-rollover`) gộp từ `mhung`.
- `test/`: 8 file kiểm thử (`auth.mw.test.js`, `booking.test.js`, `domain.test.js`, `logout.test.js`, `loyalty.test.js`, `otp.test.js`, `payment_catalog.test.js`, `review.test.js`) với tổng cộng **94 test cases pass 100%**.

## 6. Module 11 — Admin Management & Dashboard
- **File mới:** `src/domain/adminError.js`, `src/domain/adminUser.js`, `src/domain/dashboard.js`, `src/services/adminService.js`, `src/routes/admin.js`; test `tests/unit/dashboard.test.js` (29), `tests/unit/adminUser.test.js` (9), `tests/integration/admin.api.test.js` (7).
- **Việc cần làm khi tích hợp:** thêm vào `index.js` dòng `app.use('/api/admin', require('./src/routes/admin'));`.
- **Phụ thuộc:** dùng `mongodb` (`ObjectId`) và `express` đã có; không thêm thư viện mới. Route đọc `requireRole` từ `src/middleware/auth.js`, `adminLimit` từ `src/middleware/rateLimit.js` nếu có.
- **Index gợi ý (không bắt buộc):** `bookings { start_at: 1, space_id: 1, status: 1 }`, `bookings { user_id: 1, created_at: -1 }`, `booking_addons { booking_id: 1 }`; thêm index trên trường ngày của `payment_transactions` (và `{ status: 1, type: 1 }`).
- **Schema/validator:** không đổi.
- **Chạy test riêng:** `node --test tests/unit/dashboard.test.js tests/unit/adminUser.test.js tests/integration/admin.api.test.js`.
- **Cập nhật theo `Report.docx` (B.3.30, UC-29, UC-31):** doanh thu Dashboard chuyển sang Σ `PAYMENT` − Σ `REFUND` thành công trong `payment_transactions` (theo thời điểm giao dịch) kèm phân rã Package / Phụ phí Inclusion / Add-on / Giảm giá; bỏ F&B trực tiếp (`fnbDirect`, `grandTotal`, `sales_transactions`); danh sách/hồ sơ khách có `loyalty { tier, tierName, points, coins }`. Response `revenue` đổi từ `{ bookings, fnbDirect, grandTotal }` sang `{ basis, total, breakdown, collected, refunded }`, `daily[]` đổi từ `{ date, bookings, revenue }` sang `{ date, revenue, payment, refund }`. Hằng `REVENUE_STATUSES` đổi tên `PAID_STATUSES` (chỉ còn dùng cho Occupancy, Top Add-on, `totalSpent`). Schema/validator: không đổi.

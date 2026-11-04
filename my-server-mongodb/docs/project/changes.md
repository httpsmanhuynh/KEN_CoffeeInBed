# Thay đổi cấu hình dự án

## Schema `users`
- Thêm field tùy chọn `password_changed_at` (date) trong `database/schemas/users.validator.json` và `database/tools/build_schemas.py`. Áp lên Atlas bằng `node setup.js --no-seed` (trong thư mục `database`).

## Biến môi trường
- `CORS_ORIGIN` (mặc định `http://localhost:4200`).
- Production tự bật `trust proxy = 1`; bắt buộc có `SESSION_SECRET`.
- Các biến khác: `PORT`, `MONGODB_URI`, `SESSION_SECRET`, `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `SMS_PROVIDER`.

## Thư viện
- Bỏ `body-parser` (dùng `express.json` / `express.urlencoded`).
- Thêm `connect-mongo@^6` (session store).
- `morgan` chuyển sang `dependencies` vì `index.js` dùng ở production.

## Scripts (`package.json`)
- `npm test` chạy `node --test test/*.test.js`.
- `npm run setup` tạo unique index phone/email (`src/config/indexes.js`).
- `npm run start:prod` chạy `node index.js`.

## File
- `src/utils/http.js`: helper dùng chung cho `routes/auth.js` và `routes/profile.js`.
- `src/services/bookingService.js`: toàn bộ dịch vụ đặt chỗ theo quy trình chuẩn `BR-D01` (Bước 1: Khám phá & kiểm tra chỗ trống `searchAvailableSpaces` → Bước 2: Chọn Space & Package `selectSpaceAndPackage` → Bước 3: Chọn Inclusion & Add-on → Bước 4: Checkout & tạo đơn giữ chỗ 15 phút với khóa `lock_version` trong transaction → Bước 5: Payment → Confirmation → Check-in → Sử dụng → Check-out tích điểm, hủy/đổi giờ, thu hồi đơn quá hạn, đối soát hoàn tiền).
- `src/routes/catalog.js`: API danh mục & khám phá chỗ trống (`/api/zones`, `/api/spaces`, `/api/spaces/:id`, `/api/packages`, `/api/products`, `/api/addons`, `/api/vouchers`, `POST /api/availability`).
- `src/routes/bookings.js`: API đặt chỗ & vòng đời đơn (`POST /api/bookings/select-package`, `POST /api/bookings/quote`, `POST /api/bookings`, `GET /api/bookings/me`, `GET /api/bookings/:id`, `pay`, `cancel`, `reschedule`, `check-in`, `check-out`, `no-show`, `refund-reconcile`, `expire-holds`).
- `test/booking.test.js`: bộ kiểm thử tích hợp theo quy trình chuẩn `BR-D01`, hủy/đổi giờ, cron hết hạn và kiểm thử đặt song song (concurrency test cho cả `EXCLUSIVE` và `SHARED`).
- `db.js` đã bỏ (không ai dùng; env `MONGO_URI` lệch với `MONGODB_URI`).

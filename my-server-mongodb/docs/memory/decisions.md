# Quyết định đã chốt (Auth + Booking 5 bước + Catalog/Payment/Loyalty)

## 1. Auth & Session
- **Thu hồi session (`BR-A05`):** `requireAuth` đọc lại user từ DB ở mọi request. User bị khóa/xóa, hoặc `users.password_changed_at` khác `session.user.pwdAt` thì hủy session, trả 401. `requireRole` lấy vai trò từ `req.user.role` (DB), không tin role trong session.
- **Rate limit (`BR-A08`):** gắn từng route, không dùng `router.use`.
  - Đăng nhập: theo identifier, 10 lần / 15'.
  - Gửi OTP: theo SĐT, 5 lần / 10'. Dùng chung bộ đếm cho `register`, `forgot-password` và OTP 2FA khi đăng nhập (gọi `phoneOtpLimiter.hit()` trong handler vì SĐT chỉ biết sau khi tra DB).
  - Thao tác nhạy cảm của user đã đăng nhập: theo user id, 10 lần / 15'.
  - IP: 30 lần / 15'.
- **Session store:** `connect-mongo`, collection `sessions`, hạn 24 giờ. Collection tự tạo khi có session đầu tiên (không nằm trong `database/schemas`).

## 2. Vòng đời Booking & Đặt không gian 5 bước (chốt theo `Report.docx` & `database/schemas`)
- **`BR-D01` (Quy trình 5 bước):** Khám phá & Kiểm tra chỗ trống (`UC-04`) → Chọn Space & Package qua Auth Guard (`UC-05`) → Chọn Inclusion & Add-on (`UC-06`) → Checkout & giữ chỗ 15 phút (`UC-07`, `UC-08`) → Payment & Confirmation (`UC-09`, `UC-10`) → Check-in (`UC-25`) → Sử dụng → Check-out (`UC-26`).
- **`BR-C04`:** Buffer 15 phút chỉ áp cho không gian `EXCLUSIVE`; `SHARED` không có buffer (`buffer_minutes = 0`).
- **`BR-F01`:** Cửa sổ Check-in là `[start_at − 15', start_at + 30']`. Quá `start_at + 30'` chỉ còn `NO_SHOW` (Admin). Lý do từ chối: `TOO_EARLY` / `TOO_LATE`.
- **`BR-D04/D05`:** Khách chỉ hủy `PENDING_PAYMENT` khi `now < payment_expires_at`. Từ lúc hết hạn lý do là `HOLD_EXPIRED` và Cronjob hệ thống chuyển `EXPIRED` (`BR-E03`).
- **Chống đặt trùng song song (`NFR-02` & Mini-spec 4.1.3):** `checkoutBooking` và `rescheduleBooking` chạy trong Multi-Document ACID Transaction (`session.withTransaction`), bước đầu tiên khóa bản ghi `spaces` bằng `$inc: { lock_version: 1 }` trước khi chạy `evaluateSpaceAvailability` và ghi `bookings`. Khi 2 người đặt cùng một khung giờ song song, MongoDB sinh `WriteConflict` (code 112), tự động retry transaction thứ 2 sau khi transaction thứ 1 commit và trả về `409 OVERLAP` / `CAPACITY_EXCEEDED`.

## 3. Hợp nhất Catalog CRUD, Payment Idempotent & Loyalty (từ nhánh `mhung`)
- **Tuân thủ strict validator (`database/schemas/*.validator.json`):**
  - Không tạo collection ngoài validator (bỏ `loyalty_histories` và `space_pricing` của `mhung`; dùng đúng `loyalty_transactions` và `package_prices` trong validator).
  - `payment_transactions`: lưu `idempotencyKey` vào trường `gateway_ref` (có unique index), lưu `actorId` vào `performed_by` và kênh thanh toán vào `note`.
  - `loyalty_transactions`: dùng đúng 3 loại `type` (`EARN`, `REDEEM`, `YEAR_RESET`) kèm `points_delta`, `coins_delta`, `points_after`, `coins_after`.
  - `user_vouchers`: khi khách đổi Coins lấy Voucher (`POST /api/loyalty/redeem`), ghi nhận vào ví `user_vouchers` để đối chiếu khi áp dụng mã tại Checkout.

## 4. Quản lý Đánh giá sau sử dụng (`Review Management` — Module 10, `UC-16`, `BR-H01`, `FR-4.3`)
- **Kiểm tra điều kiện đơn chính chủ & `CHECKED_OUT` (`BR-D06`, `BR-H01`, `BR-F03`, `NFR-02`):** Chỉ chủ đơn (`booking.user_id == req.user._id`) mới được đánh giá và đơn bắt buộc ở trạng thái `CHECKED_OUT`. Cả hai điều kiện được kiểm tra lại bên trong Multi-Document ACID Transaction khi lưu.
- **Chặn đánh giá trùng (`BR-H01`, `EX-5.6`):** Trong Transaction lưu đánh giá, hệ thống lấy khóa ghi trên bản ghi `bookings` và kết hợp với unique index `uq_reviews_booking` (`{ booking_id: 1 }`) để đảm bảo tối đa 01 đánh giá/Booking ngay cả khi gửi trùng đồng thời. Nếu đơn đã có đánh giá, trả `409 REVIEW_ALREADY_EXISTS` kèm bản ghi `review` đã gửi để hiển thị ở chế độ chỉ xem (`AF2`).
- **Tuân thủ `reviews.validator.json`:** Chỉ lưu đúng 6 trường (`_id`, `booking_id`, `user_id`, `rating` nguyên từ `1..5`, `comment` tối đa `500` ký tự hoặc `null`, `created_at >= booking.checked_out_at`). Không lưu `space_id` dư thừa vào `reviews` (đạt 3NF Chương 6; khi xem đánh giá theo Space thì truy vết qua `bookings`).
- **Lời nhắc đánh giá trong Lịch sử đặt chỗ (`GET /api/bookings/me`, `GET /api/bookings/:id`):** Dùng `attachReviewsToBookings` để gắn động các trường `has_review`, `can_review`, `review_reminder` (`true` khi `status === 'CHECKED_OUT' && !has_review`) và `review` vào JSON trả về mà không làm bẩn schema `bookings` trong DB.

## 5. Admin Management & Dashboard (Module 11)
- **Khóa/Mở khóa:** `POST /api/admin/users/:id/lock|unlock`. Cập nhật nguyên tử `updateOne({_id, status: from})` thay vì đọc-rồi-ghi; không tự khóa mình, không khóa Admin. Chỉ ghi `status`, không thêm field `locked_at/reason` vì validator `users` là `additionalProperties:false`.
- **Doanh thu thực tế:** tổng `final_amount` (Price Snapshot) của `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `NO_SHOW`; không tính `PENDING_PAYMENT`, `CANCELLED`, `EXPIRED`.
- **Mốc thời gian Dashboard:** `bookings.start_at`, theo ngày giờ VN (UTC+7), khoảng `[from, to+1 ngày)`.
- **Occupancy Rate:** giờ-không-gian đã dùng ÷ giờ-không-gian khả dụng; `SHARED` quy đổi bằng giờ-khách ÷ `capacity` để cùng đơn vị với `EXCLUSIVE`. Tập trạng thái chiếm chỗ = tập trạng thái doanh thu (`OCCUPANCY_STATUSES`).
- **F&B trực tiếp:** lấy từ `sales_transactions`, tổng toàn hệ thống (không chia Zone).
- **Tách lớp:** tính toán ở `src/domain/dashboard.js` (thuần, test không cần Mongo); `adminService.js` chỉ truy vấn rồi gọi domain.
- **Mã lỗi Admin:** `{ error, message }` qua `AdminError`.

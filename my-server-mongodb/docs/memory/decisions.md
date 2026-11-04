# Quyết định đã chốt (luồng auth + vòng đời booking)

## Auth
- **Thu hồi session (BR-A05):** `requireAuth` đọc lại user từ DB ở mọi request. User bị khóa/xóa, hoặc `users.password_changed_at` khác `session.user.pwdAt` thì hủy session, trả 401. `requireRole` lấy vai trò từ `req.user.role` (DB), không tin role trong session.
- **Rate limit (BR-A08):** gắn từng route, không dùng `router.use`.
  - Đăng nhập: theo identifier, 10 lần / 15'.
  - Gửi OTP: theo SĐT, 5 lần / 10'. Dùng chung bộ đếm cho `register`, `forgot-password` và OTP 2FA khi đăng nhập (gọi `phoneOtpLimiter.hit()` trong handler vì SĐT chỉ biết sau khi tra DB).
  - Thao tác nhạy cảm của user đã đăng nhập: theo user id, 10 lần / 15'.
  - IP: 30 lần / 15'.
- **Session store:** `connect-mongo`, collection `sessions`, hạn 24 giờ. Collection tự tạo khi có session đầu tiên (không nằm trong `database/schemas`).
- **`/register` trả 409** khi SĐT/email đã tồn tại: chấp nhận đánh đổi lộ thông tin (đã có giới hạn theo IP và SĐT).
- **`forgot-password`:** body phản hồi giống nhau; chấp nhận độ lệch thời gian nhỏ giữa user có và không có.
- **`loginLimiter` theo identifier:** kẻ xấu có thể cố ý spam SĐT/email của người khác để khóa đăng nhập của họ 15 phút. Chấp nhận cho phạm vi đồ án.
- **Index:** `phone`, `email` đã unique trên Atlas nên dòng `ensureIndexes` trong `index.js` để comment; chạy `npm run setup` khi cần tạo lại.

## Vòng đời booking & Đặt không gian 5 bước (chốt theo Report.docx & database/schemas)
- **BR-C04:** buffer chỉ áp cho không gian EXCLUSIVE; SHARED không có buffer (`buffer_minutes = 0`).
- **BR-F01:** cửa sổ check-in là [start − 15', start + 30']. Quá start + 30' chỉ còn `NO_SHOW` (Admin). Lý do từ chối: `TOO_EARLY` / `TOO_LATE`.
- **BR-D04/D05:** khách chỉ hủy `PENDING_PAYMENT` khi `now < payment_expires_at`. Từ lúc hết hạn lý do là `HOLD_EXPIRED` và job hệ thống chuyển `EXPIRED` (cách xử lý giống BR-E03).
- **Chống đặt trùng song song (NFR-02 & Mini-spec 4.1.3):** `createBooking` và `rescheduleBooking` chạy trong Multi-Document ACID Transaction (`session.withTransaction`), bước đầu tiên khóa bản ghi `spaces` bằng `$inc: { lock_version: 1 }` trước khi chạy `checkAvailability` và ghi `bookings`. Khi 2 người đặt cùng một khung giờ song song, MongoDB sinh `WriteConflict` (code 112), tự động retry transaction thứ 2 sau khi transaction thứ 1 commit và trả về `409 OVERLAP` / `CAPACITY_EXCEEDED`.
- **Tuân thủ strict validator (`database/schemas/*.validator.json`):**
  - `bookings`: lưu đủ snapshot `zone_id`, `zone_name`, `space_name`, `package_name`, `fixed_inclusions_snapshot` (`WATER` khi đủ `min_hours_required`, `EQUIPMENT`), đồng bộ `voucher_id`/`voucher_code` và trạng thái hoàn tiền (`refund_status`, `refund_amount`).
  - `booking_inclusions` & `booking_addons`: chỉ lưu trường `variant` khi có chuỗi biến thể hợp lệ (không lưu `null` vì schema định nghĩa `bsonType: 'string'`).

> BR-F01 (mốc trên) và việc hủy quá hạn được suy ra từ các câu liên quan trong báo cáo, báo cáo không viết thẳng. Đổi quy tắc thì sửa `src/domain/bookingStateMachine.js` và test tương ứng.

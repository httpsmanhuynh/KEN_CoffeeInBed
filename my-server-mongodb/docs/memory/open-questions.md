# Hạng mục còn mở

1. **Module 11 — Admin Management & Dashboard (đã code, còn cần xác nhận):**
   - Chạy thử `GET /api/admin/dashboard` trên MongoDB thật (aggregate chưa được test tự động).
   - Xác nhận tên field trong `payment_transactions` (`type`, `status`, `booking_id`, `amount`, ngày giao dịch), Price Snapshot trên `bookings` (`final_amount`, `inclusion_surcharge`, `addon_total`, `voucher_discount`, `tier_discount`) và `booking_addons` (xem hằng `PAYMENT_TX`, `BOOKING_SNAPSHOT` và `normalizeAddonLine`).
   - Xác nhận `payment_transactions` ghi đủ `REFUND` ở mọi trạng thái (SUCCESS/PENDING/FAILED) và đối soát (`refund-reconcile`) ghi `REFUND` thành công; xác nhận kỳ chỉ có hoàn tiền hiển thị số âm.
   - Xác nhận `users.tier_points`, `users.coin_balance` (và `users.tier` nếu có) để `loyalty` trong danh sách khách đúng; bảng hạng `TIER_LADDER` trong `adminUser.js` phải khớp `src/domain/loyalty.js`.
   - Cách lấy `db` trong route (`getDb(req)` trong `src/routes/admin.js`) và dạng response lỗi chuẩn của dự án (hiện `{ error, message }`).
   - Nhật ký khóa/mở khóa (ai khóa, lúc nào, lý do) cần thêm field/collection vào validator trước khi làm.
   - Đã chốt theo Report: F&B trực tiếp (POS) nằm ngoài phạm vi hệ thống, Dashboard không có F&B.
2. **Module 12 — Recommendation & Forecast API:**
   - Cần bổ sung API gợi ý món/Add-on cho khách trong luồng đặt chỗ và API Admin truy xuất dữ liệu dự báo 52 nguyên vật liệu (`demand_forecasts`, `inventory_alerts`, `ingredients`, `ingredient_stock_movements`, `sales_history_daily`, `sales_transactions`).
3. **Frontend Auth UI cần bổ sung ở chặng sau (lệch luồng BE hiện tại):**
   - **Quên mật khẩu (`ForgotPasswordPage` → `ForgotOtpPage` → `ResetPasswordPage`):** FE đang tách gọi `POST /api/auth/forgot-password/verify-otp` lấy `resetToken`, trong khi BE `POST /api/auth/reset-password` nhận trực tiếp `{ phone, code, newPassword, confirmPassword }` (và `POST /api/auth/forgot-password` luôn trả `200` theo `BR-A07` thay vì `404`). Cần chỉnh lại UI/luồng FE ở chặng sau.
   - **Đăng nhập 2FA (`POST /api/auth/login/2fa`):** BE đã hỗ trợ trả `{ requires2FA: true }` và verify OTP 2FA, nhưng FE `LoginPage` chưa có màn hình/form nhập OTP 2FA (đang hiện thông báo `two-factor-unavailable`). Cần bổ sung UI ở chặng sau.

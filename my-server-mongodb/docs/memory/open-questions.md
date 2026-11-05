# Hạng mục còn mở (3 Module tiếp theo)

1. **Module 10 — Review Management (`reviews.validator.json`):**
   - Cần tạo `src/routes/reviews.js`: kiểm tra đơn chính chủ đã `CHECKED_OUT`, chặn đánh giá trùng (tối đa 01 đánh giá/Booking), tạo và xem đánh giá (`rating` 1..5, `comment`), kèm cờ nhắc đánh giá trong lịch sử đặt chỗ.
2. **Module 11 — Admin Management & Dashboard:**
   - Đã có `GET /api/bookings` cho Admin lọc đơn.
   - Cần bổ sung API Admin xem danh sách/chi tiết khách hàng, khóa/mở khóa tài khoản (`ACTIVE ↔ LOCKED`) và API thống kê Dashboard (số đơn theo 7 trạng thái, Occupancy Rate, Top Add-on, doanh thu thực tế từ Price Snapshot & F&B).
3. **Module 12 — Recommendation & Forecast API:**
   - Cần bổ sung API gợi ý món/Add-on cho khách trong luồng đặt chỗ và API Admin truy xuất dữ liệu dự báo 52 nguyên vật liệu (`demand_forecasts`, `inventory_alerts`, `ingredients`, `ingredient_stock_movements`, `sales_history_daily`, `sales_transactions`).

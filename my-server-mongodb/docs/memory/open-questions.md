# Hạng mục còn mở

1. **Module 11 — Admin Management & Dashboard (đã code, còn cần xác nhận):**
   - Chạy thử `GET /api/admin/dashboard` trên MongoDB thật (aggregate chưa được test tự động).
   - Xác nhận tên field trong `booking_addons` và `sales_transactions` (xem hằng `FNB` và `normalizeAddonLine`).
   - Cách lấy `db` trong route (`getDb(req)` trong `src/routes/admin.js`) và dạng response lỗi chuẩn của dự án (hiện `{ error, message }`).
   - Nhật ký khóa/mở khóa (ai khóa, lúc nào, lý do) cần thêm field/collection vào validator trước khi làm.
   - Có muốn tính F&B qua `booking_inclusions.surcharge_amount` vào doanh thu F&B không (hiện chỉ tính `sales_transactions`).
2. **Module 12 — Recommendation & Forecast API:**
   - Cần bổ sung API gợi ý món/Add-on cho khách trong luồng đặt chỗ và API Admin truy xuất dữ liệu dự báo 52 nguyên vật liệu (`demand_forecasts`, `inventory_alerts`, `ingredients`, `ingredient_stock_movements`, `sales_history_daily`, `sales_transactions`).

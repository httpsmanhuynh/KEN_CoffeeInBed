# Quy trình Catalog Admin CRUD, Voucher, Payment Idempotent & Loyalty

Tài liệu mô tả các module đã được hợp nhất từ nhánh `mhung` vào nhánh `Tman` và chuẩn hóa theo bộ JSON Schema Validator (`database/schemas/*.validator.json`).

---

## 1. Quản trị Danh mục (Catalog Admin CRUD — `src/routes/catalog.js`)

Tất cả các route ghi (`POST`, `PATCH`, `DELETE`) trong [`src/routes/catalog.js`](../../src/routes/catalog.js) đều được bảo vệ bởi chuỗi middleware `[requireRole('ADMIN'), adminLimit]` (trong đó `requireRole('ADMIN')` tự động gọi `requireAuth` đọc lại DB để xác thực trạng thái `ACTIVE` và vai trò `ADMIN` theo `BR-A05`).

### Quy chuẩn dữ liệu theo Validator:
1. **`zones` (`zones.validator.json`):**
   - Trường bắt buộc: `_id`, `zone_code`, `name`, `is_bookable` (bool), `is_active` (bool), `image_url`.
   - Xóa mềm (`DELETE /api/zones/:id`): cập nhật `is_active: false`.
2. **`spaces` (`spaces.validator.json`):**
   - Trường bắt buộc: `_id`, `zone_id`, `space_code`, `name`, `space_type`, `booking_mode` (`EXCLUSIVE` | `SHARED`), `capacity`, `min_guests`, `max_guests`, `open_time`, `close_time`, `buffer_minutes` (`0` nếu `SHARED`, mặc định `15` nếu `EXCLUSIVE`), `status` (`ACTIVE` | `MAINTENANCE` | `INACTIVE`), `lock_version`, `image_url`, `created_at`, `updated_at`.
   - Ràng buộc `$expr`: $1 \le \text{min\_guests} \le \text{max\_guests} \le \text{capacity}$ và $\text{close\_time} > \text{open\_time}$.
   - Xóa mềm (`DELETE /api/spaces/:id`): cập nhật `status: 'INACTIVE'`.
3. **`packages` (`packages.validator.json`), `package_prices` & `package_inclusions`:**
   - `packages`: hỗ trợ gói `FIXED` (có `duration_hours` hoặc `is_full_day = true`) và `HOURLY` (`duration_hours = null`), đơn vị tính `PER_SPACE` hoặc `PER_PERSON`.
   - `package_prices` (`/api/pricing`): lưu bảng giá `{ package_id, space_id, price }` (số nguyên VNĐ $\ge 0$).
   - `package_inclusions` (`/api/package-inclusions`): cấu hình quyền lợi đi kèm gói (`STANDARD_DRINK` mặc định `subsidy_limit = 50000`, `PASTRY`, `WATER`, `EQUIPMENT`).
4. **`products` (`products.validator.json`) & `addons` (`addons.validator.json`):**
   - `products`: danh mục 13 món F&B (`DRINK`, `PASTRY`, `SNACK`), lưu `price` (số nguyên VNĐ $\ge 0$), mảng `variants: [{ name, price }]`, `is_active`.
   - `addons`: dịch vụ mua thêm (`unit: 'PER_ITEM' | 'PER_BOOKING'`), lưu `price`, mảng `variants`, `is_active`.
5. **`vouchers` (`vouchers.validator.json`):**
   - Hỗ trợ cả Voucher công khai (`coins_cost = 0`, `redeem_limit = 0`, `redeem_valid_to = null`) và Voucher đổi bằng KÉN Coins (`coins_cost > 0`, `usage_limit >= redeem_limit > 0`, `redeem_valid_to <= valid_to`).

---

## 2. Thanh toán Idempotent (`src/domain/payment.js` & `src/routes/payments.js`)

Bên cạnh luồng thanh toán trực tiếp qua `POST /api/bookings/:id/pay` trong `bookingService.js`, hệ thống cung cấp thêm bộ API `/api/payments` hỗ trợ cơ chế **Idempotency** cho cổng thanh toán:
- **Kiểm tra điều kiện (`validatePayment`):**
  - Đơn phải tồn tại và ở trạng thái `PENDING_PAYMENT`.
  - Chưa quá hạn giữ chỗ (`now < payment_expires_at`).
  - Số tiền `amount` phải là số nguyên dương và khớp tuyệt đối với `booking.final_amount` (`BR-E02`).
- **Chống tạo giao dịch trùng (`gateway_ref`):**
  - Mỗi request gửi kèm `idempotencyKey` (lưu vào trường `gateway_ref` có unique index trong `payment_transactions`).
  - Nếu gửi lại cùng `idempotencyKey` cho cùng `bookingId` → trả về `200 OK` kèm `{ idempotent: true, transaction }` mà không ghi thêm bản ghi mới.
  - Nếu dùng lại `idempotencyKey` cho `bookingId` khác → trả về `409 IDEMPOTENCY_CONFLICT`.

---

## 3. Hạng thành viên, Điểm & KÉN Coins (`src/domain/loyalty.js` & `src/routes/loyalty.js`)

### 3.1. Bảng hạng thành viên (`BR-H04`)
| Mã hạng (`code`) | Tên hạng | Điểm tối thiểu (`minPoints`) | Mức chiết khấu (`percent`) |
| :---: | :--- | :---: | :---: |
| `BASIC` | KÉN Mới | `0` | `0%` |
| `SILVER` | KÉN Bạc | `1.000` | `5%` |
| `GOLD` | KÉN Vàng | `5.000` | `10%` |
| `DIAMOND` | KÉN Kim Cương | `10.000` | `15%` |

### 3.2. Quy tắc biến động Điểm & Coins (`loyalty_transactions.validator.json`)
Tất cả lịch sử biến động được lưu thống nhất trong collection `loyalty_transactions` với 3 loại giao dịch (`type`):
1. **`EARN` (Tích điểm khi Check-out — `BR-H03`, `BR-H04`):**
   - Tỷ lệ: $10.000\text{đ thực trả} = 1\text{ Điểm} + 1\text{ Coin}$ (`Math.floor(final_amount / 10000)`).
   - Xét nâng hạng tức thì (có thể nhảy nhiều bậc hạng nếu đủ điểm, không bao giờ hạ hạng giữa năm).
   - Bắt buộc có `booking_id != null` và `points_delta == coins_delta >= 0` (có unique index trên `(booking_id, type)` để chống cộng điểm 2 lần).
2. **`REDEEM` (Đổi KÉN Coins lấy Voucher — `UC-17`, `BR-H06`, `BR-I04`):**
   - Chỉ trừ `coin_balance` (`coins_delta < 0`), giữ nguyên `tier_points` (`points_delta = 0`) và không làm ảnh hưởng đến hạng thành viên.
   - Khi truyền `voucherId`, hệ thống kiểm tra hạn đổi Coins, tăng `vouchers.redeem_count` và thêm Voucher vào ví `user_vouchers` của khách hàng.
3. **`YEAR_RESET` (Rollover đầu năm — `UC-37`, `BR-H04`, `BR-H05`):**
   - Thực thi qua `POST /api/loyalty/year-rollover` (Admin/Cron ngày 01/01).
   - Mỗi khách hàng hạ tối đa **1 bậc hạng** (`DIAMOND → GOLD → SILVER → BASIC`), điểm `tier_points` đặt về mốc tối thiểu của hạng mới (riêng `BASIC` giữ nguyên điểm), và toàn bộ `coin_balance` chưa dùng hết hạn về `0`.

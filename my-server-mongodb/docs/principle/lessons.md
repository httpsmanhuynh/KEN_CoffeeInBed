# Bài học / quy tắc

## Rate limit
- **Vấn đề:** `router.use(limiter)` trên router mount ở 2 chỗ (`/api` và `/api/auth`) đếm đôi, và request không khớp route (ví dụ `/api/profile/*`) cũng tốn quota.
- **Quy tắc:** gắn limiter vào từng route. Khóa theo tài khoản/SĐT, không chỉ theo IP. Khi khóa chỉ biết sau khi tra DB thì gọi `limiter.hit(key)` trong handler.
- **Ví dụ:** `loginLimiter`, `phoneOtpLimiter` trong `src/routes/auth.js`.

## Session
- **Vấn đề:** đổi/reset mật khẩu chỉ regenerate session hiện tại, các session khác vẫn sống.
- **Quy tắc:** lưu mốc đổi mật khẩu trong DB và đối chiếu ở mọi request cần đăng nhập. Gói việc này vào `requireAuth` để route mới không quên.

## Express 5
- `req.body` là `undefined` khi request không có body; `index.js` gán mặc định `{}` trước các route.
- Error handler phải kiểm tra `res.headersSent` trước khi trả lỗi.

## connect-mongo v6
- Import dạng `const { MongoStore } = require('connect-mongo')` rồi `MongoStore.create(...)` (không dùng `require('connect-mongo')` trực tiếp như v5).

## Schema Atlas
- Validator dùng `additionalProperties: false`: thêm field vào code thì phải thêm vào `database/schemas/*.validator.json` **và** `database/tools/build_schemas.py`, nếu không `setup.js` sẽ ghi đè mất.

## Đổi trạng thái tài khoản (Admin)
- **Vấn đề:** đọc user rồi ghi `status` dễ ghi đè khi 2 Admin thao tác song song.
- **Quy tắc:** đưa trạng thái nguồn vào điều kiện `updateOne` (`{ _id, status: from }`) và kiểm tra `matchedCount`; thêm `role: { $ne: 'ADMIN' }` khi khóa. Không ghi field ngoài validator.
- **Ví dụ:** `setUserStatus` trong `src/services/adminService.js`.

## Thống kê theo ngày
- **Quy tắc:** ngày nghiệp vụ là giờ VN (UTC+7). Đổi `YYYY-MM-DD` sang `[00:00 VN, 00:00 VN hôm sau)` rồi mới truy vấn; gom theo ngày bằng `$dateToString` với `timezone: '+07:00'`.
- **Quy tắc:** tách công thức ra `src/domain/dashboard.js` để test bằng dữ liệu giả, không cần Mongo.

## Trả dữ liệu user cho Admin
- Luôn qua `sanitizeUser` (loại key chứa `pass|hash|secret|otp|token`), không trả nguyên document `users`.

## Doanh thu Dashboard
- **Vấn đề:** cộng `final_amount` theo trạng thái đơn và `start_at` ra số khác tiền thực thu: đơn hủy hoàn tiền thất bại bị loại sai, hoàn một phần bị trừ cả đơn.
- **Quy tắc:** doanh thu = Σ `PAYMENT` thành công − Σ `REFUND` thành công theo thời điểm giao dịch (Report UC-29, UC-31). Phân rã (Package, Inclusion, Add-on, Giảm giá) phải cộng lại đúng bằng doanh thu: để Package là phần còn lại khi làm tròn.
- **Ví dụ:** `buildRevenue`, `allocateAmount` trong `src/domain/dashboard.js`.

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

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
- `db.js` đã bỏ (không ai dùng; env `MONGO_URI` lệch với `MONGODB_URI`).

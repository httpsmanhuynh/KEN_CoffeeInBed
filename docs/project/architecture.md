# Kiến trúc — KEN Coffee In Bed

---

## 🏗️ Tổng quan

Hệ thống đặt chỗ quán cà phê (Coffee In Bed). Monorepo gồm 3 phần chính:

```
KÉN/
├── src/                   ← Angular 22 frontend
├── my-server/             ← Express server phụ (đơn giản, không MongoDB auth)
├── my-server-mongodb/     ← Express 5 + MongoDB 7 — backend chính
├── docs/                  ← Tài liệu dự án (file này đang ở đây)
├── postman/               ← Postman collection API
├── AGENTS.md              ← Hướng dẫn AI Agent
└── CLAUDE.md              ← Hướng dẫn riêng cho Claude
```

---

## 🔧 Tech Stack

| Layer | Công nghệ | Version |
|-------|-----------|---------|
| Frontend | Angular | 22.1 |
| Backend | Express | 5.3 |
| Runtime | Node.js | CommonJS (`"type": "commonjs"`) |
| Database | MongoDB | 7.7 |
| Auth | express-session + bcryptjs | — |
| Test | node:test (built-in) | — |
| Package manager | npm | 11 |

---

## 📂 Backend: `my-server-mongodb/`

```
my-server-mongodb/
├── index.js               ← Entry point: khởi động Express, kết nối MongoDB, mount routes
├── src/
│   ├── config/
│   │   ├── constants.js   ← Hằng số toàn cục (POINT_UNIT_VND, HOLD_MINUTES, ...)
│   │   └── indexes.js     ← ensureIndexes() — tạo MongoDB indexes khi khởi động
│   ├── domain/            ← Business logic thuần (pure functions, không DB)
│   │   ├── loyalty.js     ← Điểm, Coins, Hạng thành viên
│   │   ├── pricing.js     ← Tính giá (voucher, tier discount)
│   │   ├── bookingStateMachine.js ← State machine booking
│   │   └── availability.js ← Kiểm tra khả dụng phòng
│   ├── middleware/
│   │   ├── auth.js        ← requireAuth, requireRole, startSession, destroySession, pwdStamp
│   │   └── rateLimit.js   ← Rate limiting theo IP hoặc user
│   ├── routes/
│   │   ├── auth.js        ← /register, /verify-otp, /login, /login/2fa, /logout, /me
│   │   ├── profile.js     ← /me (PATCH), /me/password, /me/2fa, /me/phone, /me/otp
│   │   └── loyalty.js     ← /tiers, /earn, /redeem, /history, /year-rollover
│   ├── services/
│   │   └── otp.js         ← issueOtp(), verifyOtp()
│   └── utils/
│       └── http.js        ← wrap, fail, str, isDup, publicUser, tierOf, PHONE_RE, EMAIL_RE
└── test/
    ├── auth.test.js
    ├── domain.test.js
    └── loyalty.test.js
```

---

## 🗄️ DB Schema (MongoDB: `ken_space_booking`)

### `users`
```js
{
  _id: ObjectId,
  full_name: String,
  phone: String,            // unique index
  email: String,            // unique partial index
  password_hash: String,
  date_of_birth: Date,
  role: 'CUSTOMER' | 'ADMIN',
  status: 'ACTIVE' | 'LOCKED',
  two_factor_enabled: Boolean,
  password_changed_at: Date,
  tier_id: ObjectId,        // ref: membership_tiers
  tier_points: Number,      // điểm tích lũy
  coin_balance: Number,     // số coins hiện có
  created_at: Date,
  updated_at: Date,
}
```

### `membership_tiers`
```js
{ _id: ObjectId, code: 'BASIC'|'SILVER'|'GOLD'|'DIAMOND', minPoints: Number, percent: Number }
```

### `otp_codes`
```js
{
  _id: ObjectId,
  phone: String,
  purpose: 'REGISTER'|'2FA_LOGIN'|'FORGOT_PASSWORD'|'CHANGE_PASSWORD'|'TOGGLE_2FA'|'CHANGE_PHONE',
  code_hash: String,
  user_id: ObjectId | null,
  pending_data: Object,     // dùng cho REGISTER
  expires_at: Date,         // TTL index: tự xóa sau 24h
  is_used: Boolean,
  attempt_count: Number,
  max_attempts: Number,
}
```

### `bookings`
```js
{
  _id: ObjectId,
  user_id: ObjectId,        // ref: users
  status: 'PENDING_PAYMENT'|'CONFIRMED'|'CHECKED_IN'|'CHECKED_OUT'|'EXPIRED'|'CANCELLED'|'NO_SHOW',
  final_amount: Number,     // số tiền thực trả (integer VNĐ)
  startAt: Date,
  paymentExpiresAt: Date,
  ...
}
```

### `loyalty_transactions`
```js
{
  _id: ObjectId,
  user_id: ObjectId,
  booking_id: ObjectId,     // chỉ có khi type = EARN
  type: 'EARN'|'REDEEM'|'EXPIRE',
  points: Number,
  coins: Number,            // âm khi REDEEM/EXPIRE
  amount: Number,           // số tiền gốc (chỉ EARN)
  description: String,
  created_at: Date,
}
// Index: (booking_id, type) unique partial; (user_id, created_at DESC)
```

### `loyalty_histories`
```js
{
  _id: ObjectId,
  user_id: ObjectId,
  booking_id: ObjectId,     // optional
  action: 'EARN'|'REDEEM'|'YEAR_ROLLOVER',
  points_before: Number,
  points_after: Number,
  coins_before: Number,
  coins_after: Number,
  tier_before: String,
  tier_after: String,
  tier_changed: Boolean,
  created_at: Date,
}
// Index: (user_id, created_at DESC)
```

---

## 🔌 API Routes

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/register` | — | Đăng ký (gửi OTP) |
| POST | `/api/verify-otp` | — | Xác minh OTP → tạo user |
| POST | `/api/login` | — | Đăng nhập |
| POST | `/api/login/2fa` | — | Bước 2 nếu có 2FA |
| POST | `/api/forgot-password` | — | Quên mật khẩu |
| POST | `/api/reset-password` | — | Đặt lại mật khẩu |
| POST | `/api/logout` | — | Đăng xuất |
| GET | `/api/me` | ✅ | Lấy thông tin user |
| POST | `/api/profile/me/otp` | ✅ | Gửi OTP cho thao tác nhạy cảm |
| POST | `/api/profile/me/password` | ✅ | Đổi mật khẩu |
| POST | `/api/profile/me/2fa` | ✅ | Bật/tắt 2FA |
| POST | `/api/profile/me/phone` | ✅ | Đổi SĐT |
| PATCH | `/api/profile/me` | ✅ | Cập nhật hồ sơ |
| GET | `/api/loyalty/tiers` | — | Bảng hạng thành viên |
| POST | `/api/loyalty/earn` | ✅ | Cộng điểm khi checkout |
| POST | `/api/loyalty/redeem` | ✅ | Đổi coins |
| GET | `/api/loyalty/history` | ✅ | Lịch sử giao dịch |
| POST | `/api/loyalty/year-rollover` | 🔒 ADMIN | Rollover cuối năm |

---

## ⚙️ Cấu hình môi trường (`.env`)

```env
PORT=3002
MONGODB_URI=mongodb://127.0.0.1:27017
SESSION_SECRET=your-secret-here
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200
```

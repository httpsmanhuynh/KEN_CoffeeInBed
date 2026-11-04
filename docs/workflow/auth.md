# Workflow: Auth — Xác thực & Quản lý tài khoản

> Khi nhận issue liên quan đến login, đăng ký, OTP, 2FA, session, đổi mật khẩu, đổi SĐT → đọc file này.

---

## 📂 Files liên quan

| File | Vai trò |
|------|---------|
| `my-server-mongodb/src/routes/auth.js` | Đăng ký, login, 2FA, forgot/reset password, logout, /me |
| `my-server-mongodb/src/routes/profile.js` | Đổi mật khẩu, đổi SĐT, đổi email, bật/tắt 2FA |
| `my-server-mongodb/src/middleware/auth.js` | `requireAuth`, `requireRole`, `startSession`, `destroySession`, `pwdStamp` |
| `my-server-mongodb/src/middleware/rateLimit.js` | Rate limiting theo IP và theo user/SĐT |
| `my-server-mongodb/src/services/otp.js` | `issueOtp`, `verifyOtp` |
| `my-server-mongodb/src/utils/http.js` | `publicUser`, `tierOf`, `wrap`, `fail`, `str`, `isDup` |
| `my-server-mongodb/src/config/indexes.js` | Unique index: `users.phone`, `users.email`, `otp_codes.expires_at` |
| `my-server-mongodb/test/auth.test.js` | Test auth routes |

---

## 🗄️ Collections MongoDB

| Collection | Fields quan trọng |
|------------|-------------------|
| `users` | `phone`, `email`, `password_hash`, `role`, `status`, `two_factor_enabled`, `password_changed_at`, `tier_id`, `tier_points`, `coin_balance` |
| `otp_codes` | `phone`, `purpose`, `code_hash`, `user_id`, `pending_data`, `expires_at`, `is_used`, `attempt_count`, `max_attempts` |
| `membership_tiers` | `code` (BASIC/SILVER/GOLD/DIAMOND), `minPoints`, `percent` |

---

## 🔧 Functions quan trọng

### `src/middleware/auth.js`

| Function | Mô tả |
|----------|-------|
| `requireAuth(req,res,next)` | Middleware kiểm tra `req.session.user` |
| `requireRole(role)` | Middleware kiểm tra role |
| `startSession(req, user)` | Tạo session mới (regenerate ID), lưu `{id, role, pwdAt}` |
| `destroySession(req, res)` | Xóa session + clear cookie |
| `pwdStamp(user)` | Trả timestamp `password_changed_at` (ms) — dùng để revoke session cũ |

### `src/utils/http.js`

| Function | Mô tả |
|----------|-------|
| `str(v)` | Sanitize input từ body — trả `''` nếu không phải string |
| `publicUser(u, tier)` | Format user cho response (không lộ password_hash) |
| `tierOf(db, user)` | Lookup `membership_tiers` từ `user.tier_id` |
| `isDup(e)` | Kiểm tra MongoDB duplicate key error (code 11000) |
| `wrap(fn)` | Bọc async route handler, tự catch và forward lỗi |
| `fail(res, status, code, msg)` | Trả JSON error chuẩn |

---

## 🔄 Luồng đăng ký

```
POST /register { fullName, phone, email?, dateOfBirth, password }
  → validate fields
  → check phone/email tồn tại chưa
  → issueOtp(db, { purpose: 'REGISTER', phone, pendingData })
  → res 201 "Đã gửi OTP"

POST /verify-otp { phone, code }
  → verifyOtp → status OK
  → findOne membership_tiers { code: 'BASIC' }
  → insertOne users (tier_id: basic._id, tier_points: 0, coin_balance: 0)
  → res "Kích hoạt thành công"
```

## 🔄 Luồng login (với 2FA)

```
POST /login { identifier, password }
  → bcrypt.compare
  → if two_factor_enabled: session.pending2FA, issueOtp(2FA_LOGIN), res requires2FA
  → else: startSession → res publicUser

POST /login/2fa { code }
  → kiểm tra session.pending2FA
  → verifyOtp(2FA_LOGIN)
  → startSession → res publicUser
```

---

## 🔍 Search keywords khi debug

- **Session bị revoke**: tìm `pwdStamp`, `password_changed_at`, `destroySession`
- **OTP lỗi**: tìm `verifyOtp`, `issueOtp`, `attempt_count`, `max_attempts`
- **Rate limit**: tìm `rateLimit`, `ipLimiter`, `loginLimiter`, `phoneOtpLimiter`
- **Duplicate phone/email**: tìm `isDup`, `11000`, `PHONE_EXISTS`, `EMAIL_EXISTS`
- **2FA**: tìm `two_factor_enabled`, `pending2FA`, `TOGGLE_2FA`

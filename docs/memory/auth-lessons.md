# Memory: Auth — Bài học & Gotcha

> Những điều đã gặp phải khi implement Auth & Profile. Đọc trước khi sửa code liên quan.

---

## 🐛 Gotcha đã gặp

### 1. DUMMY_HASH — timing attack prevention
**Mô tả**: Nếu user không tồn tại, bỏ qua `bcrypt.compare` → response nhanh hơn → lộ user tồn tại  
**Fix hiện tại**: Luôn `bcrypt.compare(password, DUMMY_HASH)` kể cả khi không tìm thấy user:
```js
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);
const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
```
**Lesson**: Không bao giờ short-circuit trước `bcrypt.compare`.

### 2. Session fixation — phải `regenerate` sau login
**Mô tả**: Giữ session ID cũ sau login → attacker có thể pre-set session ID  
**Fix**: `startSession()` luôn gọi `req.session.regenerate()` trước khi gán `session.user`  
**Lesson**: Không gán `session.user` trực tiếp mà không regenerate.

### 3. `pwdStamp` — thu hồi session khi đổi mật khẩu
**Mô tả**: User A đổi mật khẩu → session cũ trên thiết bị khác vẫn còn hiệu lực  
**Fix**: `session.user.pwdAt = pwdStamp(user)` → mỗi request đọc lại từ DB và so sánh  
**Lesson**: Luôn check `pwdStamp(user) !== req.session.user.pwdAt` trong middleware `loadUser`.

### 4. Router mount kép `/api` và `/api/auth`
**Mô tả**: `authRouter` được mount ở cả `/api` và `/api/auth` → `router.use(rateLimiter)` bị đếm đôi  
**Fix**: Gắn rate limiter trực tiếp từng route, không dùng `router.use()`:
```js
// SAI: router.use(ipLimiter) — đếm 2 lần mỗi request
// ĐÚNG: router.post('/login', ipLimiter, loginLimiter, wrap(...))
```

### 5. `verifyOtp` phải check `user_id` ownership
**Mô tả**: User A request OTP cho SĐT của mình → User B dùng OTP đó để verify  
**Fix**: Luôn check `otp.user_id === user._id` sau `verifyOtp`:
```js
const otpNotOwned = (otp, user) => !!(otp?.user_id && String(otp.user_id) !== String(user._id));
if (status !== 'OK' || otpNotOwned(otp, user)) return otpError(res, ...);
```

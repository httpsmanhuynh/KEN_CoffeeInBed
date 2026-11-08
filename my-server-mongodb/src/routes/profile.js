'use strict';
// Hồ sơ người dùng (BR-A06, BR-A08). Khớp schema Atlas như auth.js.
// - Đổi mật khẩu / bật-tắt 2FA: mật khẩu hiện tại + OTP gửi về SĐT đã đăng ký.
// - Đổi SĐT: mật khẩu hiện tại + OTP gửi về SỐ MỚI.
// - Đổi email: chỉ cần mật khẩu hiện tại.
const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, startSession, destroySession } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { issueOtp, verifyOtp } = require('../services/otp');
const {
  PHONE_RE,
  EMAIL_RE,
  wrap,
  fail,
  str,
  isDup,
  validNewPassword,
  otpError,
  publicUser,
} = require('../utils/http');

const router = express.Router();
// Giới hạn theo user đã đăng nhập (không theo IP): chặn spam OTP và dò "mật khẩu hiện tại" bằng session bị đánh cắp.
const byUser = (req) => `u:${req.session.user.id}`;
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, key: byUser });
const sensitiveLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: byUser });

const guard = [requireAuth]; // requireAuth đã kiểm tra DB (status + pwdAt) và gán req.user (BR-A05)

// Trả true nếu đúng; sai thì đã trả lỗi 422 (không dùng 401 để Angular không tự đăng xuất).
async function checkCurrentPassword(req, res) {
  const pw = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  if (pw && (await bcrypt.compare(pw, req.user.password_hash))) return true;
  fail(res, 422, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng');
  return false;
}

// OTP phải do chính user này yêu cầu (tránh dùng OTP của người khác gửi tới cùng số).
const otpNotOwned = (otp, user) =>
  !!(otp && otp.user_id && String(otp.user_id) !== String(user._id));

// Gửi OTP: CHANGE_PASSWORD / TOGGLE_2FA -> SĐT đã đăng ký; CHANGE_PHONE -> số mới.
router.post(
  '/me/otp',
  ...guard,
  otpLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    const purpose = str(req.body.purpose);

    if (purpose === 'CHANGE_PASSWORD' || purpose === 'TOGGLE_2FA') {
      await issueOtp(db, { userId: user._id, purpose, phone: user.phone, email: user.email });
      return res.json({ message: 'Đã gửi OTP về số điện thoại đã đăng ký' });
    }
    if (purpose === 'CHANGE_PHONE') {
      const newPhone = str(req.body.newPhone);
      if (!PHONE_RE.test(newPhone))
        return fail(res, 422, 'VALIDATION_ERROR', 'Số điện thoại mới không hợp lệ');
      if (newPhone === user.phone)
        return fail(res, 422, 'PHONE_UNCHANGED', 'Số điện thoại mới trùng số hiện tại');
      if (await db.collection('users').findOne({ phone: newPhone }))
        return fail(res, 409, 'PHONE_EXISTS', 'Số điện thoại đã được đăng ký');
      await issueOtp(db, { userId: user._id, purpose, phone: newPhone, email: user.email });
      return res.json({ message: 'Đã gửi OTP về số điện thoại mới' });
    }
    return fail(res, 422, 'VALIDATION_ERROR', 'Mục đích OTP không hợp lệ');
  }),
);

// Đổi mật khẩu: mật khẩu hiện tại + OTP CHANGE_PASSWORD
router.post(
  '/me/password',
  ...guard,
  sensitiveLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    const { newPassword, confirmPassword } = req.body;
    if (!validNewPassword(newPassword) || newPassword !== confirmPassword)
      return fail(res, 422, 'VALIDATION_ERROR', 'Mật khẩu mới không hợp lệ hoặc không khớp');
    if (!(await checkCurrentPassword(req, res))) return;
    if (newPassword === req.body.currentPassword)
      return fail(res, 422, 'VALIDATION_ERROR', 'Mật khẩu mới phải khác mật khẩu hiện tại');

    const { status, otp } = await verifyOtp(db, {
      phone: user.phone,
      purpose: 'CHANGE_PASSWORD',
      code: str(req.body.code),
    });
    if (status !== 'OK' || otpNotOwned(otp, user))
      return otpError(res, status === 'OK' ? 'INVALID' : status);

    const changedAt = new Date();
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password_hash: await bcrypt.hash(newPassword, 10),
          password_changed_at: changedAt,
          updated_at: changedAt,
        },
      },
    );
    // đổi session ID + cập nhật mốc đổi mật khẩu: các session khác của user bị thu hồi ở requireAuth (BR-A05)
    await startSession(req, { ...user, password_changed_at: changedAt });
    res.json({ message: 'Đã đổi mật khẩu' });
  }),
);

// Bật/tắt 2FA: mật khẩu hiện tại + OTP TOGGLE_2FA
router.post(
  '/me/2fa',
  ...guard,
  sensitiveLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    if (typeof req.body.enabled !== 'boolean')
      return fail(res, 422, 'VALIDATION_ERROR', 'Giá trị enabled phải là true hoặc false');
    const enabled = req.body.enabled;
    if (enabled === !!user.two_factor_enabled)
      return fail(res, 422, 'TWO_FACTOR_UNCHANGED', enabled ? '2FA đã được bật' : '2FA đang tắt');
    if (!(await checkCurrentPassword(req, res))) return;

    const { status, otp } = await verifyOtp(db, {
      phone: user.phone,
      purpose: 'TOGGLE_2FA',
      code: str(req.body.code),
    });
    if (status !== 'OK' || otpNotOwned(otp, user))
      return otpError(res, status === 'OK' ? 'INVALID' : status);

    await db
      .collection('users')
      .updateOne(
        { _id: user._id },
        { $set: { two_factor_enabled: enabled, updated_at: new Date() } },
      );
    res.json({ twoFactorEnabled: enabled });
  }),
);

// Đổi SĐT: mật khẩu hiện tại + OTP CHANGE_PHONE (đã gửi về số mới)
router.post(
  '/me/phone',
  ...guard,
  sensitiveLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    const newPhone = str(req.body.newPhone);
    if (!PHONE_RE.test(newPhone))
      return fail(res, 422, 'VALIDATION_ERROR', 'Số điện thoại mới không hợp lệ');
    if (!(await checkCurrentPassword(req, res))) return;

    const { status, otp } = await verifyOtp(db, {
      phone: newPhone,
      purpose: 'CHANGE_PHONE',
      code: str(req.body.code),
    });
    if (status !== 'OK' || otpNotOwned(otp, user))
      return otpError(res, status === 'OK' ? 'INVALID' : status);

    try {
      await db
        .collection('users')
        .updateOne({ _id: user._id }, { $set: { phone: newPhone, updated_at: new Date() } });
    } catch (e) {
      if (isDup(e)) return fail(res, 409, 'PHONE_EXISTS', 'Số điện thoại đã được đăng ký');
      throw e;
    }
    res.json({ message: 'Đã đổi số điện thoại', phone: newPhone });
  }),
);

// Cập nhật hồ sơ: fullName; đổi email chỉ cần mật khẩu hiện tại (email rỗng = xóa email)
router.patch(
  '/me',
  ...guard,
  sensitiveLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    const set = {};
    const unset = {};

    if ('fullName' in req.body) {
      const fullName = str(req.body.fullName);
      if (fullName.length < 2 || fullName.length > 100)
        return fail(res, 422, 'VALIDATION_ERROR', 'Họ tên không hợp lệ');
      set.full_name = fullName;
    }
    if ('email' in req.body) {
      const email = str(req.body.email).toLowerCase();
      if (email && (!EMAIL_RE.test(email) || email.length > 100))
        return fail(res, 422, 'VALIDATION_ERROR', 'Email không hợp lệ');
      if (!(await checkCurrentPassword(req, res))) return;
      if (email) set.email = email;
      else unset.email = '';
    }
    if (!Object.keys(set).length && !Object.keys(unset).length)
      return fail(res, 422, 'VALIDATION_ERROR', 'Không có thông tin để cập nhật');

    set.updated_at = new Date();
    const update = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;
    try {
      await db.collection('users').updateOne({ _id: user._id }, update);
    } catch (e) {
      if (isDup(e)) return fail(res, 409, 'EMAIL_EXISTS', 'Email đã được sử dụng');
      throw e;
    }
    const fresh = await db.collection('users').findOne({ _id: user._id });
    const tier = await db.collection('membership_tiers').findOne({ _id: fresh.tier_id });
    res.json(publicUser(fresh, tier));
  }),
);

module.exports = router;

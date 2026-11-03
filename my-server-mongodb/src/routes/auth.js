'use strict';
// Khớp schema Atlas (database/schemas): users.status = ACTIVE|LOCKED, users.tier_id -> membership_tiers,
// users.coin_balance; otp_codes dùng user_id / is_used / attempt_count / max_attempts.
// Luồng đăng ký: /register chỉ lưu thông tin vào otp_codes.pending_data; user chỉ được tạo ở /verify-otp.
const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { requireAuth, startSession, destroySession, pwdStamp } = require('../middleware/auth');
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
  tierOf,
} = require('../utils/http');

const router = express.Router();
// Gắn từng route (không router.use): router này mount ở cả /api và /api/auth nên router.use sẽ đếm đôi.
const ipLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
// Theo tài khoản/SĐT (không chỉ IP): chống dò mật khẩu phân tán và spam SMS OTP vào số người khác (BR-A08).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `login:${str(req.body && req.body.identifier).toLowerCase()}`,
});
const phoneOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  key: (req) => `otp:${str(req.body && req.body.phone)}`,
});

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10); // giữ thời gian phản hồi đều khi user không tồn tại

// BR-A03: đăng ký -> lưu tạm vào otp_codes.pending_data -> OTP REGISTER (chưa tạo user)
router.post(
  '/register',
  ipLimiter,
  phoneOtpLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const fullName = str(req.body.fullName),
      phone = str(req.body.phone),
      email = str(req.body.email).toLowerCase();
    const dob = new Date(str(req.body.dateOfBirth)),
      password = typeof req.body.password === 'string' ? req.body.password : '';
    if (
      fullName.length < 2 ||
      fullName.length > 100 ||
      !PHONE_RE.test(phone) ||
      Number.isNaN(dob.getTime()) ||
      dob > new Date() ||
      !validNewPassword(password) ||
      (email && (!EMAIL_RE.test(email) || email.length > 100))
    )
      return fail(res, 422, 'VALIDATION_ERROR', 'Thông tin đăng ký không hợp lệ');

    const users = db.collection('users');
    if (await users.findOne({ phone }))
      return fail(res, 409, 'PHONE_EXISTS', 'Số điện thoại đã được đăng ký');
    if (email && (await users.findOne({ email })))
      return fail(res, 409, 'EMAIL_EXISTS', 'Email đã được sử dụng');

    const pendingData = {
      full_name: fullName,
      date_of_birth: dob,
      password_hash: await bcrypt.hash(password, 10),
    };
    if (email) pendingData.email = email;
    await issueOtp(db, { userId: null, purpose: 'REGISTER', phone, pendingData });
    res.status(201).json({ message: 'Đã gửi OTP xác minh' });
  }),
);

// Xác minh OTP đăng ký -> tạo user ACTIVE với hạng BASIC
router.post(
  '/verify-otp',
  ipLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const phone = str(req.body.phone);
    const { status, otp } = await verifyOtp(db, {
      phone,
      purpose: 'REGISTER',
      code: str(req.body.code),
    });
    if (status !== 'OK') return otpError(res, status);

    const basic = await db.collection('membership_tiers').findOne({ code: 'BASIC' });
    if (!basic)
      throw new Error(
        'Thiếu hạng BASIC trong membership_tiers (chạy npm run setup ở thư mục database)',
      );
    const p = otp.pending_data,
      now = new Date();
    const doc = {
      full_name: p.full_name,
      phone,
      password_hash: p.password_hash,
      date_of_birth: p.date_of_birth,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      two_factor_enabled: false,
      tier_id: basic._id,
      tier_points: 0,
      coin_balance: 0,
      created_at: now,
      updated_at: now,
    };
    if (p.email) doc.email = p.email;
    try {
      await db.collection('users').insertOne(doc);
    } catch (e) {
      if (isDup(e))
        return e.keyPattern && e.keyPattern.email
          ? fail(res, 409, 'EMAIL_EXISTS', 'Email đã được sử dụng')
          : fail(res, 409, 'PHONE_EXISTS', 'Số điện thoại đã được đăng ký');
      throw e;
    }
    res.json({ message: 'Kích hoạt tài khoản thành công' });
  }),
);

// BR-A05, BR-A08: mật khẩu -> (2FA: OTP) -> startSession
router.post(
  '/login',
  ipLimiter,
  loginLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const identifier = str(req.body.identifier),
      password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = identifier
      ? await db
          .collection('users')
          .findOne({ $or: [{ phone: identifier }, { email: identifier.toLowerCase() }] })
      : null;
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return fail(res, 401, 'INVALID_CREDENTIALS', 'Sai thông tin đăng nhập');
    if (user.status !== 'ACTIVE') return fail(res, 403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');

    if (user.two_factor_enabled) {
      req.session.pending2FA = { userId: String(user._id) }; // KHÔNG gán session.user ở bước này
      await issueOtp(db, { userId: user._id, purpose: '2FA_LOGIN', phone: user.phone });
      return res.json({ requires2FA: true });
    }
    await startSession(req, user);
    res.json({ user: publicUser(user, await tierOf(db, user)) });
  }),
);

router.post(
  '/login/2fa',
  ipLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const pending = req.session.pending2FA;
    if (!pending) return fail(res, 401, 'UNAUTHENTICATED', 'Chưa đăng nhập bước 1');
    const user = await db.collection('users').findOne({ _id: new ObjectId(pending.userId) });
    if (!user || user.status !== 'ACTIVE')
      return fail(res, 403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
    const { status } = await verifyOtp(db, {
      phone: user.phone,
      purpose: '2FA_LOGIN',
      code: str(req.body.code),
    });
    if (status === 'TOO_MANY') {
      await destroySession(req, res);
      return otpError(res, status);
    } // hủy session khi quá số lần thử
    if (status !== 'OK') return otpError(res, status);
    await startSession(req, user);
    res.json({ user: publicUser(user, await tierOf(db, user)) });
  }),
);

// BR-A07: OTP luôn gửi về SĐT đã đăng ký; luôn trả 200 để không lộ SĐT có tồn tại hay không
router.post(
  '/forgot-password',
  ipLimiter,
  phoneOtpLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = await db
      .collection('users')
      .findOne({ phone: str(req.body.phone), status: 'ACTIVE' });
    if (user)
      await issueOtp(db, { userId: user._id, purpose: 'FORGOT_PASSWORD', phone: user.phone });
    res.json({ message: 'Nếu số điện thoại đã đăng ký, OTP đã được gửi' });
  }),
);

router.post(
  '/reset-password',
  ipLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { newPassword, confirmPassword } = req.body;
    if (!validNewPassword(newPassword) || newPassword !== confirmPassword)
      return fail(res, 422, 'VALIDATION_ERROR', 'Mật khẩu mới không hợp lệ hoặc không khớp');
    const user = await db
      .collection('users')
      .findOne({ phone: str(req.body.phone), status: 'ACTIVE' });
    if (!user) return fail(res, 422, 'OTP_INVALID', 'Mã OTP không đúng');
    const { status } = await verifyOtp(db, {
      phone: user.phone,
      purpose: 'FORGOT_PASSWORD',
      code: str(req.body.code),
    });
    if (status !== 'OK') return otpError(res, status);
    await db
      .collection('users')
      .updateOne(
        { _id: user._id },
        {
          $set: {
            password_hash: await bcrypt.hash(newPassword, 10),
            password_changed_at: new Date(),
            updated_at: new Date(),
          },
        },
      );
    res.json({ message: 'Đã đặt lại mật khẩu' });
  }),
);

// Đăng xuất dùng POST (không đổi dữ liệu bằng GET - chống CSRF)
router.post(
  '/logout',
  ipLimiter,
  wrap(async (req, res) => {
    await destroySession(req, res);
    res.status(204).end();
  }),
);

// Kiểm tra lại khóa tài khoản từ DB (BR-A05) - session cũ không dùng được nếu Admin đã khóa
router.get(
  ['/me', '/profile'],
  ipLimiter,
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.user.id) });
    // BR-A05: bị khóa hoặc đã đổi/reset mật khẩu sau khi session này được tạo => thu hồi session
    if (!user || user.status !== 'ACTIVE' || pwdStamp(user) !== req.session.user.pwdAt) {
      await destroySession(req, res);
      return fail(res, 401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập');
    }
    res.json(publicUser(user, await tierOf(db, user)));
  }),
);

module.exports = router;

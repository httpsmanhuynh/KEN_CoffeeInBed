'use strict';
// Helper dùng chung cho các route (trước đây trùng ở auth.js và profile.js).
const PHONE_RE = /^0\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_BYTES = 72; // bcrypt chỉ dùng 72 byte đầu

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, status, code, message) => res.status(status).json({ code, message });
const str = (v) => (typeof v === 'string' ? v.trim() : ''); // chặn object/$operator (NoSQL injection)
const isDup = (e) => e && e.code === 11000;
const validNewPassword = (p) =>
  typeof p === 'string' && p.length >= 8 && Buffer.byteLength(p, 'utf8') <= MAX_PASSWORD_BYTES;

const otpError = (res, status) =>
  status === 'EXPIRED'
    ? fail(res, 422, 'OTP_EXPIRED', 'Mã OTP đã hết hạn')
    : status === 'TOO_MANY'
      ? fail(res, 429, 'OTP_TOO_MANY_ATTEMPTS', 'Nhập sai quá số lần cho phép')
      : fail(res, 422, 'OTP_INVALID', 'Mã OTP không đúng');

const publicUser = (u, tier) => ({
  id: String(u._id),
  fullName: u.full_name,
  phone: u.phone,
  email: u.email || null,
  role: u.role,
  twoFactorEnabled: !!u.two_factor_enabled,
  membershipTier: tier ? tier.code : 'BASIC',
  tierPoints: u.tier_points,
  coinsBalance: u.coin_balance,
});
const tierOf = (db, user) => db.collection('membership_tiers').findOne({ _id: user.tier_id });

module.exports = {
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
};

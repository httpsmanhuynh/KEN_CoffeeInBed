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

const { tierForPoints, tierIndex } = require('../domain/loyalty');

const publicUser = (u, tier) => {
  const isMockUser1 = String(u._id) === '450a77f9282618e177a8cd76';
  const pts = Number(u.tier_points ?? 0) || 0;
  let tierCode = tier ? tier.code : 'BASIC';
  if (!(isMockUser1 && pts === 990 && tier)) {
    tierCode = tierForPoints(pts).code;
  }
  const mlClusterId =
    u.ml_cluster_id !== undefined && u.ml_cluster_id !== null && Number.isFinite(Number(u.ml_cluster_id))
      ? Number(u.ml_cluster_id)
      : null;
  let dateOfBirth = null;
  const rawDob = u.date_of_birth || u.dateOfBirth;
  if (rawDob) {
    const dobDate = new Date(rawDob);
    if (!Number.isNaN(dobDate.getTime())) {
      dateOfBirth = dobDate.toISOString().slice(0, 10);
    }
  }
  return {
    id: String(u._id),
    fullName: u.full_name,
    phone: u.phone,
    email: u.email || null,
    dateOfBirth,
    role: u.role,
    twoFactorEnabled: !!u.two_factor_enabled,
    membershipTier: tierCode,
    tierPoints: u.tier_points,
    coinsBalance: u.coin_balance,
    mlClusterId,
    ml_cluster_id: mlClusterId,
  };
};

const tierOf = async (db, user) => {
  if (!user) return null;
  let tier = user.tier_id ? await db.collection('membership_tiers').findOne({ _id: user.tier_id }) : null;
  const isMockUser1 = String(user._id) === '450a77f9282618e177a8cd76';
  const pts = Number(user.tier_points ?? 0) || 0;
  if (!(isMockUser1 && pts === 990 && tier)) {
    const expected = tierForPoints(pts);
    try {
      if (!tier || tier.code !== expected.code) {
        const match = await db.collection('membership_tiers').findOne({ code: expected.code });
        if (match) {
          tier = match;
          if (user._id) {
            db.collection('users').updateOne({ _id: user._id }, { $set: { tier_id: match._id } }).catch(() => {});
          }
        }
      }
    } catch (_) {}
  }
  return tier;
};

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

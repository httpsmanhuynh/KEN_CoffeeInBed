'use strict';
// BR-A08: OTP lưu hash, có hạn, giới hạn số lần thử, đánh dấu đã dùng.
// Tên field và purpose khớp database/schemas/otp_codes.validator.json
//   purpose: REGISTER | 2FA_LOGIN | FORGOT_PASSWORD | CHANGE_PASSWORD | CHANGE_PHONE | TOGGLE_2FA
//   REGISTER: user_id = null và BẮT BUỘC có pending_data. Các purpose khác: BẮT BUỘC có user_id.
const crypto = require('crypto');

const ttlSeconds = () => Number(process.env.OTP_TTL_SECONDS) || 300;
const maxAttempts = () => Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const hashCode = (code) =>
  crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret')
    .update(String(code))
    .digest('hex');

// SMS_PROVIDER=mock: chỉ in ra console khi KHÔNG phải production.
async function sendSms(phone, text) {
  if ((process.env.SMS_PROVIDER || 'mock') === 'mock') {
    if (process.env.NODE_ENV !== 'production') console.log(`[SMS mock] ${phone}: ${text}`);
    return;
  }
  throw new Error('SMS provider chưa được hỗ trợ');
}

// userId: null khi purpose = REGISTER (kèm pendingData); các purpose khác phải có userId.
async function issueOtp(db, { userId = null, purpose, phone, pendingData }) {
  const col = db.collection('otp_codes');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const now = new Date();
  // vô hiệu mã cũ cùng số điện thoại + mục đích (khớp index idx_otp_phone_purpose_used)
  await col.updateMany({ phone, purpose, is_used: false }, { $set: { is_used: true } });
  const doc = {
    user_id: userId,
    phone,
    purpose,
    code_hash: hashCode(code),
    expires_at: new Date(now.getTime() + ttlSeconds() * 1000),
    attempt_count: 0,
    max_attempts: maxAttempts(),
    is_used: false,
    created_at: now,
  };
  if (pendingData) doc.pending_data = pendingData;
  await col.insertOne(doc);
  await sendSms(
    phone,
    `Ma OTP KEN cua ban: ${code}. Het han sau ${Math.floor(ttlSeconds() / 60)} phut.`,
  );
}

// Trả về { status: 'OK' | 'INVALID' | 'EXPIRED' | 'TOO_MANY', otp }
// otp (khi OK) chứa user_id / pending_data để route dùng tiếp.
async function verifyOtp(db, { phone, purpose, code }) {
  const col = db.collection('otp_codes');
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { status: 'INVALID' };
  const otp = await col.findOne({ phone, purpose, is_used: false }, { sort: { created_at: -1 } });
  if (!otp) return { status: 'INVALID' };
  if (otp.expires_at <= new Date()) return { status: 'EXPIRED' };
  const bump = await col.updateOne(
    { _id: otp._id, is_used: false, attempt_count: { $lt: otp.max_attempts } },
    { $inc: { attempt_count: 1 } },
  );
  if (bump.matchedCount === 0) return { status: 'TOO_MANY' };
  const a = Buffer.from(otp.code_hash, 'hex');
  const b = Buffer.from(hashCode(code), 'hex');
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    const done = await col.updateOne({ _id: otp._id, is_used: false }, { $set: { is_used: true } });
    return done.matchedCount === 1 ? { status: 'OK', otp } : { status: 'INVALID' };
  }
  return { status: otp.attempt_count + 1 >= otp.max_attempts ? 'TOO_MANY' : 'INVALID' };
}

module.exports = { issueOtp, verifyOtp };

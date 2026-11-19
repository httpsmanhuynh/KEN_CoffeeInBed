'use strict';
// Hồ sơ người dùng (BR-A06, BR-A08). Khớp schema Atlas như auth.js.
// - Đổi mật khẩu / bật-tắt 2FA: mật khẩu hiện tại + OTP gửi về SĐT đã đăng ký.
// - Đổi SĐT: mật khẩu hiện tại + OTP gửi về SỐ MỚI.
// - Đổi email: chỉ cần mật khẩu hiện tại.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { requireAuth, startSession, destroySession } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { issueOtp, verifyOtp } = require('../services/otp');
const { releaseVoucherIfNeeded } = require('../services/bookingService');
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
    if ('dateOfBirth' in req.body) {
      const dobRaw = req.body.dateOfBirth === null ? '' : str(req.body.dateOfBirth);
      if (!dobRaw) {
        set.date_of_birth = null;
      } else {
        const dob = new Date(dobRaw);
        if (Number.isNaN(dob.getTime()) || dob > new Date())
          return fail(res, 422, 'VALIDATION_ERROR', 'Ngày sinh không hợp lệ');
        set.date_of_birth = dob;
      }
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

function buildDeletedPhone(userId) {
  const hex = String(userId || '').replace(/[^0-9a-f]/gi, '');
  if (hex.length >= 24) return `X${hex.slice(0, 8)}${hex.slice(-6)}`; // 15 ký tự <= maxLength 15 trên Atlas
  return `X${crypto.randomBytes(7).toString('hex')}`;
}

function isDeletedPhone(val) {
  return /^(X[0-9a-f]{14}|deleted_)/i.test(String(val || ''));
}

// Xóa tài khoản:
// 1. Chặn xóa khi khách hàng đang có đơn CHECKED_IN tại không gian.
// 2. Chép thông tin liên hệ sang các đơn đặt chỗ còn thiếu để Admin vẫn xem được SĐT/email gốc.
// 3. Hủy các đơn sắp tới (PENDING_PAYMENT/CONFIRMED có start_at > now), tự động hoàn tiền cho đơn đã thanh toán & giải phóng voucher; giữ nguyên lịch sử đơn quá khứ.
// 4. Khóa tài khoản, lưu original_phone/original_email/deleted_at và giải phóng phone/email để người dùng có thể đăng ký lại.
router.delete(
  '/me',
  ...guard,
  sensitiveLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    const now = new Date();
    const bookingsCol = db.collection('bookings');

    const activeCheckedIn = await bookingsCol.findOne({
      user_id: user._id,
      status: 'CHECKED_IN',
    });
    if (activeCheckedIn) {
      return fail(
        res,
        409,
        'ACTIVE_CHECKED_IN_BOOKING',
        'Bạn đang có phiên sử dụng không gian (đã check-in), vui lòng hoàn tất check-out trước khi xóa tài khoản',
      );
    }

    const origName = user.full_name ? String(user.full_name).slice(0, 100) : null;
    const origPhone =
      user.phone && !isDeletedPhone(user.phone)
        ? String(user.phone).slice(0, 20)
        : user.original_phone || null;
    const origEmail = user.email ? String(user.email).slice(0, 100) : user.original_email || null;

    if (origName) {
      await bookingsCol.updateMany(
        {
          user_id: user._id,
          $or: [{ contact_name: null }, { contact_name: '' }, { contact_name: { $exists: false } }],
        },
        { $set: { contact_name: origName } },
      );
    }
    if (origPhone) {
      await bookingsCol.updateMany(
        {
          user_id: user._id,
          $or: [{ contact_phone: null }, { contact_phone: '' }, { contact_phone: { $exists: false } }],
        },
        { $set: { contact_phone: origPhone } },
      );
    }
    if (origEmail) {
      await bookingsCol.updateMany(
        {
          user_id: user._id,
          $or: [{ contact_email: null }, { contact_email: '' }, { contact_email: { $exists: false } }],
        },
        { $set: { contact_email: origEmail } },
      );
    }

    const upcomingBookings = await bookingsCol
      .find({
        user_id: user._id,
        status: { $in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        start_at: { $gt: now },
      })
      .toArray();

    let refundedCount = 0;
    const autoRefundNote = 'Tự động hoàn tiền khi khách hàng xóa tài khoản';
    for (const b of upcomingBookings) {
      const released = await releaseVoucherIfNeeded(db, b, now, null);
      const needsRefund = b.status === 'CONFIRMED' && Number(b.final_amount) > 0;
      if (needsRefund) {
        const refundAmount = Math.round(Number(b.final_amount));
        await db.collection('payment_transactions').insertOne({
          _id: new ObjectId(),
          booking_id: b._id,
          txn_type: 'REFUND',
          status: 'SUCCESS',
          method: 'SIMULATION',
          amount: refundAmount,
          gateway_ref: `DEL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          note: autoRefundNote,
          created_at: now,
          completed_at: now,
        });
        await bookingsCol.updateOne(
          { _id: b._id },
          {
            $set: {
              status: 'CANCELLED',
              cancelled_at: now,
              refund_status: 'REFUNDED',
              refund_amount: refundAmount,
              refund_note: autoRefundNote,
              ...(released ? { voucher_usage_released: true } : {}),
              updated_at: now,
            },
          },
        );
        refundedCount += 1;
      } else {
        await bookingsCol.updateOne(
          { _id: b._id },
          {
            $set: {
              status: 'CANCELLED',
              cancelled_at: now,
              refund_status: 'NONE',
              refund_amount: 0,
              ...(released ? { voucher_usage_released: true } : {}),
              updated_at: now,
            },
          },
        );
      }
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          status: 'LOCKED',
          phone: buildDeletedPhone(user._id),
          deleted_at: now,
          original_phone: origPhone,
          original_email: origEmail,
          updated_at: now,
        },
        $unset: {
          email: '',
        },
      },
    );
    await destroySession(req, res);
    res.json({
      deleted: true,
      cancelledUpcomingCount: upcomingBookings.length,
      refundedCount,
      message: 'Đã xóa tài khoản',
    });
  }),
);

module.exports = router;

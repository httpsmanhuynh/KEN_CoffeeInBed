'use strict';

const { AdminError } = require('./adminError');

const USER_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', LOCKED: 'LOCKED' });

/** Khóa/Mở khóa: trạng thái nguồn phải có, đích là trạng thái còn lại. */
const TRANSITIONS = Object.freeze({
  lock: { from: USER_STATUS.ACTIVE, to: USER_STATUS.LOCKED },
  unlock: { from: USER_STATUS.LOCKED, to: USER_STATUS.ACTIVE },
});

/** Xóa các key nhạy cảm (mật khẩu, hash, OTP, token, secret) khỏi hồ sơ user trả cho Admin. */
const SENSITIVE_KEY = /(pass|hash|secret|otp|token)/i;

function sanitizeUser(user) {
  if (!user) return user;
  const out = {};
  for (const [k, v] of Object.entries(user)) {
    if (!SENSITIVE_KEY.test(k)) out[k] = v;
  }
  return out;
}

/**
 * Kiểm tra Admin có được phép đổi trạng thái tài khoản không.
 * Trả về { from, to } để service dùng làm điều kiện cập nhật nguyên tử.
 * - Không tự khóa chính mình.
 * - Không khóa tài khoản ADMIN khác.
 * - lock chỉ áp cho ACTIVE; unlock chỉ áp cho LOCKED.
 */
function decideStatusChange({ actorId, target, action }) {
  const t = TRANSITIONS[action];
  if (!t) throw new AdminError(400, 'INVALID_ACTION', 'Hành động không hợp lệ (lock | unlock).');
  if (!target) throw new AdminError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');

  if (action === 'lock') {
    if (String(target._id) === String(actorId)) {
      throw new AdminError(403, 'CANNOT_LOCK_SELF', 'Không thể tự khóa tài khoản của chính mình.');
    }
    if (target.role === 'ADMIN') {
      throw new AdminError(403, 'CANNOT_LOCK_ADMIN', 'Không thể khóa tài khoản Admin.');
    }
  }

  if (target.status === t.to) {
    throw new AdminError(
      409,
      action === 'lock' ? 'USER_ALREADY_LOCKED' : 'USER_ALREADY_ACTIVE',
      action === 'lock' ? 'Tài khoản đã bị khóa.' : 'Tài khoản đang hoạt động.'
    );
  }
  if (target.status !== t.from) {
    throw new AdminError(409, 'INVALID_USER_STATE', `Không thể ${action} tài khoản ở trạng thái ${target.status}.`);
  }
  return { from: t.from, to: t.to };
}

module.exports = { USER_STATUS, TRANSITIONS, sanitizeUser, decideStatusChange };

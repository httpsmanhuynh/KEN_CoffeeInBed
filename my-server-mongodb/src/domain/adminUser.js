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
 * Bảng hạng thành viên (BR-H04) — giữ đồng bộ với src/domain/loyalty.js.
 * Sắp xếp tăng dần theo điểm tối thiểu.
 */
const TIER_LADDER = Object.freeze([
  { code: 'BASIC', name: 'KÉN Mới', minPoints: 0 },
  { code: 'SILVER', name: 'KÉN Bạc', minPoints: 1000 },
  { code: 'GOLD', name: 'KÉN Vàng', minPoints: 5000 },
  { code: 'DIAMOND', name: 'KÉN Kim Cương', minPoints: 10000 },
]);

function tierByPoints(points) {
  const p = Number(points) || 0;
  let found = TIER_LADDER[0];
  for (const t of TIER_LADDER) if (p >= t.minPoints) found = t;
  return found;
}

/**
 * Hạng, KÉN Điểm và KÉN Coins hiển thị trong danh sách / hồ sơ khách (UC-29).
 * Điểm = users.tier_points, Coins = users.coin_balance. Hạng lấy từ users.tier nếu có và hợp lệ,
 * nếu không thì suy ra từ điểm theo bảng hạng.
 */
function loyaltyOf(user) {
  const u = user || {};
  const points = Number(u.tier_points) || 0;
  const coins = Number(u.coin_balance) || 0;
  const stored = String(u.tier || '').toUpperCase();
  const tier = TIER_LADDER.find((t) => t.code === stored) || tierByPoints(points);
  return { tier: tier.code, tierName: tier.name, points, coins };
}

/**
 * Điều kiện Mongo lọc theo hạng: ưu tiên field `tier` nếu có, nếu không thì theo khoảng điểm.
 * Mã hạng lạ -> chỉ khớp field `tier` (kết quả rỗng như trước đây).
 */
function tierFilter(code) {
  const c = String(code).toUpperCase();
  const i = TIER_LADDER.findIndex((t) => t.code === c);
  if (i < 0) return { tier: c };
  const range = { $gte: TIER_LADDER[i].minPoints };
  if (i + 1 < TIER_LADDER.length) range.$lt = TIER_LADDER[i + 1].minPoints;
  return { $or: [{ tier: c }, { tier: { $exists: false }, tier_points: range }] };
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

module.exports = { USER_STATUS, TRANSITIONS, TIER_LADDER, sanitizeUser, loyaltyOf, tierFilter, decideStatusChange };

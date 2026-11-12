'use strict';
/**
 * Kiểm thử đơn vị Module 11 — Admin User Domain (src/domain/adminUser.js).
 * Mã TC đồng bộ 100% với sheet Test_Module11_Admin_Dashboard (TC-ADM-01..64) và Postman Collection Module 11.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideStatusChange, sanitizeUser, loyaltyOf, tierFilter } = require('../../src/domain/adminUser');

const admin = { _id: 'A1', role: 'ADMIN', status: 'ACTIVE' };
const cust = { _id: 'C1', role: 'CUSTOMER', status: 'ACTIVE' };

test('TC-ADM-07\t[ADM-07] Khóa tài khoản ACTIVE -> LOCKED (ADM-B07)', () => {
  assert.deepEqual(decideStatusChange({ actorId: 'A1', target: cust, action: 'lock' }), { from: 'ACTIVE', to: 'LOCKED' });
});

test('TC-ADM-10\t[ADM-10] Mở khóa tài khoản LOCKED -> ACTIVE (ADM-B10)', () => {
  assert.deepEqual(
    decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'LOCKED' }, action: 'unlock' }),
    { from: 'LOCKED', to: 'ACTIVE' }
  );
});

test('TC-ADM-12, TC-ADM-36\t[ADM-12, ADM-36] Admin không tự khóa chính mình (403 CANNOT_LOCK_SELF) và không khóa Admin khác (403 CANNOT_LOCK_ADMIN) (ADM-B12; ADM-B36)', () => {
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: admin, action: 'lock' }),
    (e) => e.code === 'CANNOT_LOCK_SELF' && e.status === 403
  );
  assert.throws(
    () => decideStatusChange({ actorId: 'A2', target: admin, action: 'lock' }),
    (e) => e.code === 'CANNOT_LOCK_ADMIN' && e.status === 403
  );
});

test('TC-ADM-35\t[ADM-35] Khóa user đã LOCKED / mở khóa user đã ACTIVE -> 409 (ADM-B35)', () => {
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'LOCKED' }, action: 'lock' }),
    (e) => e.code === 'USER_ALREADY_LOCKED' && e.status === 409
  );
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: cust, action: 'unlock' }),
    (e) => e.code === 'USER_ALREADY_ACTIVE' && e.status === 409
  );
});

test('TC-ADM-11\t[ADM-11] Khóa user có trạng thái ngoài ACTIVE/LOCKED (dữ liệu lạ, vd. DELETED) -> 409 INVALID_USER_STATE (ADM-B11)', () => {
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'DELETED' }, action: 'lock' }),
    (e) => e.code === 'INVALID_USER_STATE' && e.status === 409
  );
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'BANNED' }, action: 'unlock' }),
    (e) => e.code === 'INVALID_USER_STATE' && e.status === 409
  );
});

test('TC-ADM-37\t[ADM-37] User không tồn tại -> 404 USER_NOT_FOUND; hành động sai -> 400 INVALID_ACTION (ADM-B37)', () => {
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: null, action: 'lock' }),
    (e) => e.code === 'USER_NOT_FOUND' && e.status === 404
  );
  assert.throws(
    () => decideStatusChange({ actorId: 'A1', target: cust, action: 'ban' }),
    (e) => e.code === 'INVALID_ACTION' && e.status === 400
  );
});

test('TC-ADM-01, TC-ADM-03, TC-ADM-07\t[ADM-01, ADM-03, ADM-07] sanitizeUser loại bỏ password_hash, OTP, token, secret (ADM-B01; ADM-B03; ADM-B07)', () => {
  const out = sanitizeUser({
    _id: 1, phone: '09', password_hash: 'x', passwordHash: 'x', otp_secret: 'x', reset_token: 'x', full_name: 'A', status: 'ACTIVE',
  });
  assert.deepEqual(Object.keys(out).sort(), ['_id', 'full_name', 'phone', 'status']);
});

test('TC-ADM-63\t[ADM-63] loyaltyOf trả hạng, KÉN Điểm (users.tier_points), KÉN Coins (users.coin_balance) (ADM-B63)', () => {
  assert.deepEqual(
    loyaltyOf({ tier: 'SILVER', tier_points: 1200, coin_balance: 300 }),
    { tier: 'SILVER', tierName: 'KÉN Bạc', points: 1200, coins: 300 }
  );
  assert.deepEqual(
    loyaltyOf({ tier_points: 0, coin_balance: 0 }),
    { tier: 'BASIC', tierName: 'KÉN Mới', points: 0, coins: 0 }
  );
  assert.deepEqual(
    loyaltyOf({ tier: 'GOLD', tier_points: 5200, coin_balance: 480 }),
    { tier: 'GOLD', tierName: 'KÉN Vàng', points: 5200, coins: 480 }
  );
  assert.deepEqual(
    loyaltyOf({ tier_points: 1000, coin_balance: 0 }),
    { tier: 'SILVER', tierName: 'KÉN Bạc', points: 1000, coins: 0 }
  ); // suy ra hạng từ điểm khi thiếu users.tier
  assert.deepEqual(loyaltyOf({ tier_points: 999 }), { tier: 'BASIC', tierName: 'KÉN Mới', points: 999, coins: 0 });
  assert.equal(loyaltyOf({ tier_points: 10000 }).tier, 'DIAMOND');
  assert.equal(loyaltyOf({}).tier, 'BASIC');
  assert.equal(loyaltyOf({ tier: 'VIP', tier_points: 6000 }).tier, 'GOLD'); // hạng lạ -> suy ra từ điểm
});

test('TC-ADM-03, TC-ADM-63\t[ADM-03, ADM-63] sanitizeUser không làm mất tier_points / coin_balance (ADM-B03; ADM-B63)', () => {
  const out = sanitizeUser({ _id: 1, tier_points: 1200, coin_balance: 300, password_hash: 'x' });
  assert.equal(out.tier_points, 1200);
  assert.equal(out.coin_balance, 300);
});

test('TC-ADM-26\t[ADM-26] tierFilter: khớp field tier hoặc (chưa có tier) theo khoảng điểm tier_points (ADM-B26)', () => {
  assert.deepEqual(tierFilter('silver'), {
    $or: [{ tier: 'SILVER' }, { tier: { $exists: false }, tier_points: { $gte: 1000, $lt: 5000 } }],
  });
  assert.deepEqual(tierFilter('DIAMOND').$or[1].tier_points, { $gte: 10000 });
  assert.deepEqual(tierFilter('vip'), { tier: 'VIP' });
});

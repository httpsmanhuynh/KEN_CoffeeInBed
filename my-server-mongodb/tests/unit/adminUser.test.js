'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideStatusChange, sanitizeUser, loyaltyOf, tierFilter } = require('../../src/domain/adminUser');

const admin = { _id: 'A1', role: 'ADMIN', status: 'ACTIVE' };
const cust = { _id: 'C1', role: 'CUSTOMER', status: 'ACTIVE' };

test('TC-ADM-01 khóa khách ACTIVE -> LOCKED', () => {
  assert.deepEqual(decideStatusChange({ actorId: 'A1', target: cust, action: 'lock' }), { from: 'ACTIVE', to: 'LOCKED' });
});

test('TC-ADM-02 mở khóa khách LOCKED -> ACTIVE', () => {
  assert.deepEqual(
    decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'LOCKED' }, action: 'unlock' }),
    { from: 'LOCKED', to: 'ACTIVE' }
  );
});

test('TC-ADM-03 không tự khóa mình / không khóa Admin khác', () => {
  assert.throws(() => decideStatusChange({ actorId: 'A1', target: admin, action: 'lock' }), (e) => e.code === 'CANNOT_LOCK_SELF' && e.status === 403);
  assert.throws(() => decideStatusChange({ actorId: 'A2', target: admin, action: 'lock' }), (e) => e.code === 'CANNOT_LOCK_ADMIN' && e.status === 403);
});

test('TC-ADM-04 khóa user đã khóa / mở user đang hoạt động -> 409', () => {
  assert.throws(() => decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'LOCKED' }, action: 'lock' }), (e) => e.code === 'USER_ALREADY_LOCKED' && e.status === 409);
  assert.throws(() => decideStatusChange({ actorId: 'A1', target: cust, action: 'unlock' }), (e) => e.code === 'USER_ALREADY_ACTIVE' && e.status === 409);
});

test('TC-ADM-05 user không tồn tại / hành động sai / trạng thái lạ', () => {
  assert.throws(() => decideStatusChange({ actorId: 'A1', target: null, action: 'lock' }), (e) => e.code === 'USER_NOT_FOUND' && e.status === 404);
  assert.throws(() => decideStatusChange({ actorId: 'A1', target: cust, action: 'ban' }), (e) => e.code === 'INVALID_ACTION');
  assert.throws(() => decideStatusChange({ actorId: 'A1', target: { ...cust, status: 'DELETED' }, action: 'lock' }), (e) => e.code === 'INVALID_USER_STATE');
});

test('TC-ADM-06 sanitizeUser loại password/hash/otp/token/secret', () => {
  const out = sanitizeUser({
    _id: 1, phone: '09', password_hash: 'x', passwordHash: 'x', otp_secret: 'x', reset_token: 'x', full_name: 'A', status: 'ACTIVE',
  });
  assert.deepEqual(Object.keys(out).sort(), ['_id', 'full_name', 'phone', 'status']);
});

test('TC-ADM-14 loyaltyOf trả hạng, KÉN Điểm, KÉN Coins (users.tier_points, users.coin_balance)', () => {
  assert.deepEqual(loyaltyOf({ tier: 'GOLD', tier_points: 5200, coin_balance: 480 }), { tier: 'GOLD', tierName: 'KÉN Vàng', points: 5200, coins: 480 });
  assert.deepEqual(loyaltyOf({ tier_points: 1000, coin_balance: 0 }), { tier: 'SILVER', tierName: 'KÉN Bạc', points: 1000, coins: 0 }); // suy ra hạng từ điểm
  assert.deepEqual(loyaltyOf({ tier_points: 999 }), { tier: 'BASIC', tierName: 'KÉN Mới', points: 999, coins: 0 });
  assert.equal(loyaltyOf({ tier_points: 10000 }).tier, 'DIAMOND');
  assert.equal(loyaltyOf({}).tier, 'BASIC');
  assert.equal(loyaltyOf({ tier: 'VIP', tier_points: 6000 }).tier, 'GOLD'); // hạng lạ -> suy ra từ điểm
});

test('TC-ADM-15 sanitizeUser không làm mất tier_points / coin_balance', () => {
  const out = sanitizeUser({ _id: 1, tier_points: 10, coin_balance: 5, password_hash: 'x' });
  assert.equal(out.tier_points, 10);
  assert.equal(out.coin_balance, 5);
});

test('TC-ADM-16 tierFilter: khớp field tier hoặc (chưa có tier) theo khoảng điểm', () => {
  assert.deepEqual(tierFilter('silver'), { $or: [{ tier: 'SILVER' }, { tier: { $exists: false }, tier_points: { $gte: 1000, $lt: 5000 } }] });
  assert.deepEqual(tierFilter('DIAMOND').$or[1].tier_points, { $gte: 10000 });
  assert.deepEqual(tierFilter('vip'), { tier: 'VIP' });
});

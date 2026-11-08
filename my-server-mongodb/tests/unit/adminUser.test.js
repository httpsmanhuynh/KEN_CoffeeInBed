'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideStatusChange, sanitizeUser } = require('../../src/domain/adminUser');

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

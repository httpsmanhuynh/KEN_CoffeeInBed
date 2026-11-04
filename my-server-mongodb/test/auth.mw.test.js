'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireRole, startSession, destroySession } = require('../src/middleware/auth');
const mkRes = () => {
  const r = { code: null, body: null,
    status(c) { r.code = c; return r; },
    json(b) { r.body = b; return r; } };
  return r;
};

test('TC-MW-01 requireAuth: đã đăng nhập → gọi next()', () => {
  const res = mkRes(); let called = false;
  requireAuth({ session: { user: { id: 'u1', role: 'CUSTOMER' } } }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.code, null);
});

test('TC-MW-02 requireAuth: chưa đăng nhập → 401 UNAUTHENTICATED', () => {
  const res = mkRes(); let called = false;
  requireAuth({ session: {} }, res, () => { called = true; });
  assert.equal(res.code, 401);
  assert.equal(res.body.code, 'UNAUTHENTICATED');
  assert.equal(called, false);
});

test('TC-MW-03 requireRole: thiếu session.user → 401 UNAUTHENTICATED', () => {
  const res = mkRes(); let called = false;
  requireRole('ADMIN')({ session: {} }, res, () => { called = true; });
  assert.equal(res.code, 401);
  assert.equal(res.body.code, 'UNAUTHENTICATED');
  assert.equal(called, false);
});

test('TC-MW-04 requireRole: sai vai trò → 403 FORBIDDEN', () => {
  const res = mkRes(); let called = false;
  requireRole('ADMIN')({ session: { user: { id: 'u1', role: 'CUSTOMER' } } }, res, () => { called = true; });
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'FORBIDDEN');
  assert.equal(called, false);
});

test('TC-MW-05 requireRole: đúng vai trò → gọi next()', () => {
  const res = mkRes(); let called = false;
  requireRole('ADMIN')({ session: { user: { id: 'u1', role: 'ADMIN' } } }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.code, null);
});
test('TC-MW-06 startSession: regenerate, giữ pendingBooking, gán user', async () => {
  const req = { session: {
    pendingBooking: { spaceId: 's1' }, pending2FA: { userId: 'u1' },
    regenerate(cb) { Object.keys(this).forEach((k) => typeof this[k] !== 'function' && delete this[k]); cb(null); },
    save(cb) { cb(null); },
  } };
  await startSession(req, { id: 'u1', role: 'CUSTOMER' });
  assert.equal(req.session.user.id, 'u1');
  assert.equal(req.session.user.role, 'CUSTOMER');
  assert.ok('pwdAt' in req.session.user);
  assert.deepEqual(req.session.pendingBooking, { spaceId: 's1' });
  assert.equal(req.session.pending2FA, undefined);
});

test('TC-MW-07 startSession: regenerate lỗi → reject', async () => {
  const req = { session: { regenerate(cb) { cb(new Error('regen error')); }, save(cb) { cb(null); } } };
  await assert.rejects(() => startSession(req, { id: 'u1', role: 'CUSTOMER' }), /regen error/);
});

test('TC-MW-08 destroySession: hủy phiên và xóa cookie connect.sid', async () => {
  let destroyed = false, cleared = null;
  const res = { clearCookie(n) { cleared = n; } };
  await destroySession({ session: { destroy(cb) { destroyed = true; cb(null); } } }, res);
  assert.equal(destroyed, true);
  assert.equal(cleared, 'connect.sid');
});

test('TC-MW-09 destroySession: destroy lỗi → reject', async () => {
  const res = { clearCookie() {} };
  await assert.rejects(
    () => destroySession({ session: { destroy(cb) { cb(new Error('destroy error')); } } }, res),
    /destroy error/,
  );
});
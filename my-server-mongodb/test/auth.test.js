'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireRole, startSession, destroySession } = require('../src/middleware/auth');

const mkRes = () => { const r = { code: null, cleared: null, status(c) { r.code = c; return r; }, json() { return r; }, clearCookie(n) { r.cleared = n; } }; return r; };

test('requireAuth/requireRole: 401 khi chưa đăng nhập, 403 sai vai trò', () => {
  let r = mkRes(); requireAuth({ session: {} }, r, () => assert.fail()); assert.equal(r.code, 401);
  r = mkRes(); requireRole('ADMIN')({ session: { user: { role: 'CUSTOMER' } } }, r, () => assert.fail()); assert.equal(r.code, 403);
  let ok = false; requireRole('ADMIN')({ session: { user: { role: 'ADMIN' } } }, mkRes(), () => { ok = true; }); assert.ok(ok);
});

test('startSession: regenerate nhưng giữ pendingBooking; không gán user trước khi gọi', async () => {
  const req = { session: { pendingBooking: { spaceId: 's1' }, pending2FA: { userId: 'u1' },
    regenerate(cb) { Object.keys(this).forEach((k) => typeof this[k] !== 'function' && delete this[k]); cb(null); },
    save(cb) { cb(null); } } };
  assert.equal(req.session.user, undefined);
  await startSession(req, { id: 'u1', role: 'CUSTOMER' });
  assert.deepEqual(req.session.user, { id: 'u1', role: 'CUSTOMER' });
  assert.deepEqual(req.session.pendingBooking, { spaceId: 's1' });
  assert.equal(req.session.pending2FA, undefined);
});

test('destroySession: hủy session và xóa cookie', async () => {
  const res = mkRes(); let destroyed = false;
  await destroySession({ session: { destroy(cb) { destroyed = true; cb(null); } } }, res);
  assert.ok(destroyed); assert.equal(res.cleared, 'connect.sid');
});

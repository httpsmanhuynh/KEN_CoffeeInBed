'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole, startSession, destroySession } = require('../src/middleware/auth');

const oid = new ObjectId();
const sess = () => ({ id: String(oid), role: 'CUSTOMER', pwdAt: 0 });

const mkRes = () => {
  const r = { code: null, body: null, cleared: null,
    status(c) { r.code = c; return r; },
    json(b) { r.body = b; return r; },
    clearCookie(n) { r.cleared = n; } };
  return r;
};
// req giả có DB: findOne trả về user cho trước (hoặc null)
const mkReq = (user, sessionUser) => ({
  session: sessionUser === undefined ? {} : { user: sessionUser, destroy: (cb) => cb() },
  app: { locals: { db: { collection: () => ({ findOne: async () => user }) } } },
});
const run = (mw, req) => new Promise((resolve) => {
  const r = mkRes();
  r.json = (b) => { r.body = b; resolve({ r, passed: false }); return r; };
  mw(req, r, () => resolve({ r, passed: true }));
});

test('TC-MW-01 requireAuth: đã đăng nhập → gọi next()', async () => {
  const req = mkReq({ _id: oid, status: 'ACTIVE', role: 'CUSTOMER' }, sess());
  const x = await run(requireAuth, req);
  assert.equal(x.passed, true);
  assert.equal(x.r.code, null);
});

test('TC-MW-02 requireAuth: chưa đăng nhập → 401 UNAUTHENTICATED', async () => {
  const x = await run(requireAuth, mkReq(null));
  assert.equal(x.r.code, 401);
  assert.equal(x.r.body.code, 'UNAUTHENTICATED');
  assert.equal(x.passed, false);
});

test('TC-MW-03 requireRole: thiếu session.user → 401 UNAUTHENTICATED', async () => {
  const x = await run(requireRole('ADMIN'), mkReq(null));
  assert.equal(x.r.code, 401);
  assert.equal(x.r.body.code, 'UNAUTHENTICATED');
  assert.equal(x.passed, false);
});

test('TC-MW-04 requireRole: sai vai trò → 403 FORBIDDEN', async () => {
  const x = await run(requireRole('ADMIN'),
    mkReq({ _id: oid, status: 'ACTIVE', role: 'CUSTOMER' }, { ...sess(), role: 'CUSTOMER' }));
  assert.equal(x.r.code, 403);
  assert.equal(x.r.body.code, 'FORBIDDEN');
  assert.equal(x.passed, false);
});

test('TC-MW-05 requireRole: đúng vai trò → gọi next()', async () => {
  const req = mkReq({ _id: oid, status: 'ACTIVE', role: 'ADMIN' }, { ...sess(), role: 'ADMIN' });
  const x = await run(requireRole('ADMIN'), req);
  assert.equal(x.passed, true);
  assert.equal(req.user.role, 'ADMIN');
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
  let destroyed = false; const res = mkRes();
  await destroySession({ session: { destroy(cb) { destroyed = true; cb(null); } } }, res);
  assert.equal(destroyed, true);
  assert.equal(res.cleared, 'connect.sid');
});

test('TC-MW-09 destroySession: destroy lỗi → reject', async () => {
  await assert.rejects(
    () => destroySession({ session: { destroy(cb) { cb(new Error('destroy error')); } } }, mkRes()),
    /destroy error/);
});
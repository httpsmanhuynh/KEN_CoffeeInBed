'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireRole, startSession, destroySession } = require('../src/middleware/auth');

const mkRes = () => { const r = { code: null, cleared: null, status(c) { r.code = c; return r; }, json() { return r; }, clearCookie(n) { r.cleared = n; } }; return r; };

const { ObjectId } = require('mongodb');
const oid = new ObjectId();
// req giả có DB: findOne trả về user cho trước (hoặc null)
const mkReq = (user, sessionUser) => ({
  session: sessionUser === undefined ? {} : { user: sessionUser, destroy: (cb) => cb() },
  app: { locals: { db: { collection: () => ({ findOne: async () => user }) } } },
});
const run = (mw, req) =>
  new Promise((resolve) => {
    const r = mkRes();
    r.json = () => { resolve({ r, passed: false }); return r; };
    mw(req, r, () => resolve({ r, passed: true }));
  });

test('requireAuth/requireRole: 401 khi chưa đăng nhập, 403 sai vai trò', async () => {
  let x = await run(requireAuth, mkReq(null)); assert.equal(x.r.code, 401); assert.equal(x.passed, false);
  const sess = { id: String(oid), role: 'ADMIN', pwdAt: 0 };
  x = await run(requireRole('ADMIN'), mkReq({ _id: oid, status: 'ACTIVE', role: 'CUSTOMER' }, sess));
  assert.equal(x.r.code, 403);
  const req = mkReq({ _id: oid, status: 'ACTIVE', role: 'ADMIN' }, sess);
  x = await run(requireRole('ADMIN'), req); assert.equal(x.passed, true); assert.equal(req.user.role, 'ADMIN');
});

test('requireAuth: thu hồi session khi user bị khóa / không còn / đã đổi mật khẩu (BR-A05)', async () => {
  const sess = () => ({ id: String(oid), role: 'CUSTOMER', pwdAt: 0 });
  const cases = [
    { status: 'LOCKED' },
    null,
    { status: 'ACTIVE', password_changed_at: new Date() },
  ];
  for (const u of cases) {
    const x = await run(requireAuth, mkReq(u && { _id: oid, ...u }, sess()));
    assert.equal(x.r.code, 401); assert.equal(x.r.cleared, 'connect.sid'); assert.equal(x.passed, false);
  }
  const ok = await run(requireAuth, mkReq({ _id: oid, status: 'ACTIVE' }, sess()));
  assert.equal(ok.passed, true);
});

test('startSession: regenerate nhưng giữ pendingBooking; không gán user trước khi gọi', async () => {
  const req = { session: { pendingBooking: { spaceId: 's1' }, pending2FA: { userId: 'u1' },
    regenerate(cb) { Object.keys(this).forEach((k) => typeof this[k] !== 'function' && delete this[k]); cb(null); },
    save(cb) { cb(null); } } };
  assert.equal(req.session.user, undefined);
  await startSession(req, { id: 'u1', role: 'CUSTOMER' });
  assert.deepEqual(req.session.user, { id: 'u1', role: 'CUSTOMER', pwdAt: 0 });
  assert.deepEqual(req.session.pendingBooking, { spaceId: 's1' });
  assert.equal(req.session.pending2FA, undefined);
});

test('destroySession: hủy session và xóa cookie', async () => {
  const res = mkRes(); let destroyed = false;
  await destroySession({ session: { destroy(cb) { destroyed = true; cb(null); } } }, res);
  assert.ok(destroyed); assert.equal(res.cleared, 'connect.sid');
});

'use strict';
// Kiểm thử middleware xác thực (BR-A01, BR-A04, BR-A05).
// requireAuth đọc lại user từ DB nên bất đồng bộ: test phải chờ next() hoặc res.json().
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  requireAuth,
  requireRole,
  startSession,
  destroySession,
} = require('../src/middleware/auth');

// ---------- Hàm trợ giúp ----------
const oid = new ObjectId();

const mkRes = () => {
  const r = {
    code: null,
    body: null,
    cleared: null,
    status(c) {
      r.code = c;
      return r;
    },
    json(b) {
      r.body = b;
      return r;
    },
    clearCookie(n) {
      r.cleared = n;
    },
  };
  return r;
};

// Request giả: session (undefined = chưa đăng nhập) và DB giả trả về `dbUser` (hoặc null).
const mkReq = (dbUser, sessionUser) => ({
  session: sessionUser === undefined ? {} : { user: sessionUser, destroy: (cb) => cb() },
  app: { locals: { db: { collection: () => ({ findOne: async () => dbUser }) } } },
});

// Chạy middleware, đợi đến khi nó gọi next() (passed = true) hoặc trả response (passed = false).
const run = (mw, req) =>
  new Promise((resolve) => {
    const r = mkRes();
    const json = r.json;
    r.json = (b) => {
      json(b);
      resolve({ r, req, passed: false });
      return r;
    };
    mw(req, r, () => resolve({ r, req, passed: true }));
  });

const sess = (role, pwdAt = 0) => ({ id: String(oid), role, pwdAt });
const dbUser = (role, extra = {}) => ({ _id: oid, status: 'ACTIVE', role, ...extra });

// ---------- requireAuth / requireRole ----------
test('TC-MW-01 requireAuth: đã đăng nhập → gọi next() và gán req.user', async () => {
  const x = await run(requireAuth, mkReq(dbUser('CUSTOMER'), sess('CUSTOMER')));
  assert.equal(x.passed, true);
  assert.equal(x.r.code, null);
  assert.equal(x.req.user.role, 'CUSTOMER');
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
  const x = await run(requireRole('ADMIN'), mkReq(dbUser('CUSTOMER'), sess('CUSTOMER')));
  assert.equal(x.r.code, 403);
  assert.equal(x.r.body.code, 'FORBIDDEN');
  assert.equal(x.passed, false);
});

test('TC-MW-05 requireRole: đúng vai trò → gọi next()', async () => {
  const x = await run(requireRole('ADMIN'), mkReq(dbUser('ADMIN'), sess('ADMIN')));
  assert.equal(x.passed, true);
  assert.equal(x.r.code, null);
});

test('TC-MW-10 requireRole: lấy vai trò từ DB, không tin vai trò trong session', async () => {
  // session ghi ADMIN nhưng DB đã hạ xuống CUSTOMER → phải bị từ chối
  const x = await run(requireRole('ADMIN'), mkReq(dbUser('CUSTOMER'), sess('ADMIN')));
  assert.equal(x.r.code, 403);
  assert.equal(x.passed, false);
});

// ---------- Thu hồi session (BR-A05) ----------
test('TC-MW-11 requireAuth: user bị khóa → 401, hủy session, xóa cookie', async () => {
  const x = await run(
    requireAuth,
    mkReq(dbUser('CUSTOMER', { status: 'LOCKED' }), sess('CUSTOMER')),
  );
  assert.equal(x.r.code, 401);
  assert.equal(x.r.cleared, 'connect.sid');
  assert.equal(x.passed, false);
});

test('TC-MW-12 requireAuth: user không còn trong DB → 401, xóa cookie', async () => {
  const x = await run(requireAuth, mkReq(null, sess('CUSTOMER')));
  assert.equal(x.r.code, 401);
  assert.equal(x.r.cleared, 'connect.sid');
  assert.equal(x.passed, false);
});

test('TC-MW-13 requireAuth: đã đổi mật khẩu sau khi tạo session → 401, xóa cookie', async () => {
  const x = await run(
    requireAuth,
    mkReq(dbUser('CUSTOMER', { password_changed_at: new Date() }), sess('CUSTOMER', 0)),
  );
  assert.equal(x.r.code, 401);
  assert.equal(x.r.cleared, 'connect.sid');
  assert.equal(x.passed, false);
});

test('TC-MW-14 requireAuth: mốc đổi mật khẩu trùng với session → vẫn hợp lệ', async () => {
  const changedAt = new Date();
  const x = await run(
    requireAuth,
    mkReq(
      dbUser('CUSTOMER', { password_changed_at: changedAt }),
      sess('CUSTOMER', changedAt.getTime()),
    ),
  );
  assert.equal(x.passed, true);
});

// ---------- startSession / destroySession ----------
test('TC-MW-06 startSession: regenerate, giữ pendingBooking, gán user', async () => {
  const req = {
    session: {
      pendingBooking: { spaceId: 's1' },
      pending2FA: { userId: 'u1' },
      regenerate(cb) {
        Object.keys(this).forEach((k) => typeof this[k] !== 'function' && delete this[k]);
        cb(null);
      },
      save(cb) {
        cb(null);
      },
    },
  };
  assert.equal(req.session.user, undefined); // chưa gán user trước khi gọi
  await startSession(req, { id: 'u1', role: 'CUSTOMER' });
  assert.deepEqual(req.session.user, { id: 'u1', role: 'CUSTOMER', pwdAt: 0 });
  assert.deepEqual(req.session.pendingBooking, { spaceId: 's1' });
  assert.equal(req.session.pending2FA, undefined); // bước 2FA dở dang bị xóa
});

test('TC-MW-07 startSession: regenerate lỗi → reject', async () => {
  const req = {
    session: {
      regenerate(cb) {
        cb(new Error('regen error'));
      },
      save(cb) {
        cb(null);
      },
    },
  };
  await assert.rejects(() => startSession(req, { id: 'u1', role: 'CUSTOMER' }), /regen error/);
});

test('TC-MW-08 destroySession: hủy phiên và xóa cookie connect.sid', async () => {
  const res = mkRes();
  let destroyed = false;
  await destroySession(
    {
      session: {
        destroy(cb) {
          destroyed = true;
          cb(null);
        },
      },
    },
    res,
  );
  assert.equal(destroyed, true);
  assert.equal(res.cleared, 'connect.sid');
});

test('TC-MW-09 destroySession: destroy lỗi → reject', async () => {
  const res = mkRes();
  await assert.rejects(
    () =>
      destroySession(
        {
          session: {
            destroy(cb) {
              cb(new Error('destroy error'));
            },
          },
        },
        res,
      ),
    /destroy error/,
  );
});

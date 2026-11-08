'use strict';
/**
 * Kiểm thử tích hợp Module 11 (service + route) với DB giả lập tối thiểu.
 * Pipeline aggregate của Dashboard chỉ chạy được trên MongoDB thật — xem docs/workflow/admin-dashboard.md mục "Chạy thử".
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const { ObjectId } = require('mongodb');

/* ---------- DB giả lập: findOne / updateOne với so sánh bằng và $ne ---------- */
function matches(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && '$ne' in cond) return String(v) !== String(cond.$ne);
    return String(v) === String(cond);
  });
}
function fakeDb(seed) {
  const cols = { users: [...seed] };
  return {
    collection(name) {
      const rows = cols[name] || (cols[name] = []);
      return {
        async findOne(filter) { return rows.find((d) => matches(d, filter)) || null; },
        async updateOne(filter, update) {
          const d = rows.find((x) => matches(x, filter));
          if (!d) return { matchedCount: 0, modifiedCount: 0 };
          Object.assign(d, update.$set);
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
    _users: cols.users,
  };
}

const ids = { admin: new ObjectId(), cust: new ObjectId(), admin2: new ObjectId() };
const seed = () => ([
  { _id: ids.admin, role: 'ADMIN', status: 'ACTIVE', phone: '0900000001', password_hash: 'secret' },
  { _id: ids.admin2, role: 'ADMIN', status: 'ACTIVE', phone: '0900000002' },
  { _id: ids.cust, role: 'CUSTOMER', status: 'ACTIVE', phone: '0900000003', password_hash: 'secret' },
]);

const svc = require('../../src/services/adminService');

test('TC-ADM-07 lock rồi unlock: status đổi, không lộ password_hash', async () => {
  const db = fakeDb(seed());
  const locked = await svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'lock' });
  assert.equal(locked.status, 'LOCKED');
  assert.equal('password_hash' in locked, false);
  assert.equal(db._users.find((u) => u._id.equals(ids.cust)).status, 'LOCKED');

  const unlocked = await svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'unlock' });
  assert.equal(unlocked.status, 'ACTIVE');
});

test('TC-ADM-08 id sai định dạng -> 400; không tồn tại -> 404', async () => {
  const db = fakeDb(seed());
  await assert.rejects(svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: 'abc', action: 'lock' }), (e) => e.code === 'INVALID_ID' && e.status === 400);
  await assert.rejects(svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(new ObjectId()), action: 'lock' }), (e) => e.code === 'USER_NOT_FOUND');
});

test('TC-ADM-09 không tự khóa / không khóa Admin khác (DB không đổi)', async () => {
  const db = fakeDb(seed());
  await assert.rejects(svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.admin), action: 'lock' }), (e) => e.code === 'CANNOT_LOCK_SELF');
  await assert.rejects(svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.admin2), action: 'lock' }), (e) => e.code === 'CANNOT_LOCK_ADMIN');
  assert.ok(db._users.every((u) => u.status === 'ACTIVE'));
});

test('TC-ADM-10 hai Admin khóa song song: một thắng, một nhận 409 (cập nhật nguyên tử theo trạng thái nguồn)', async () => {
  const db = fakeDb(seed());
  const results = await Promise.allSettled([
    svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'lock' }),
    svc.setUserStatus(db, { actor: { _id: ids.admin2 }, targetId: String(ids.cust), action: 'lock' }),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const bad = results.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(bad.length, 1);
  assert.ok(['USER_ALREADY_LOCKED', 'USER_STATE_CHANGED'].includes(bad[0].reason.code));
});

/* ---------- Route: phân quyền + ánh xạ lỗi (stub middleware/auth) ---------- */
function loadRouterWithAuth(currentUser) {
  const origLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === '../middleware/auth') {
      return {
        requireRole: (role) => (req, res, next) => {
          if (!currentUser) return res.status(401).json({ error: 'UNAUTHENTICATED' });
          if (currentUser.role !== role) return res.status(403).json({ error: 'FORBIDDEN' });
          req.user = currentUser;
          next();
        },
      };
    }
    return origLoad.call(this, request, ...rest);
  };
  try {
    delete require.cache[require.resolve('../../src/routes/admin')];
    return require('../../src/routes/admin');
  } finally {
    Module._load = origLoad;
  }
}

async function call(router, db, method, path) {
  const express = require('express');
  const app = express();
  app.locals.db = db;
  app.use('/api/admin', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/admin${path}`, { method });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test('TC-ADM-11 route: chưa đăng nhập 401, khách thường 403', async () => {
  const db = fakeDb(seed());
  assert.equal((await call(loadRouterWithAuth(null), db, 'POST', `/users/${ids.cust}/lock`)).status, 401);
  assert.equal((await call(loadRouterWithAuth({ _id: ids.cust, role: 'CUSTOMER' }), db, 'POST', `/users/${ids.cust}/lock`)).status, 403);
  assert.equal((await call(loadRouterWithAuth({ _id: ids.cust, role: 'CUSTOMER' }), db, 'GET', '/dashboard')).status, 403);
});

test('TC-ADM-12 route: Admin khóa/mở khóa thành công; lỗi nghiệp vụ -> { error, message }', async () => {
  const db = fakeDb(seed());
  const router = loadRouterWithAuth({ _id: ids.admin, role: 'ADMIN' });

  const lock = await call(router, db, 'POST', `/users/${ids.cust}/lock`);
  assert.equal(lock.status, 200);
  assert.equal(lock.body.user.status, 'LOCKED');

  const again = await call(router, db, 'POST', `/users/${ids.cust}/lock`);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'USER_ALREADY_LOCKED');

  const self = await call(router, db, 'POST', `/users/${ids.admin}/lock`);
  assert.equal(self.status, 403);
  assert.equal(self.body.error, 'CANNOT_LOCK_SELF');

  const unlock = await call(router, db, 'POST', `/users/${ids.cust}/unlock`);
  assert.equal(unlock.status, 200);
  assert.equal(unlock.body.user.status, 'ACTIVE');
});

test('TC-ADM-13 route: dashboard tham số sai -> 422 trước khi chạm DB', async () => {
  const db = fakeDb(seed());
  const router = loadRouterWithAuth({ _id: ids.admin, role: 'ADMIN' });
  const bad = await call(router, db, 'GET', '/dashboard?from=2026-13-01');
  assert.equal(bad.status, 422);
  assert.equal(bad.body.error, 'INVALID_DATE');
  const range = await call(router, db, 'GET', '/dashboard?from=2026-11-05&to=2026-11-01');
  assert.equal(range.body.error, 'INVALID_RANGE');
});

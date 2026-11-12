'use strict';
/**
 * Kiểm thử tích hợp Module 11 — Admin Management & Dashboard (service + route + auth + rateLimit).
 * Mã TC đồng bộ 100% với sheet Test_Module11_Admin_Dashboard (TC-ADM-01..64) và Postman Collection Module 11.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole } = require('../../src/middleware/auth');
const { rateLimit } = require('../../src/middleware/rateLimit');
const svc = require('../../src/services/adminService');

/* ---------- DB giả lập hỗ trợ findOne, updateOne, find, countDocuments và aggregate ---------- */
function matches(doc, filter = {}) {
  for (const [k, cond] of Object.entries(filter)) {
    if (k === '$or') {
      if (!cond.some((sub) => matches(doc, sub))) return false;
      continue;
    }
    if (k === '$and') {
      if (!cond.every((sub) => matches(doc, sub))) return false;
      continue;
    }
    const v = doc[k];
    if (cond instanceof RegExp) {
      if (!cond.test(String(v == null ? '' : v))) return false;
      continue;
    }
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
      if ('$ne' in cond && String(v) === String(cond.$ne)) return false;
      if ('$in' in cond && !cond.$in.some((x) => String(x) === String(v))) return false;
      if ('$exists' in cond && (cond.$exists ? !(k in doc) : k in doc)) return false;
      if ('$gte' in cond && !(v >= cond.$gte)) return false;
      if ('$lt' in cond && !(v < cond.$lt)) return false;
      continue;
    }
    if (String(v) !== String(cond)) return false;
  }
  return true;
}

function fakeDb(seedUsers = [], extraCols = {}) {
  const cols = {
    users: seedUsers.map((u) => ({ ...u })),
    bookings: (extraCols.bookings || []).map((b) => ({ ...b })),
    spaces: (extraCols.spaces || []).map((s) => ({ ...s })),
    zones: (extraCols.zones || []).map((z) => ({ ...z })),
    addons: (extraCols.addons || []).map((a) => ({ ...a })),
    booking_addons: (extraCols.booking_addons || []).map((ba) => ({ ...ba })),
    payment_transactions: (extraCols.payment_transactions || []).map((tx) => ({ ...tx })),
  };

  return {
    collection(name) {
      const rows = cols[name] || (cols[name] = []);
      return {
        async findOne(filter) {
          return rows.find((d) => matches(d, filter)) || null;
        },
        async updateOne(filter, update) {
          const d = rows.find((x) => matches(x, filter));
          if (!d) return { matchedCount: 0, modifiedCount: 0 };
          if (update && update.$set) Object.assign(d, update.$set);
          return { matchedCount: 1, modifiedCount: 1 };
        },
        async countDocuments(filter = {}) {
          return rows.filter((d) => matches(d, filter)).length;
        },
        find(filter = {}) {
          let list = rows.filter((d) => matches(d, filter)).map((d) => ({ ...d }));
          const cursor = {
            sort(spec = {}) {
              const entries = Object.entries(spec);
              list.sort((a, b) => {
                for (const [f, dir] of entries) {
                  const av = a[f] instanceof Date ? a[f].getTime() : String(a[f] ?? '');
                  const bv = b[f] instanceof Date ? b[f].getTime() : String(b[f] ?? '');
                  if (av < bv) return dir < 0 ? 1 : -1;
                  if (av > bv) return dir < 0 ? -1 : 1;
                }
                return 0;
              });
              return cursor;
            },
            skip(n) {
              list = list.slice(n);
              return cursor;
            },
            limit(n) {
              list = list.slice(0, n);
              return cursor;
            },
            async toArray() {
              return list;
            },
          };
          return cursor;
        },
        aggregate(pipeline = []) {
          return {
            async toArray() {
              return runAggregate(cols, name, pipeline);
            },
          };
        },
      };
    },
    _users: cols.users,
    _cols: cols,
  };
}

function runAggregate(cols, name, pipeline) {
  const rows = cols[name] || [];
  const firstMatch = pipeline[0] && pipeline[0].$match ? pipeline[0].$match : {};

  // 1) payment_transactions -> revenueTransactions(db, range)
  if (name === 'payment_transactions') {
    const matched = rows.filter((tx) => matches(tx, firstMatch));
    return matched.map((tx) => {
      const at = tx.processed_at || tx.paid_at || tx.created_at;
      const b = (cols.bookings || []).find((bk) => String(bk._id) === String(tx.booking_id)) || {};
      return {
        type: tx.type,
        amount: tx.amount,
        at,
        spaceId: b.space_id || null,
        final: b.final_amount ?? 0,
        inclusion: b.inclusion_surcharge ?? b.inclusion_surcharge_total ?? 0,
        addon: b.addon_total ?? b.addons_total ?? 0,
        voucherDiscount: b.voucher_discount ?? 0,
        tierDiscount: b.tier_discount ?? 0,
      };
    });
  }

  // 2) bookings -> addonPipeline ($lookup booking_addons)
  if (name === 'bookings' && pipeline.some((st) => st.$lookup && st.$lookup.from === 'booking_addons')) {
    const matchedBookings = rows.filter((b) => matches(b, firstMatch));
    const bIds = new Set(matchedBookings.map((b) => String(b._id)));
    return (cols.booking_addons || []).filter((ba) => bIds.has(String(ba.booking_id)));
  }

  // 3) bookings -> $group theo user_id (listUsers)
  const groupStage = pipeline.find((st) => st.$group);
  if (name === 'bookings' && groupStage && groupStage.$group._id === '$user_id') {
    const matched = rows.filter((b) => matches(b, firstMatch));
    const map = new Map();
    for (const b of matched) {
      const k = String(b.user_id);
      const cur = map.get(k) || { _id: b.user_id, bookingCount: 0, lastBookingAt: null };
      cur.bookingCount += 1;
      if (!cur.lastBookingAt || new Date(b.created_at) > new Date(cur.lastBookingAt)) {
        cur.lastBookingAt = b.created_at;
      }
      map.set(k, cur);
    }
    return [...map.values()];
  }

  // 4) bookings -> $group theo status (getUserProfile)
  if (name === 'bookings' && groupStage && groupStage.$group._id === '$status') {
    const matched = rows.filter((b) => matches(b, firstMatch));
    const map = new Map();
    for (const b of matched) {
      const cur = map.get(b.status) || { _id: b.status, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(b.final_amount) || 0;
      map.set(b.status, cur);
    }
    return [...map.values()];
  }

  // 5) bookings -> $group theo { space, status } (getDashboard)
  if (name === 'bookings' && groupStage && typeof groupStage.$group._id === 'object') {
    const matched = rows.filter((b) => matches(b, firstMatch));
    const rangeTo = firstMatch.start_at && firstMatch.start_at.$lt ? firstMatch.start_at.$lt : null;
    const paidStatuses = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'];
    const map = new Map();
    for (const b of matched) {
      const key = `${b.space_id}:${b.status}`;
      const cur = map.get(key) || { _id: { space: b.space_id, status: b.status }, count: 0, hours: 0, guestHours: 0 };
      cur.count += 1;
      if (paidStatuses.includes(b.status) && b.start_at && b.end_at) {
        const endMs = rangeTo ? Math.min(new Date(b.end_at).getTime(), new Date(rangeTo).getTime()) : new Date(b.end_at).getTime();
        const hrs = Math.max(0, (endMs - new Date(b.start_at).getTime()) / 3600000);
        cur.hours += hrs;
        cur.guestHours += hrs * (Number(b.guest_count) || 0);
      }
      map.set(key, cur);
    }
    return [...map.values()];
  }

  return [];
}

const ids = {
  admin: new ObjectId(),
  admin2: new ObjectId(),
  cust: new ObjectId(),
  custLocked: new ObjectId(),
  custWeird: new ObjectId(),
  zoneA: new ObjectId(),
  zoneB: new ObjectId(),
  spaceA: new ObjectId(),
  spaceB: new ObjectId(),
  booking1: new ObjectId(),
  booking2: new ObjectId(),
};

const seed = () => ([
  { _id: ids.admin, role: 'ADMIN', status: 'ACTIVE', phone: '0900000001', full_name: 'Admin Chính', password_hash: 'secret' },
  { _id: ids.admin2, role: 'ADMIN', status: 'ACTIVE', phone: '0900000002', full_name: 'Admin Phụ', password_hash: 'secret' },
  {
    _id: ids.cust,
    role: 'CUSTOMER',
    status: 'ACTIVE',
    phone: '0909123456',
    email: 'khach@ken.vn',
    full_name: 'Nguyễn Văn A',
    tier: 'SILVER',
    tier_points: 1200,
    coin_balance: 300,
    password_hash: 'secret',
    otp_secret: 'otp',
    created_at: new Date('2026-10-01T00:00:00Z'),
  },
  {
    _id: ids.custLocked,
    role: 'CUSTOMER',
    status: 'LOCKED',
    phone: '0908888888',
    full_name: 'Trần Thị B',
    tier_points: 0,
    coin_balance: 0,
    password_hash: 'secret',
    created_at: new Date('2026-09-01T00:00:00Z'),
  },
]);

/* ---------- Helper load router với stub hoặc middleware thật ---------- */
function loadRouterWithStub(currentUser, customAdminLimit = null) {
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
    if (request === '../middleware/rateLimit' && customAdminLimit) {
      return { adminLimit: customAdminLimit };
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

function loadRouterWithRealAuth(customAdminLimit = null) {
  const origLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === '../middleware/rateLimit' && customAdminLimit) {
      return { adminLimit: customAdminLimit };
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

async function call(router, db, method, path, options = {}) {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.locals.db = db;
  if (options.sessionState) {
    app.use((req, _res, next) => {
      req.session = options.sessionState;
      next();
    });
  }
  app.use('/api/admin', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  try {
    const { port } = server.address();
    const fetchOpts = { method, headers: {} };
    if (options.body !== undefined) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(options.body);
    }
    const res = await fetch(`http://127.0.0.1:${port}/api/admin${path}`, fetchOpts);
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch (_) { body = text; }
    return { status: res.status, body };
  } finally {
    server.close();
  }
}

/* =====================================================================
 * 1. Khóa / Mở khóa tài khoản & Đồng thời (TC-ADM-07, 10, 11, 12, 34..40)
 * ===================================================================== */

test('TC-ADM-07, TC-ADM-10, TC-ADM-40\t[ADM-07, ADM-10, ADM-40] Khóa ACTIVE -> LOCKED rồi mở khóa LOCKED -> ACTIVE: chỉ đổi status, không lộ password_hash, giữ nguyên Booking của khách (ADM-B07; ADM-B10; ADM-B40)', async () => {
  const db = fakeDb(seed(), {
    bookings: [{ _id: ids.booking1, user_id: ids.cust, space_id: ids.spaceA, status: 'CONFIRMED', final_amount: 600000 }],
  });
  const locked = await svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'lock' });
  assert.equal(locked.status, 'LOCKED');
  assert.equal('password_hash' in locked, false);
  assert.equal('otp_secret' in locked, false);
  const userInDb = db._users.find((u) => u._id.equals(ids.cust));
  assert.equal(userInDb.status, 'LOCKED');
  assert.equal('locked_at' in userInDb, false);
  assert.equal('reason' in userInDb, false);
  // Đơn CONFIRMED của khách vẫn giữ nguyên
  assert.equal(db._cols.bookings[0].status, 'CONFIRMED');

  const unlocked = await svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'unlock' });
  assert.equal(unlocked.status, 'ACTIVE');
  assert.equal(db._users.find((u) => u._id.equals(ids.cust)).status, 'ACTIVE');
});

test('TC-ADM-11\t[ADM-11] Khóa user có trạng thái ngoài ACTIVE/LOCKED (dữ liệu lạ, vd. DELETED) -> 409 INVALID_USER_STATE; DB không đổi (ADM-B11)', async () => {
  const db = fakeDb([
    ...seed(),
    { _id: ids.custWeird, role: 'CUSTOMER', status: 'DELETED', phone: '0907777777' },
  ]);
  const router = loadRouterWithStub({ _id: ids.admin, role: 'ADMIN' });
  const res = await call(router, db, 'POST', `/users/${ids.custWeird}/lock`);
  assert.equal(res.status, 409);
  assert.equal(res.body.error, 'INVALID_USER_STATE');
  assert.equal(db._users.find((u) => u._id.equals(ids.custWeird)).status, 'DELETED');
});

test('TC-ADM-12, TC-ADM-36\t[ADM-12, ADM-36] Admin tự khóa chính mình (403 CANNOT_LOCK_SELF) / khóa Admin khác (403 CANNOT_LOCK_ADMIN); DB không đổi (ADM-B12; ADM-B36)', async () => {
  const db = fakeDb(seed());
  await assert.rejects(
    svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.admin), action: 'lock' }),
    (e) => e.code === 'CANNOT_LOCK_SELF' && e.status === 403
  );
  await assert.rejects(
    svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.admin2), action: 'lock' }),
    (e) => e.code === 'CANNOT_LOCK_ADMIN' && e.status === 403
  );
  assert.equal(db._users.find((u) => u._id.equals(ids.admin)).status, 'ACTIVE');
  assert.equal(db._users.find((u) => u._id.equals(ids.admin2)).status, 'ACTIVE');
});

test('TC-ADM-06, TC-ADM-34, TC-ADM-37\t[ADM-06, ADM-34, ADM-37] id sai định dạng -> 400 INVALID_ID; user không tồn tại -> 404 USER_NOT_FOUND ở cả profile, bookings, lock/unlock (ADM-B06; ADM-B34; ADM-B37)', async () => {
  const db = fakeDb(seed());
  const router = loadRouterWithStub({ _id: ids.admin, role: 'ADMIN' });
  const ghostId = '000000000000000000000000';

  // TC-ADM-34: id sai định dạng ObjectId
  for (const badId of ['abc123', '123', 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
    assert.equal((await call(router, db, 'GET', `/users/${badId}`)).status, 400);
    assert.equal((await call(router, db, 'GET', `/users/${badId}/bookings`)).status, 400);
    const lockBad = await call(router, db, 'POST', `/users/${badId}/lock`);
    assert.equal(lockBad.status, 400);
    assert.equal(lockBad.body.error, 'INVALID_ID');
  }

  // TC-ADM-06 & TC-ADM-37: id đúng định dạng nhưng user không tồn tại -> 404 USER_NOT_FOUND
  for (const [m, p] of [
    ['GET', `/users/${ghostId}`],
    ['GET', `/users/${ghostId}/bookings`],
    ['POST', `/users/${ghostId}/lock`],
    ['POST', `/users/${ghostId}/unlock`],
  ]) {
    const res = await call(router, db, m, p);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'USER_NOT_FOUND');
  }
});

test('TC-ADM-35, TC-ADM-38\t[ADM-35, ADM-38] Khóa user đã LOCKED / mở user đã ACTIVE -> 409; body tùy ý bị bỏ qua và không có route PATCH /status (ADM-B35; ADM-B38)', async () => {
  const db = fakeDb(seed());
  const router = loadRouterWithStub({ _id: ids.admin, role: 'ADMIN' });

  // TC-ADM-38: gửi kèm body { status: 'DELETED', role: 'ADMIN' } -> bị bỏ qua, chỉ ACTIVE -> LOCKED
  const lock = await call(router, db, 'POST', `/users/${ids.cust}/lock`, {
    body: { status: 'DELETED', role: 'ADMIN' },
  });
  assert.equal(lock.status, 200);
  assert.equal(lock.body.user.status, 'LOCKED');
  assert.equal(lock.body.user.role, 'CUSTOMER');

  // TC-ADM-38: PATCH /api/admin/users/:id/status không tồn tại -> 404
  const patchRes = await call(router, db, 'PATCH', `/users/${ids.cust}/status`, {
    body: { status: 'ACTIVE' },
  });
  assert.equal(patchRes.status, 404);

  // TC-ADM-35: khóa lại user đã LOCKED -> 409 USER_ALREADY_LOCKED
  const again = await call(router, db, 'POST', `/users/${ids.cust}/lock`);
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'USER_ALREADY_LOCKED');

  // Mở khóa LOCKED -> ACTIVE
  const unlock = await call(router, db, 'POST', `/users/${ids.cust}/unlock`);
  assert.equal(unlock.status, 200);
  assert.equal(unlock.body.user.status, 'ACTIVE');

  // TC-ADM-35: mở khóa lại user đã ACTIVE -> 409 USER_ALREADY_ACTIVE
  const unlockAgain = await call(router, db, 'POST', `/users/${ids.cust}/unlock`);
  assert.equal(unlockAgain.status, 409);
  assert.equal(unlockAgain.body.error, 'USER_ALREADY_ACTIVE');
});

test('TC-ADM-39\t[ADM-39] Hai Admin khóa cùng một khách song song: một thắng (200), một nhận 409 (USER_ALREADY_LOCKED hoặc USER_STATE_CHANGED), status cuối = LOCKED (ADM-B39)', async () => {
  const db = fakeDb(seed());
  const results = await Promise.allSettled([
    svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'lock' }),
    svc.setUserStatus(db, { actor: { _id: ids.admin2 }, targetId: String(ids.cust), action: 'lock' }),
  ]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const bad = results.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].reason.status, 409);
  assert.ok(['USER_ALREADY_LOCKED', 'USER_STATE_CHANGED'].includes(bad[0].reason.code));
  assert.equal(db._users.find((u) => u._id.equals(ids.cust)).status, 'LOCKED');

  // Kiểm chứng nhánh cạnh tranh giữa findOne và updateOne (matchedCount = 0 -> 409 USER_STATE_CHANGED)
  const raceDb = {
    collection() {
      return {
        async findOne() { return { _id: ids.cust, role: 'CUSTOMER', status: 'ACTIVE' }; },
        async updateOne() { return { matchedCount: 0, modifiedCount: 0 }; },
      };
    },
  };
  await assert.rejects(
    svc.setUserStatus(raceDb, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'lock' }),
    (e) => e.code === 'USER_STATE_CHANGED' && e.status === 409
  );
});

/* =====================================================================
 * 2. Phân quyền Admin, Hạ quyền, Khóa Admin trong DB & Rate Limit
 *    (TC-ADM-09, TC-ADM-24, TC-ADM-25, TC-ADM-55, TC-ADM-56, TC-ADM-57, TC-ADM-58)
 * ===================================================================== */

test('TC-ADM-24, TC-ADM-55\t[ADM-24, ADM-55] Customer / Guest truy cập API đọc & ghi của Admin: Guest -> 401, Customer -> 403; dữ liệu không đổi (ADM-B24; ADM-B55)', async () => {
  const db = fakeDb(seed());
  const guestRouter = loadRouterWithStub(null);
  const custRouter = loadRouterWithStub({ _id: ids.cust, role: 'CUSTOMER' });

  for (const [m, p] of [
    ['GET', '/users'],
    ['GET', `/users/${ids.cust}`],
    ['GET', `/users/${ids.cust}/bookings`],
    ['GET', '/dashboard'],
    ['POST', `/users/${ids.cust}/lock`],
    ['POST', `/users/${ids.custLocked}/unlock`],
  ]) {
    assert.equal((await call(guestRouter, db, m, p)).status, 401);
    assert.equal((await call(custRouter, db, m, p)).status, 403);
  }
  assert.equal(db._users.find((u) => u._id.equals(ids.cust)).status, 'ACTIVE');
  assert.equal(db._users.find((u) => u._id.equals(ids.custLocked)).status, 'LOCKED');
});

test('TC-ADM-25\t[ADM-25] Admin bị hạ quyền (đổi role sang CUSTOMER trong DB) thì mất quyền ngay ở request kế tiếp -> 403 FORBIDDEN (requireRole đọc lại DB) (ADM-B25)', async () => {
  const db = fakeDb(seed());
  const router = loadRouterWithRealAuth();
  const sessionState = {
    user: { id: String(ids.admin), role: 'ADMIN', pwdAt: 0 },
    destroy: (cb) => cb && cb(),
  };

  // Bước 1: Admin đang ACTIVE, role ADMIN -> gọi GET /api/admin/dashboard trả 200
  const okRes = await call(router, db, 'GET', '/dashboard', { sessionState });
  assert.equal(okRes.status, 200);

  // Bước 2: Đổi role của Admin sang CUSTOMER trong DB (session vẫn giữ role: 'ADMIN')
  await db.collection('users').updateOne({ _id: ids.admin }, { $set: { role: 'CUSTOMER' } });

  // Bước 3: Gọi lại API Admin bằng session cũ -> requireRole đọc lại DB và chặn 403 ngay
  const demotedRes = await call(router, db, 'GET', '/dashboard', { sessionState });
  assert.equal(demotedRes.status, 403);
  assert.equal(demotedRes.body.code, 'FORBIDDEN');
});

test('TC-ADM-56\t[ADM-56] Admin bị khóa trong DB (status = LOCKED) thì mất quyền ngay ở request kế tiếp -> 401 UNAUTHENTICATED, thu hồi session (BR-A05) (ADM-B56)', async () => {
  const db = fakeDb(seed());
  const router = loadRouterWithRealAuth();
  let destroyed = false;
  const sessionState = {
    user: { id: String(ids.admin2), role: 'ADMIN', pwdAt: 0 },
    destroy: (cb) => {
      destroyed = true;
      delete sessionState.user;
      if (cb) cb();
    },
  };

  // Bước 1: Admin phụ gọi GET /api/admin/dashboard -> 200
  const first = await call(router, db, 'GET', '/dashboard', { sessionState });
  assert.equal(first.status, 200);

  // Bước 2: Đặt status = LOCKED cho Admin phụ trong DB
  await db.collection('users').updateOne({ _id: ids.admin2 }, { $set: { status: 'LOCKED' } });

  // Bước 3: Gọi lại bằng session cũ -> 401 và hủy session
  const second = await call(router, db, 'GET', '/dashboard', { sessionState });
  assert.equal(second.status, 401);
  assert.equal(second.body.code, 'UNAUTHENTICATED');
  assert.equal(destroyed, true);
});

test('TC-ADM-09, TC-ADM-58\t[ADM-09, ADM-58] Tài khoản Customer bị Admin khóa: session đang đăng nhập bị thu hồi ở request kế tiếp (GET /api/me & POST /api/bookings trả 401, BR-A05) (ADM-B09; ADM-B58)', async () => {
  const db = fakeDb(seed());
  // Admin khóa Customer
  const locked = await svc.setUserStatus(db, { actor: { _id: ids.admin }, targetId: String(ids.cust), action: 'lock' });
  assert.equal(locked.status, 'LOCKED');

  // Customer dùng session cũ gọi route bảo vệ bởi requireAuth (GET /api/me, POST /api/bookings)
  let sessionDestroyed = false;
  let clearedCookie = null;
  const req = {
    session: {
      user: { id: String(ids.cust), role: 'CUSTOMER', pwdAt: 0 },
      destroy: (cb) => { sessionDestroyed = true; cb(); },
    },
    app: { locals: { db } },
  };
  let statusCode = null;
  let resBody = null;
  const res = {
    status(c) { statusCode = c; return res; },
    json(b) { resBody = b; return res; },
    clearCookie(name) { clearedCookie = name; },
  };
  let nextCalled = false;
  await new Promise((resolve) => {
    const origJson = res.json;
    res.json = (b) => { origJson(b); resolve(); return res; };
    requireAuth(req, res, () => { nextCalled = true; resolve(); });
  });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);
  assert.equal(resBody.code, 'UNAUTHENTICATED');
  assert.equal(sessionDestroyed, true);
  assert.equal(clearedCookie, 'connect.sid');
});

test('TC-ADM-57\t[ADM-57] Giới hạn tần suất API Admin (adminLimit): vượt ngưỡng trả 429 TOO_MANY_REQUESTS; hết cửa sổ gọi lại được 200 (ADM-B57)', async (t) => {
  const { adminLimit } = require('../../src/middleware/rateLimit');
  assert.equal(typeof adminLimit, 'function');

  t.mock.timers.enable({ apis: ['Date'] });
  const windowMs = 60000;
  const db = fakeDb(seed());
  const limiter = rateLimit({ windowMs, max: 2, key: () => 'admin-rate-key' });
  const router = loadRouterWithStub({ _id: ids.admin, role: 'ADMIN' }, limiter);

  // 2 request đầu trong ngưỡng -> 200
  assert.equal((await call(router, db, 'GET', '/dashboard')).status, 200);
  assert.equal((await call(router, db, 'GET', '/dashboard')).status, 200);

  // Request thứ 3 vượt ngưỡng -> 429 TOO_MANY_REQUESTS
  const blocked = await call(router, db, 'GET', '/dashboard');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'TOO_MANY_REQUESTS');

  // Tua thời gian qua cửa sổ (windowMs) bằng mock.timers -> gọi lại thành công 200
  t.mock.timers.tick(windowMs + 1);
  const recovered = await call(router, db, 'GET', '/dashboard');
  assert.equal(recovered.status, 200);
});

/* =====================================================================
 * 3. Dashboard Service & Route (TC-ADM-15, 41, 43, 53, 59, 60)
 * ===================================================================== */

test('TC-ADM-15, TC-ADM-41, TC-ADM-43, TC-ADM-53\t[ADM-15, ADM-41, ADM-43, ADM-53] Dashboard route & service: mặc định 30 ngày giờ VN, tham số sai -> 422, Zone không tồn tại -> 404 ZONE_NOT_FOUND, đủ 4 nhóm chỉ số (không có fnbDirect/grandTotal) (ADM-B15; ADM-B41; ADM-B43; ADM-B53)', async () => {
  const db = fakeDb(seed(), {
    zones: [{ _id: ids.zoneA, zone_code: 'Z-A', name: 'Zone A' }],
    spaces: [{ _id: ids.spaceA, zone_id: ids.zoneA, space_code: 'SP-A', name: 'Space A', booking_mode: 'EXCLUSIVE', capacity: 4, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' }],
  });
  const router = loadRouterWithStub({ _id: ids.admin, role: 'ADMIN' });

  // TC-ADM-15: tham số sai -> 422 trước khi chạm DB
  const badDate = await call(router, db, 'GET', '/dashboard?from=2026-13-01');
  assert.equal(badDate.status, 422);
  assert.equal(badDate.body.error, 'INVALID_DATE');
  const badRange = await call(router, db, 'GET', '/dashboard?from=2026-11-05&to=2026-11-01');
  assert.equal(badRange.status, 422);
  assert.equal(badRange.body.error, 'INVALID_RANGE');

  // TC-ADM-43: Zone không tồn tại -> 404 ZONE_NOT_FOUND
  const badZoneOid = await call(router, db, 'GET', '/dashboard?zoneId=000000000000000000000000');
  assert.equal(badZoneOid.status, 404);
  assert.equal(badZoneOid.body.error, 'ZONE_NOT_FOUND');
  const badZoneCode = await call(router, db, 'GET', '/dashboard?zoneId=ZONE-KHONG-CO');
  assert.equal(badZoneCode.status, 404);
  assert.equal(badZoneCode.body.error, 'ZONE_NOT_FOUND');

  // TC-ADM-41 & TC-ADM-53: Mặc định 30 ngày lúc 03:00 sáng VN ngày 10/11/2026 (20:00Z 09/11) & đúng 4 nhóm chỉ số
  const dsh = await svc.getDashboard(db, {}, new Date('2026-11-09T20:00:00Z'));
  assert.deepEqual(dsh.range, {
    from: '2026-10-12',
    to: '2026-11-10',
    days: 30,
    timezone: 'Asia/Ho_Chi_Minh',
  });
  assert.deepEqual(dsh.filters, { zoneId: null, zoneCode: null });
  assert.ok('bookings' in dsh && 'occupancy' in dsh && 'revenue' in dsh && 'topAddons' in dsh);
  assert.equal('fnbDirect' in dsh.revenue, false);
  assert.equal('grandTotal' in dsh.revenue, false);

  // TC-ADM-44 & TC-ADM-45: Lọc theo zoneId (_id và zone_code) và groupBy=day
  const byZoneCode = await call(router, db, 'GET', '/dashboard?zoneId=Z-A&groupBy=day');
  assert.equal(byZoneCode.status, 200);
  assert.equal(byZoneCode.body.filters.zoneCode, 'Z-A');
  assert.ok(Array.isArray(byZoneCode.body.daily));
  const byZoneId = await call(router, db, 'GET', `/dashboard?zoneId=${ids.zoneA}`);
  assert.equal(byZoneId.status, 200);
  assert.equal(byZoneId.body.filters.zoneId, String(ids.zoneA));
});

test('TC-ADM-59, TC-ADM-60\t[ADM-59, ADM-60] Dashboard thực thu qua getDashboard: hoàn tiền FAILED và PENDING chưa trừ doanh thu cho đến khi đối soát hoặc chuyển SUCCESS (ADM-B59; ADM-B60)', async () => {
  const txPayment = { _id: new ObjectId(), booking_id: ids.booking1, type: 'PAYMENT', status: 'SUCCESS', amount: 600000, paid_at: new Date('2026-11-02T03:00:00Z') };
  const txRefundFailed = { _id: new ObjectId(), booking_id: ids.booking1, type: 'REFUND', status: 'FAILED', amount: 600000, processed_at: new Date('2026-11-02T04:00:00Z') };
  const txPayment2 = { _id: new ObjectId(), booking_id: ids.booking2, type: 'PAYMENT', status: 'SUCCESS', amount: 600000, paid_at: new Date('2026-11-03T03:00:00Z') };
  const txRefundPending = { _id: new ObjectId(), booking_id: ids.booking2, type: 'REFUND', status: 'PENDING', amount: 600000, processed_at: new Date('2026-11-03T04:00:00Z') };

  const db = fakeDb(seed(), {
    zones: [{ _id: ids.zoneA, zone_code: 'Z-A', name: 'Zone A' }],
    spaces: [{ _id: ids.spaceA, zone_id: ids.zoneA, space_code: 'SP-A', name: 'Space A', booking_mode: 'EXCLUSIVE', capacity: 4, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' }],
    bookings: [
      { _id: ids.booking1, user_id: ids.cust, space_id: ids.spaceA, status: 'CANCELLED', refund_status: 'FAILED', start_at: new Date('2026-11-02T02:00:00Z'), end_at: new Date('2026-11-02T06:00:00Z'), final_amount: 600000 },
      { _id: ids.booking2, user_id: ids.cust, space_id: ids.spaceA, status: 'CANCELLED', start_at: new Date('2026-11-03T02:00:00Z'), end_at: new Date('2026-11-03T06:00:00Z'), final_amount: 600000 },
    ],
    payment_transactions: [txPayment, txRefundFailed, txPayment2, txRefundPending],
  });

  // TC-ADM-59 (kỳ 02/11): đơn CANCELLED có REFUND FAILED -> chưa trừ doanh thu
  const d59Before = await svc.getDashboard(db, { from: '2026-11-02', to: '2026-11-02' });
  assert.equal(d59Before.bookings.byStatus.CANCELLED, 1);
  assert.equal(d59Before.revenue.total, 600000);
  assert.equal(d59Before.revenue.refunded.count, 0);

  // Admin đối soát hoàn tiền thủ công (ghi REFUND SUCCESS, method MANUAL)
  db._cols.payment_transactions.push({
    _id: new ObjectId(),
    booking_id: ids.booking1,
    type: 'REFUND',
    method: 'MANUAL',
    status: 'SUCCESS',
    amount: 600000,
    processed_at: new Date('2026-11-02T05:00:00Z'),
  });
  db._cols.bookings[0].refund_status = 'MANUALLY_RESOLVED';

  const d59After = await svc.getDashboard(db, { from: '2026-11-02', to: '2026-11-02' });
  assert.equal(d59After.revenue.total, 0);
  assert.deepEqual(d59After.revenue.refunded, { amount: 600000, count: 1 });

  // TC-ADM-60 (kỳ 03/11): REFUND đang PENDING -> chưa trừ doanh thu
  const d60Pending = await svc.getDashboard(db, { from: '2026-11-03', to: '2026-11-03' });
  assert.equal(d60Pending.revenue.total, 600000);
  assert.equal(d60Pending.revenue.refunded.count, 0);

  // Đổi status của REFUND từ PENDING sang SUCCESS trong DB
  await db.collection('payment_transactions').updateOne({ _id: txRefundPending._id }, { $set: { status: 'SUCCESS' } });

  const d60Success = await svc.getDashboard(db, { from: '2026-11-03', to: '2026-11-03' });
  assert.equal(d60Success.revenue.total, 0);
  assert.deepEqual(d60Success.revenue.refunded, { amount: 600000, count: 1 });
});

/* =====================================================================
 * 4. Danh sách khách, Hồ sơ & Lịch sử Booking (TC-ADM-01..03, 26..33, 63)
 * ===================================================================== */

test('TC-ADM-01, TC-ADM-02, TC-ADM-26, TC-ADM-27, TC-ADM-28, TC-ADM-29, TC-ADM-30, TC-ADM-63\t[ADM-01..02, ADM-26..30, ADM-63] Danh sách khách (listUsers): phân trang, tìm kiếm q (escape regex), lọc status/role/tier, kèm loyalty & bookingCount (ADM-B01; ADM-B02; ADM-B26..30; ADM-B63)', async () => {
  const db = fakeDb(seed(), {
    bookings: [
      { _id: ids.booking1, user_id: ids.cust, space_id: ids.spaceA, status: 'CONFIRMED', created_at: new Date('2026-11-01T10:00:00Z') },
      { _id: ids.booking2, user_id: ids.cust, space_id: ids.spaceA, status: 'CHECKED_OUT', created_at: new Date('2026-11-05T10:00:00Z') },
    ],
  });

  // TC-ADM-01, TC-ADM-30, TC-ADM-63: phân trang, loyalty, bookingCount, lastBookingAt, không lộ password_hash
  const page1 = await svc.listUsers(db, { page: 1, limit: 10 });
  assert.equal(page1.page, 1);
  assert.equal(page1.limit, 10);
  assert.equal(page1.total, 4);
  const custA = page1.items.find((u) => String(u._id) === String(ids.cust));
  assert.equal('password_hash' in custA, false);
  assert.deepEqual(custA.loyalty, { tier: 'SILVER', tierName: 'KÉN Bạc', points: 1200, coins: 300 });
  assert.equal(custA.bookingCount, 2);
  assert.deepEqual(custA.lastBookingAt, new Date('2026-11-05T10:00:00Z'));

  const custB = page1.items.find((u) => String(u._id) === String(ids.custLocked));
  assert.deepEqual(custB.loyalty, { tier: 'BASIC', tierName: 'KÉN Mới', points: 0, coins: 0 });
  assert.equal(custB.bookingCount, 0);
  assert.equal(custB.lastBookingAt, null);

  // TC-ADM-02: tìm kiếm q theo SĐT
  const byPhone = await svc.listUsers(db, { q: '0909' });
  assert.equal(byPhone.total, 1);
  assert.equal(String(byPhone.items[0]._id), String(ids.cust));

  // TC-ADM-26: lọc status, role, tier
  const lockedOnly = await svc.listUsers(db, { status: 'LOCKED' });
  assert.equal(lockedOnly.total, 1);
  assert.equal(lockedOnly.items[0].status, 'LOCKED');

  const silverCust = await svc.listUsers(db, { role: 'customer', tier: 'silver' });
  assert.equal(silverCust.total, 1);
  assert.equal(silverCust.items[0].loyalty.tier, 'SILVER');

  // TC-ADM-27: status không hợp lệ -> 422 INVALID_STATUS
  await assert.rejects(
    svc.listUsers(db, { status: 'DELETED' }),
    (e) => e.code === 'INVALID_STATUS' && e.status === 422
  );

  // TC-ADM-28: biên phân trang (page=0, limit=1000, page=9999)
  const clamped = await svc.listUsers(db, { page: 0, limit: 1000 });
  assert.equal(clamped.page, 1);
  assert.equal(clamped.limit, 100);
  const outOfRange = await svc.listUsers(db, { page: 9999, limit: 10 });
  assert.deepEqual(outOfRange.items, []);
  assert.equal(outOfRange.total, 4);

  // TC-ADM-29: q chứa ký tự regex đặc biệt (.*) không làm nổ regex và chỉ tìm chuỗi nguyên văn
  const regexLiteral = await svc.listUsers(db, { q: '.*' });
  assert.equal(regexLiteral.total, 0);
});

test('TC-ADM-03, TC-ADM-31, TC-ADM-32, TC-ADM-33\t[ADM-03, ADM-31..33] Hồ sơ khách (getUserProfile) & Lịch sử Booking (listUserBookings) (ADM-B03; ADM-B31..33)', async () => {
  const db = fakeDb(seed(), {
    spaces: [{ _id: ids.spaceA, space_code: 'SP-01', name: 'Focus Pod 1', zone_id: ids.zoneA }],
    bookings: [
      { _id: ids.booking1, user_id: ids.cust, space_id: ids.spaceA, status: 'CONFIRMED', final_amount: 200000, created_at: new Date('2026-11-01T10:00:00Z') },
      { _id: ids.booking2, user_id: ids.cust, space_id: ids.spaceA, status: 'CANCELLED', final_amount: 150000, created_at: new Date('2026-11-02T10:00:00Z') },
    ],
  });

  // TC-ADM-03 & TC-ADM-31: Hồ sơ khách kèm thống kê 7 trạng thái và totalSpent (chỉ PAID_STATUSES)
  const profile = await svc.getUserProfile(db, String(ids.cust));
  assert.equal('password_hash' in profile.user, false);
  assert.deepEqual(profile.user.loyalty, { tier: 'SILVER', tierName: 'KÉN Bạc', points: 1200, coins: 300 });
  assert.equal(profile.bookingStats.total, 2);
  assert.equal(profile.bookingStats.byStatus.CONFIRMED, 1);
  assert.equal(profile.bookingStats.byStatus.CANCELLED, 1);
  assert.equal(profile.bookingStats.byStatus.CHECKED_OUT, 0);
  assert.equal(profile.bookingStats.totalSpent, 200000); // chỉ cộng CONFIRMED, không cộng CANCELLED

  // TC-ADM-32: Lịch sử Booking của khách kèm thông tin Space và lọc status
  const hist = await svc.listUserBookings(db, String(ids.cust), { page: 1, limit: 5, status: 'CONFIRMED' });
  assert.equal(hist.total, 1);
  assert.equal(hist.items[0].status, 'CONFIRMED');
  assert.deepEqual(hist.items[0].space, {
    _id: ids.spaceA,
    space_code: 'SP-01',
    name: 'Focus Pod 1',
    zone_id: ids.zoneA,
  });

  // TC-ADM-33: Lọc lịch sử theo status sai -> 422 INVALID_STATUS
  await assert.rejects(
    svc.listUserBookings(db, String(ids.cust), { status: 'DELETED' }),
    (e) => e.code === 'INVALID_STATUS' && e.status === 422
  );
});

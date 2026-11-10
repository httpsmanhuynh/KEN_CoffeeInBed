'use strict';
/**
 * Mục 8.4 — Kiểm thử tự động API chuyên sâu và chịu tải (Real HTTP API Automation):
 *  - 8.4.1: RBAC và vòng đời Session Cookie qua HTTP thật (Set-Cookie, HttpOnly, SameSite, thu hồi khi khóa/hạ quyền/đổi MK, logout)
 *  - 8.4.2: Rate Limiting qua HTTP thật liên tục (nhận 429 TOO_MANY_REQUESTS theo Identifier/Phone, theo IP và theo Admin ID)
 *  - 8.4.3: Race Condition & Chịu tải (Load Test) qua HTTP thật:
 *           + 20 khách đặt đồng thời cùng 1 Space EXCLUSIVE cùng khung giờ -> chỉ 1 thành công (201), 19 bị chặn (409 OVERLAP)
 *           + 15 nhóm đặt đồng thời trên Space SHARED -> không vượt capacity (409 CAPACITY_EXCEEDED)
 *           + 15 khách tranh chấp lượt cuối cùng của Voucher -> chỉ 1 thành công (201), 14 bị chặn (422 VOUCHER_USAGE_LIMIT)
 *           + Chịu tải 100 concurrent HTTP requests -> 100% 200 OK, 0 lỗi 5xx
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const authRouter = require('../../src/routes/auth');
const bookingsRouter = require('../../src/routes/bookings');
const catalogRouter = require('../../src/routes/catalog');
const adminRouter = require('../../src/routes/admin');
const { recommendationRouter, adminForecastRouter } = require('../../src/routes/forecast');
const { buildSeedDb, IDS } = require('../helpers/mockDb');

function getTomorrowFutureSlotIso(dayOffset = 1, hourUtc = 3) {
  const d = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  d.setUTCHours(hourUtc, 0, 0, 0); // 03:00Z = 10:00 giờ VN (trong khung mở cửa 08:00-22:00)
  return d.toISOString();
}

function extractCookie(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  if (!raw || raw.length === 0) return { header: null, raw: [] };
  const sidPair = raw[0].split(';')[0];
  return { header: sidPair, raw };
}

async function createRealHttpApp(db) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });
  app.locals.db = db;

  app.use(
    session({
      secret: 'test-automation-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use('/api', authRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api', recommendationRouter);
  app.use('/api/admin/forecast', adminForecastRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl,
    close: () => new Promise((r) => server.close(r)),
  };
}

async function seedUsersWithPasswords(db, extraCount = 0) {
  const pwdHash = await bcrypt.hash('Password123!', 4);
  await db.collection('users').updateOne({ _id: IDS.user1 }, { $set: { password_hash: pwdHash, phone: '0901000001' } });
  await db.collection('users').updateOne({ _id: IDS.user2 }, { $set: { password_hash: pwdHash, phone: '0901000002' } });
  await db.collection('users').insertOne({
    _id: IDS.admin,
    full_name: 'Quản trị KÉN 1',
    phone: '0900000001',
    email: 'admin1@ken.vn',
    password_hash: pwdHash,
    role: 'ADMIN',
    status: 'ACTIVE',
    tier_id: IDS.tierDiamond,
    tier_points: 10000,
    coin_balance: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await db.collection('users').insertOne({
    _id: new ObjectId(),
    full_name: 'Quản trị KÉN 2 (Rate Limit Test)',
    phone: '0900000002',
    email: 'admin2@ken.vn',
    password_hash: pwdHash,
    role: 'ADMIN',
    status: 'ACTIVE',
    tier_id: IDS.tierDiamond,
    tier_points: 10000,
    coin_balance: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });

  const extraUsers = [];
  for (let i = 1; i <= extraCount; i++) {
    const u = {
      _id: new ObjectId(),
      full_name: `Khách Tải ${i}`,
      phone: `0988${String(i).padStart(6, '0')}`,
      email: `loaduser${i}@ken.vn`,
      password_hash: pwdHash,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      tier_id: IDS.tierBasic,
      tier_points: 0,
      coin_balance: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.collection('users').insertOne(u);
    extraUsers.push(u);
  }
  return extraUsers;
}

/* ------------------------------------------------ 8.4.1 RBAC & Session Cookie Lifecycle (HTTP thật) */

test('8.4.1 HTTP RBAC & Session Cookie Lifecycle: Set-Cookie chuẩn bảo mật, chặn 401/403, thu hồi ngay khi khóa/hạ quyền/đổi MK và logout', async () => {
  const db = buildSeedDb();
  await seedUsersWithPasswords(db);
  const srv = await createRealHttpApp(db);

  try {
    // 1. Guest chưa có cookie bị chặn 401 ở cả /api/me, /api/bookings (Admin) và /api/admin/forecast
    const guestMe = await fetch(`${srv.baseUrl}/api/me`);
    assert.equal(guestMe.status, 401);
    const guestAdm = await fetch(`${srv.baseUrl}/api/bookings`);
    assert.equal(guestAdm.status, 401);
    const guestForecast = await fetch(`${srv.baseUrl}/api/admin/forecast`);
    assert.equal(guestForecast.status, 401);

    // 2. Customer đăng nhập qua HTTP -> kiểm tra Set-Cookie (HttpOnly, SameSite=Lax, Max-Age=86400)
    const loginCust = await fetch(`${srv.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.1.1.1' },
      body: JSON.stringify({ identifier: '0901000001', password: 'Password123!' }),
    });
    assert.equal(loginCust.status, 200);
    const custCk = extractCookie(loginCust);
    assert.ok(custCk.header && custCk.header.startsWith('connect.sid='));
    assert.match(custCk.raw[0], /HttpOnly/i);
    assert.match(custCk.raw[0], /SameSite=Lax/i);
    const expMatch = /Expires=([^;]+)/i.exec(custCk.raw[0]);
    assert.ok(expMatch, 'Set-Cookie phải có Expires tương ứng 24h');
    const expDiffH = (new Date(expMatch[1]).getTime() - Date.now()) / (60 * 60 * 1000);
    assert.ok(expDiffH > 23.9 && expDiffH <= 24.1, `Cookie phải hết hạn sau ~24h (thực tế ${expDiffH.toFixed(2)}h)`);

    // Customer gọi /api/me -> 200; gọi API Admin (/api/bookings, /api/admin/forecast) -> 403 FORBIDDEN
    const custMe = await fetch(`${srv.baseUrl}/api/me`, { headers: { Cookie: custCk.header } });
    assert.equal(custMe.status, 200);
    const custAdm = await fetch(`${srv.baseUrl}/api/bookings`, { headers: { Cookie: custCk.header } });
    assert.equal(custAdm.status, 403);
    const custForecast = await fetch(`${srv.baseUrl}/api/admin/forecast`, { headers: { Cookie: custCk.header } });
    assert.equal(custForecast.status, 403);

    // 3. Khóa tài khoản Customer trong DB -> dùng lại Cookie cũ bị chặn 401 và xóa connect.sid ngay
    await db.collection('users').updateOne({ _id: IDS.user1 }, { $set: { status: 'LOCKED' } });
    const lockedCall = await fetch(`${srv.baseUrl}/api/me`, { headers: { Cookie: custCk.header } });
    assert.equal(lockedCall.status, 401);
    const clearedHeaders = lockedCall.headers.getSetCookie ? lockedCall.headers.getSetCookie().join(';') : '';
    assert.match(clearedHeaders, /connect\.sid=;/);

    // 4. Admin đăng nhập -> gọi /api/bookings & /api/admin/forecast -> 200; khi bị hạ role trong DB -> 403 ngay ở request kế tiếp
    const loginAdm = await fetch(`${srv.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.1.1.2' },
      body: JSON.stringify({ identifier: '0900000001', password: 'Password123!' }),
    });
    assert.equal(loginAdm.status, 200);
    const admCk = extractCookie(loginAdm);

    assert.equal((await fetch(`${srv.baseUrl}/api/bookings`, { headers: { Cookie: admCk.header } })).status, 200);
    assert.equal((await fetch(`${srv.baseUrl}/api/admin/forecast`, { headers: { Cookie: admCk.header } })).status, 200);

    // Hạ role Admin -> CUSTOMER trong DB
    await db.collection('users').updateOne({ _id: IDS.admin }, { $set: { role: 'CUSTOMER' } });
    const demotedCall = await fetch(`${srv.baseUrl}/api/bookings`, { headers: { Cookie: admCk.header } });
    assert.equal(demotedCall.status, 403);

    // 5. Đổi mật khẩu (password_changed_at thay đổi) -> session hiện tại bị thu hồi 401
    await db.collection('users').updateOne({ _id: IDS.admin }, { $set: { password_changed_at: new Date(Date.now() + 5000) } });
    const pwdChangedCall = await fetch(`${srv.baseUrl}/api/me`, { headers: { Cookie: admCk.header } });
    assert.equal(pwdChangedCall.status, 401);

    // 6. Logout hủy session
    const login2 = await fetch(`${srv.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.1.1.3' },
      body: JSON.stringify({ identifier: '0901000002', password: 'Password123!' }),
    });
    assert.equal(login2.status, 200);
    const ck2 = extractCookie(login2);
    const logoutRes = await fetch(`${srv.baseUrl}/api/logout`, {
      method: 'POST',
      headers: { Cookie: ck2.header, 'X-Forwarded-For': '10.1.1.3' },
    });
    assert.equal(logoutRes.status, 204);
    assert.equal((await fetch(`${srv.baseUrl}/api/me`, { headers: { Cookie: ck2.header } })).status, 401);

    console.log(
      `[8.4.1 HTTP RBAC & Session] Guest: 401 | Customer->Admin: 403 | Locked/PwdChanged: 401+clearCookie | Demoted Admin: 403 | Logout: 204->401`,
    );
  } finally {
    await srv.close();
  }
});

/* ------------------------------------------------ 8.4.2 HTTP Burst Rate Limiting (429 TOO_MANY_REQUESTS) */

test('8.4.2 HTTP Rate Limiting liên tục: bắn burst HTTP thật nhận 429 TOO_MANY_REQUESTS theo Identifier/Phone, theo IP và theo Admin ID', async () => {
  const db = buildSeedDb();
  await seedUsersWithPasswords(db);
  const srv = await createRealHttpApp(db);

  try {
    // A. Rate Limit theo Identifier (loginLimiter: max 10 / 15p) — dùng identifier riêng để không dính lượt từ test trước
    const targetId = '0901999999';
    const idStatuses = [];
    for (let i = 1; i <= 12; i++) {
      const r = await fetch(`${srv.baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.20.1.${i}` },
        body: JSON.stringify({ identifier: targetId, password: 'WrongPassword!' }),
      });
      idStatuses.push(r.status);
    }
    assert.equal(idStatuses.slice(0, 10).every((s) => s === 401), true, '10 lần đầu cùng identifier phải qua limiter (401 sai MK)');
    assert.equal(idStatuses[10], 429, 'Request thứ 11 cùng identifier phải trả HTTP 429 TOO_MANY_REQUESTS');
    assert.equal(idStatuses[11], 429);

    // Identifier khác vẫn đăng nhập được bình thường (không bị ảnh hưởng)
    const otherUserLogin = await fetch(`${srv.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.20.1.99' },
      body: JSON.stringify({ identifier: '0901000002', password: 'Password123!' }),
    });
    assert.equal(otherUserLogin.status, 200);

    // B. Rate Limit theo IP (ipLimiter: max 30 / 15p) — dùng 31 identifier khác nhau từ CÙNG 1 IP
    const sameIpStatuses = [];
    for (let i = 1; i <= 32; i++) {
      const r = await fetch(`${srv.baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '172.16.99.50' },
        body: JSON.stringify({ identifier: `unique_user_${i}`, password: 'x' }),
      });
      sameIpStatuses.push(r.status);
    }
    assert.equal(sameIpStatuses.slice(0, 30).every((s) => s === 401), true, '30 request đầu cùng IP được phép qua ipLimiter');
    assert.equal(sameIpStatuses[30], 429, 'Request thứ 31 cùng IP phải nhận HTTP 429 TOO_MANY_REQUESTS');
    assert.equal(sameIpStatuses[31], 429);

    // IP khác không bị khóa
    const otherIpRes = await fetch(`${srv.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '172.16.99.51' },
      body: JSON.stringify({ identifier: '0901000002', password: 'Password123!' }),
    });
    assert.equal(otherIpRes.status, 200);

    // C. Rate Limit OTP theo SĐT (phoneOtpLimiter: max 5 / 10p) qua HTTP POST /api/forgot-password
    const otpStatuses = [];
    for (let i = 1; i <= 6; i++) {
      const r = await fetch(`${srv.baseUrl}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.30.1.${i}` },
        body: JSON.stringify({ phone: '0909888777' }),
      });
      otpStatuses.push(r.status);
    }
    assert.equal(otpStatuses.slice(0, 5).every((s) => s === 200), true);
    assert.equal(otpStatuses[5], 429);

    // D. Rate Limit Admin (adminLimit: max 60 / 15p) qua HTTP GET /api/admin/forecast với Admin2 riêng biệt
    const admLogin = await fetch(`${srv.baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.40.1.1' },
      body: JSON.stringify({ identifier: '0900000002', password: 'Password123!' }),
    });
    assert.equal(admLogin.status, 200);
    const admCk = extractCookie(admLogin);
    const admStatuses = [];
    for (let i = 1; i <= 62; i++) {
      const r = await fetch(`${srv.baseUrl}/api/admin/forecast`, { headers: { Cookie: admCk.header } });
      admStatuses.push(r.status);
    }
    assert.equal(admStatuses.slice(0, 60).every((s) => s === 200), true, '60 request Admin đầu trả 200');
    assert.equal(admStatuses[60], 429, 'Request Admin thứ 61 trả HTTP 429 TOO_MANY_REQUESTS');
    assert.equal(admStatuses[61], 429);

    console.log(
      `[8.4.2 HTTP Rate Limit] Identifier(12 reqs): ${idStatuses.filter((s) => s === 429).length}x429 | ` +
        `IP(32 reqs): ${sameIpStatuses.filter((s) => s === 429).length}x429 | ` +
        `OTP(6 reqs): ${otpStatuses.filter((s) => s === 429).length}x429 | ` +
        `Admin(62 reqs): ${admStatuses.filter((s) => s === 429).length}x429`,
    );
  } finally {
    await srv.close();
  }
});

/* ------------------------------------------------ 8.4.3 HTTP Race Condition & Load Test (Booking & Voucher) */

test('8.4.3 HTTP Race Condition & Chịu tải: 20 khách đặt đồng thời cùng Space EXCLUSIVE, 15 nhóm đặt Space SHARED, 15 khách tranh Voucher cuối & 100 req chịu tải', async () => {
  const db = buildSeedDb();
  const extraUsers = await seedUsersWithPasswords(db, 20);
  const srv = await createRealHttpApp(db);

  try {
    // Đăng nhập 20 khách qua HTTP thật để lấy 20 session cookie hợp lệ
    const cookies = [];
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${srv.baseUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.50.1.${i + 1}` },
        body: JSON.stringify({ identifier: extraUsers[i].phone, password: 'Password123!' }),
      });
      assert.equal(res.status, 200);
      cookies.push(extractCookie(res).header);
    }

    // ---- Test A: 20 khách bắn POST /api/bookings ĐỒNG THỜI vào CÙNG 1 Focus Pod (EXCLUSIVE), CÙNG 1 khung giờ ----
    const slotEx = getTomorrowFutureSlotIso(2, 3);
    const tExStart = performance.now();
    const exResponses = await Promise.all(
      cookies.map(async (ck) => {
        const res = await fetch(`${srv.baseUrl}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: ck },
          body: JSON.stringify({
            spaceId: String(IDS.spaceFocusPod),
            packageId: String(IDS.pkgFpHalf),
            startAt: slotEx,
            guestCount: 1,
          }),
        });
        return { status: res.status, body: await res.json() };
      }),
    );
    const exMs = Math.round(performance.now() - tExStart);
    const ex201 = exResponses.filter((r) => r.status === 201);
    const ex409 = exResponses.filter((r) => r.status === 409 && r.body.code === 'OVERLAP');
    const ex500 = exResponses.filter((r) => r.status >= 500);

    assert.equal(ex201.length, 1, 'Đúng 1 khách đặt được Focus Pod EXCLUSIVE');
    assert.equal(ex409.length, 19, '19 khách còn lại phải nhận 409 OVERLAP');
    assert.equal(ex500.length, 0, 'Không được phát sinh lỗi 500');
    const dbExBookings = await db.collection('bookings').find({ space_id: IDS.spaceFocusPod }).toArray();
    assert.equal(dbExBookings.length, 1);

    // ---- Test B: 15 nhóm bắn POST /api/bookings ĐỒNG THỜI trên Work Lounge (SHARED capacity=20) ----
    // Trước tiên đặt sẵn 14 chỗ -> còn trống đúng 6 chỗ
    const slotSh = getTomorrowFutureSlotIso(3, 3);
    const preRes = await fetch(`${srv.baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies[0] },
      body: JSON.stringify({
        spaceId: String(IDS.spaceWorkLounge),
        packageId: String(IDS.pkgWlFlex),
        startAt: slotSh,
        hours: 2,
        guestCount: 14,
      }),
    });
    assert.equal(preRes.status, 201);

    // 15 request đồng thời mỗi request đặt 3 chỗ -> chỉ đúng 2 request thành công (14 + 3 + 3 = 20), 13 bị 409 CAPACITY_EXCEEDED
    const shResponses = await Promise.all(
      cookies.slice(0, 15).map(async (ck) => {
        const res = await fetch(`${srv.baseUrl}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: ck },
          body: JSON.stringify({
            spaceId: String(IDS.spaceWorkLounge),
            packageId: String(IDS.pkgWlFlex),
            startAt: slotSh,
            hours: 2,
            guestCount: 3,
          }),
        });
        return { status: res.status, body: await res.json() };
      }),
    );
    const sh201 = shResponses.filter((r) => r.status === 201);
    const sh409 = shResponses.filter((r) => r.status === 409 && r.body.code === 'CAPACITY_EXCEEDED');
    assert.equal(sh201.length, 2, 'Chỉ đúng 2 nhóm 3 khách vừa khít sức chứa 20');
    assert.equal(sh409.length, 13, '13 nhóm vượt sức chứa phải nhận 409 CAPACITY_EXCEEDED');

    // ---- Test C: 15 khách bắn POST /api/bookings ĐỒNG THỜI trên các ngày KHÁC NHAU cùng tranh 1 lượt cuối của Voucher WELCOME10 ----
    await db.collection('vouchers').updateOne(
      { _id: IDS.voucherWelcome },
      { $set: { usage_limit: 5, usage_count: 4 } },
    );
    const vchResponses = await Promise.all(
      cookies.slice(0, 15).map(async (ck, idx) => {
        const res = await fetch(`${srv.baseUrl}/api/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: ck },
          body: JSON.stringify({
            spaceId: String(IDS.spaceWorkLounge),
            packageId: String(IDS.pkgWlFlex),
            startAt: getTomorrowFutureSlotIso(5 + idx, 3), // 15 ngày khác nhau để KHÔNG đụng trùng phòng, chỉ tranh đúng Voucher!
            hours: 4,
            guestCount: 2,
            voucherCode: 'WELCOME10',
          }),
        });
        return { status: res.status, body: await res.json() };
      }),
    );
    const vch201 = vchResponses.filter((r) => r.status === 201);
    const vch422 = vchResponses.filter((r) => r.status === 422 && r.body.code === 'VOUCHER_USAGE_LIMIT');
    const vch500 = vchResponses.filter((r) => r.status >= 500);
    assert.equal(vch201.length, 1, 'Chỉ đúng 1 khách giành được lượt Voucher cuối');
    assert.equal(vch422.length, 14, '14 khách còn lại phải nhận 422 VOUCHER_USAGE_LIMIT');
    assert.equal(vch500.length, 0);
    const voucherAfter = await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome });
    assert.equal(voucherAfter.usage_count, 5);

    // ---- Test D: Chịu tải (Load / Stress Test) 100 concurrent HTTP requests ----
    const loadStart = performance.now();
    const loadResults = await Promise.all(
      Array.from({ length: 100 }, async (_v, idx) => {
        const reqStart = performance.now();
        let res;
        if (idx % 3 === 0) {
          res = await fetch(`${srv.baseUrl}/api/spaces?startAt=${encodeURIComponent(getTomorrowFutureSlotIso(4, 3))}&guestCount=1`);
        } else if (idx % 3 === 1) {
          res = await fetch(`${srv.baseUrl}/api/bookings/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              spaceId: String(IDS.spaceFocusPod),
              packageId: String(IDS.pkgFpHalf),
              startAt: getTomorrowFutureSlotIso(4, 3),
              guestCount: 1,
            }),
          });
        } else {
          res = await fetch(`${srv.baseUrl}/api/recommendations`);
        }
        await res.json();
        return { status: res.status, latencyMs: performance.now() - reqStart };
      }),
    );
    const totalLoadMs = Math.max(1, performance.now() - loadStart);
    const okCount = loadResults.filter((r) => r.status === 200).length;
    const sortedLat = loadResults.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p95Ms = Math.round(sortedLat[Math.floor(sortedLat.length * 0.95)]);
    const rps = Math.round((100 / totalLoadMs) * 1000);

    assert.equal(okCount, 100, '100/100 concurrent requests phải trả 200 OK');

    console.log(
      `[8.4.3 HTTP Race & Load] Exclusive(20 concurrent): 201=${ex201.length}, 409=${ex409.length} (${exMs}ms) | ` +
        `Shared(15 concurrent): 201=${sh201.length}, 409=${sh409.length} | ` +
        `Voucher(15 concurrent): 201=${vch201.length}, 422=${vch422.length} | ` +
        `Load(100 concurrent): ${okCount}/100 200 OK, ${Math.round(totalLoadMs)}ms total (~${rps} req/s, p95=${p95Ms}ms)`,
    );
  } finally {
    await srv.close();
  }
});

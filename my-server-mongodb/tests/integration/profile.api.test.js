'use strict';
/**
 * Kiểm thử tích hợp Hồ sơ cá nhân & OTP Hồ sơ (BR-A05, BR-A06, BR-A08)
 * Đồng bộ mã TC với Postman Module 01:
 *  - Hồ sơ: TC-ME-01..08
 *  - OTP Hồ sơ: TC-OT-01..12
 *  - Hồ sơ cá nhân: TC-PF-01..15
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

// Đảm bảo chạy chế độ mock SMS/Email nội bộ, không gọi SMTP thật khi chạy unit/integration test
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const authRouter = require('../../src/routes/auth');
const profileRouter = require('../../src/routes/profile');

const DEFAULT_PW = 'Password123!';
const DEFAULT_HASH = bcrypt.hashSync(DEFAULT_PW, 4); // cost=4 để test chạy nhanh

function createProfileTestDb() {
  const tierId = new ObjectId();
  const collections = {
    membership_tiers: [
      { _id: tierId, code: 'BASIC', name: 'Hạng Cơ Bản', level_order: 1, min_points: 0, discount_rate: 0 },
    ],
    users: [],
    otp_codes: [],
  };

  let forceDuplicateKeyOnNextUpdate = false;

  const matches = (doc, filter) =>
    Object.entries(filter).every(([k, v]) => {
      if (k === '$or' && Array.isArray(v)) {
        return v.some((sub) => matches(doc, sub));
      }
      if (v && typeof v === 'object' && !(v instanceof ObjectId) && !(v instanceof Date)) {
        if ('$lt' in v) return (doc[k] || 0) < v.$lt;
        if ('$ne' in v) return String(doc[k]) !== String(v.$ne);
        if ('$type' in v) return doc[k] !== undefined && doc[k] !== null;
      }
      if (v instanceof ObjectId || doc[k] instanceof ObjectId) {
        return String(doc[k]) === String(v);
      }
      return doc[k] === v;
    });

  return {
    tierId,
    _raw: collections,
    triggerDuplicateOnNextUpdate() {
      forceDuplicateKeyOnNextUpdate = true;
    },
    seedUser(overrides = {}) {
      const user = {
        _id: new ObjectId(),
        full_name: 'Nguyễn Văn A',
        phone: '0901234567',
        email: 'vana@example.com',
        password_hash: DEFAULT_HASH,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        tier_id: tierId,
        points: 0,
        coins: 0,
        two_factor_enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
        ...overrides,
      };
      collections.users.push(user);
      return user;
    },
    collection(name) {
      const rows = collections[name] || (collections[name] = []);
      return {
        async findOne(filter, options = {}) {
          let matched = rows.filter((r) => matches(r, filter));
          if (options.sort && options.sort.created_at === -1) {
            matched = matched.slice().reverse();
          }
          return matched[0] ? { ...matched[0] } : null;
        },
        async insertOne(doc) {
          const inserted = { _id: new ObjectId(), ...doc };
          rows.push(inserted);
          return { insertedId: inserted._id };
        },
        async updateOne(filter, update) {
          if (forceDuplicateKeyOnNextUpdate && name === 'users') {
            forceDuplicateKeyOnNextUpdate = false;
            const err = new Error('E11000 duplicate key error');
            err.code = 11000;
            throw err;
          }
          const doc = rows.find((r) => matches(r, filter));
          if (!doc) return { matchedCount: 0, modifiedCount: 0 };
          if (update.$set) Object.assign(doc, update.$set);
          if (update.$unset) {
            for (const k of Object.keys(update.$unset)) {
              delete doc[k];
            }
          }
          if (update.$inc) {
            for (const [k, val] of Object.entries(update.$inc)) {
              doc[k] = (doc[k] || 0) + val;
            }
          }
          return { matchedCount: 1, modifiedCount: 1 };
        },
        async updateMany(filter, update) {
          let count = 0;
          for (const doc of rows) {
            if (matches(doc, filter)) {
              if (update.$set) Object.assign(doc, update.$set);
              count++;
            }
          }
          return { matchedCount: count, modifiedCount: count };
        },
      };
    },
  };
}

async function startTestServer(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });
  app.use(cookieParser());
  app.use(
    session({
      secret: 'dev-only-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 3600000 },
    }),
  );
  app.locals.db = db;

  // Route test-login nội bộ để khởi tạo session nhanh không tốn bước login
  app.post('/__test/login', (req, res) => {
    const user = db._raw.users.find((u) => String(u._id) === String(req.body.userId));
    const pwdAt = user?.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
    req.session.user = { id: String(user._id), role: user.role, pwdAt };
    res.json({ ok: true });
  });

  app.use('/api', authRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { body, cookie } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    const newCookie = setCookie ? setCookie.split(';')[0] : cookie;
    const text = await res.text();
    return {
      status: res.status,
      body: text ? JSON.parse(text) : null,
      cookie: newCookie,
      setCookieHeader: setCookie || '',
    };
  }

  async function loginAs(user) {
    const res = await request('POST', '/__test/login', { body: { userId: String(user._id) } });
    return res.cookie;
  }

  async function issueOtpAndCapture(cookie, payload) {
    let capturedCode = null;
    const origLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      const m = msg.match(/Ma OTP KEN cua ban:\s*(\d{6})/);
      if (m) capturedCode = m[1];
    };
    try {
      const res = await request('POST', '/api/profile/me/otp', { body: payload, cookie });
      return { res, code: capturedCode };
    } finally {
      console.log = origLog;
    }
  }

  return {
    server,
    request,
    loginAs,
    issueOtpAndCapture,
    close: () => new Promise((r) => server.close(r)),
  };
}

// ============================================================================
// 1. Nhóm Hồ sơ: TC-ME-01..08
// ============================================================================
test('TC-ME-01..08\tAUTO-ME-01: Xem hồ sơ (/api/profile & /api/auth/me), chặn chưa đăng nhập, khóa tài khoản, xóa user, tier_id không tồn tại', async () => {
  const db = createProfileTestDb();
  const srv = await startTestServer(db);
  try {
    const user = db.seedUser({ phone: '0901111111', email: 'me01@example.com' });
    const cookie = await srv.loginAs(user);

    // TC-ME-01: GET /api/profile khi đã đăng nhập
    const r1 = await srv.request('GET', '/api/profile', { cookie });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.phone, '0901111111');
    assert.equal(r1.body.membershipTier, 'BASIC');
    assert.equal('password_hash' in r1.body, false);

    // TC-ME-02: GET /api/auth/me (alias)
    const r2 = await srv.request('GET', '/api/auth/me', { cookie });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.id, String(user._id));

    // TC-ME-03..04: Chưa đăng nhập hoặc cookie giả mạo -> 401
    const r3 = await srv.request('GET', '/api/profile');
    assert.equal(r3.status, 401);
    assert.equal(r3.body.code, 'UNAUTHENTICATED');

    const r4 = await srv.request('GET', '/api/profile', { cookie: 'connect.sid=s%3Afake.invalid' });
    assert.equal(r4.status, 401);

    // TC-ME-08: tier_id trỏ tới hạng không tồn tại -> vẫn trả 200 với membershipTier fallback 'BASIC'
    user.tier_id = new ObjectId();
    const r8 = await srv.request('GET', '/api/profile', { cookie });
    assert.equal(r8.status, 200);
    assert.equal(r8.body.membershipTier, 'BASIC');

    // TC-ME-06: Admin khóa tài khoản khi user đang đăng nhập -> 401 + xóa cookie
    user.status = 'LOCKED';
    const r6 = await srv.request('GET', '/api/profile', { cookie });
    assert.equal(r6.status, 401);
    assert.equal(r6.body.code, 'UNAUTHENTICATED');

    // TC-ME-07: User bị xóa khỏi DB khi đang đăng nhập -> 401
    const userDel = db.seedUser({ phone: '0901111112' });
    const cookieDel = await srv.loginAs(userDel);
    db._raw.users.splice(db._raw.users.indexOf(userDel), 1);
    const r7 = await srv.request('GET', '/api/profile', { cookie: cookieDel });
    assert.equal(r7.status, 401);
  } finally {
    await srv.close();
  }
});

// ============================================================================
// 2. Nhóm OTP Hồ sơ: TC-OT-01..06 (Gửi OTP /api/profile/me/otp)
// ============================================================================
test('TC-OT-01..06\tAUTO-OT-01: Yêu cầu OTP hồ sơ (CHANGE_PASSWORD, TOGGLE_2FA, CHANGE_PHONE) và kiểm tra ngoại lệ', async () => {
  const db = createProfileTestDb();
  const srv = await startTestServer(db);
  try {
    const user = db.seedUser({ phone: '0902222221', email: null });
    db.seedUser({ phone: '0909999999', email: 'other@example.com' }); // user khác đã chiếm số 0909999999
    const cookie = await srv.loginAs(user);

    // TC-OT-01: Gửi OTP CHANGE_PASSWORD & TOGGLE_2FA thành công
    const ot1a = await srv.issueOtpAndCapture(cookie, { purpose: 'CHANGE_PASSWORD' });
    assert.equal(ot1a.res.status, 200);
    assert.match(ot1a.code, /^\d{6}$/);

    const ot1b = await srv.issueOtpAndCapture(cookie, { purpose: 'TOGGLE_2FA' });
    assert.equal(ot1b.res.status, 200);
    assert.match(ot1b.code, /^\d{6}$/);

    // TC-OT-02: Gửi OTP CHANGE_PHONE hợp lệ tới số mới
    const ot2 = await srv.issueOtpAndCapture(cookie, { purpose: 'CHANGE_PHONE', newPhone: '0912345678' });
    assert.equal(ot2.res.status, 200);
    assert.match(ot2.code, /^\d{6}$/);

    // TC-OT-03: CHANGE_PHONE với newPhone sai định dạng -> 422 VALIDATION_ERROR
    const user2 = db.seedUser({ phone: '0902222222' });
    const cookie2 = await srv.loginAs(user2);
    const ot3 = await srv.request('POST', '/api/profile/me/otp', {
      cookie: cookie2,
      body: { purpose: 'CHANGE_PHONE', newPhone: '12345' },
    });
    assert.equal(ot3.status, 422);
    assert.equal(ot3.body.code, 'VALIDATION_ERROR');

    // TC-OT-04: CHANGE_PHONE nhưng newPhone trùng số hiện tại -> 422 PHONE_UNCHANGED
    const ot4 = await srv.request('POST', '/api/profile/me/otp', {
      cookie: cookie2,
      body: { purpose: 'CHANGE_PHONE', newPhone: '0902222222' },
    });
    assert.equal(ot4.status, 422);
    assert.equal(ot4.body.code, 'PHONE_UNCHANGED');

    // TC-OT-05: CHANGE_PHONE nhưng newPhone đã thuộc tài khoản khác -> 409 PHONE_EXISTS
    const ot5 = await srv.request('POST', '/api/profile/me/otp', {
      cookie: cookie2,
      body: { purpose: 'CHANGE_PHONE', newPhone: '0909999999' },
    });
    assert.equal(ot5.status, 409);
    assert.equal(ot5.body.code, 'PHONE_EXISTS');

    // TC-OT-06: Gửi /me/otp với purpose không hợp lệ -> 422 VALIDATION_ERROR
    const ot6 = await srv.request('POST', '/api/profile/me/otp', {
      cookie: cookie2,
      body: { purpose: 'FORGOT_PASSWORD' },
    });
    assert.equal(ot6.status, 422);
    assert.equal(ot6.body.code, 'VALIDATION_ERROR');
  } finally {
    await srv.close();
  }
});

// ============================================================================
// 3. Nhóm Đổi mật khẩu & Bảo mật OTP: TC-OT-07..12
// ============================================================================
test('TC-OT-07..12\tAUTO-OT-02: Đổi mật khẩu (/me/password): OTP sai, hết hạn, quá 5 lần, tái sử dụng, sai purpose, otpNotOwned', async () => {
  const db = createProfileTestDb();
  const srv = await startTestServer(db);
  try {
    const user = db.seedUser({ phone: '0903333331', email: 'ot07@example.com' });
    const cookie = await srv.loginAs(user);

    const { code } = await srv.issueOtpAndCapture(cookie, { purpose: 'CHANGE_PASSWORD' });

    // Kiểm tra mật khẩu mới không khớp / quá ngắn -> 422 VALIDATION_ERROR
    const badNew = await srv.request('POST', '/api/profile/me/password', {
      cookie,
      body: { currentPassword: DEFAULT_PW, newPassword: 'short', confirmPassword: 'short', code },
    });
    assert.equal(badNew.status, 422);
    assert.equal(badNew.body.code, 'VALIDATION_ERROR');

    // Kiểm tra mật khẩu hiện tại sai -> 422 INVALID_CURRENT_PASSWORD
    const badCurr = await srv.request('POST', '/api/profile/me/password', {
      cookie,
      body: { currentPassword: 'WrongPassword!', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code },
    });
    assert.equal(badCurr.status, 422);
    assert.equal(badCurr.body.code, 'INVALID_CURRENT_PASSWORD');

    // Kiểm tra mật khẩu mới trùng mật khẩu hiện tại -> 422 VALIDATION_ERROR
    const samePw = await srv.request('POST', '/api/profile/me/password', {
      cookie,
      body: { currentPassword: DEFAULT_PW, newPassword: DEFAULT_PW, confirmPassword: DEFAULT_PW, code },
    });
    assert.equal(samePw.status, 422);
    assert.equal(samePw.body.code, 'VALIDATION_ERROR');

    // TC-OT-07: Đổi mật khẩu với mã OTP sai -> 422 OTP_INVALID
    const wrongOtp = await srv.request('POST', '/api/profile/me/password', {
      cookie,
      body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code: '000000' },
    });
    assert.equal(wrongOtp.status, 422);
    assert.equal(wrongOtp.body.code, 'OTP_INVALID');

    // TC-OT-10: Đổi mật khẩu thành công -> dùng lại OTP lần 2 bị chặn (422 OTP_INVALID)
    const okPw = await srv.request('POST', '/api/profile/me/password', {
      cookie,
      body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code },
    });
    assert.equal(okPw.status, 200);
    const activeCookie = okPw.cookie; // session mới sau khi đổi mật khẩu

    const reuseOtp = await srv.request('POST', '/api/profile/me/password', {
      cookie: activeCookie,
      body: { currentPassword: 'NewPassword123!', newPassword: 'NewPassword456!', confirmPassword: 'NewPassword456!', code },
    });
    assert.equal(reuseOtp.status, 422);
    assert.equal(reuseOtp.body.code, 'OTP_INVALID');

    // TC-OT-08: Đổi mật khẩu với mã OTP đã hết hạn -> 422 OTP_EXPIRED
    const userExp = db.seedUser({ phone: '0903333332' });
    const cookieExp = await srv.loginAs(userExp);
    const { code: expCode } = await srv.issueOtpAndCapture(cookieExp, { purpose: 'CHANGE_PASSWORD' });
    const otpDoc = db._raw.otp_codes.find((o) => o.phone === '0903333332' && !o.is_used);
    otpDoc.expires_at = new Date(Date.now() - 1000);
    const rExp = await srv.request('POST', '/api/profile/me/password', {
      cookie: cookieExp,
      body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code: expCode },
    });
    assert.equal(rExp.status, 422);
    assert.equal(rExp.body.code, 'OTP_EXPIRED');

    // TC-OT-09: Nhập sai OTP quá 5 lần -> 429 OTP_TOO_MANY_ATTEMPTS
    const userLock = db.seedUser({ phone: '0903333333' });
    const cookieLock = await srv.loginAs(userLock);
    const { code: lockCode } = await srv.issueOtpAndCapture(cookieLock, { purpose: 'CHANGE_PASSWORD' });
    for (let i = 1; i <= 4; i++) {
      const rTry = await srv.request('POST', '/api/profile/me/password', {
        cookie: cookieLock,
        body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code: '999999' },
      });
      assert.equal(rTry.status, 422);
    }
    const rTry5 = await srv.request('POST', '/api/profile/me/password', {
      cookie: cookieLock,
      body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code: '999999' },
    });
    assert.equal(rTry5.status, 429);
    assert.equal(rTry5.body.code, 'OTP_TOO_MANY_ATTEMPTS');

    // Lần 6 nhập mã đúng vẫn trả 429
    const rTry6 = await srv.request('POST', '/api/profile/me/password', {
      cookie: cookieLock,
      body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code: lockCode },
    });
    assert.equal(rTry6.status, 429);

    // TC-OT-11: Dùng OTP của mục đích khác (TOGGLE_2FA) để gọi /me/password -> 422 OTP_INVALID
    const user11 = db.seedUser({ phone: '0903333336' });
    const cookie11 = await srv.loginAs(user11);
    const { code: twoFaCode } = await srv.issueOtpAndCapture(cookie11, { purpose: 'TOGGLE_2FA' });
    const rWrongPurpose = await srv.request('POST', '/api/profile/me/password', {
      cookie: cookie11,
      body: { currentPassword: DEFAULT_PW, newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!', code: twoFaCode },
    });
    assert.equal(rWrongPurpose.status, 422);
    assert.equal(rWrongPurpose.body.code, 'OTP_INVALID');

    // TC-OT-12: Chặn dùng OTP của người khác (otpNotOwned)
    const userA = db.seedUser({ phone: '0903333334' });
    const userB = db.seedUser({ phone: '0903333335' });
    const cookieA = await srv.loginAs(userA);
    const cookieB = await srv.loginAs(userB);
    const { code: otpPhoneA } = await srv.issueOtpAndCapture(cookieA, {
      purpose: 'CHANGE_PHONE',
      newPhone: '0918888888',
    });
    const rStolen = await srv.request('POST', '/api/profile/me/phone', {
      cookie: cookieB,
      body: { newPhone: '0918888888', currentPassword: DEFAULT_PW, code: otpPhoneA },
    });
    assert.equal(rStolen.status, 422);
    assert.equal(rStolen.body.code, 'OTP_INVALID');
  } finally {
    await srv.close();
  }
});

// ============================================================================
// 4. Nhóm Hồ sơ cá nhân: TC-PF-01..04 (Bật / tắt 2FA)
// ============================================================================
test('TC-PF-01..04\tAUTO-PF-01: Bật/tắt 2FA (/me/2fa) thành công và kiểm tra lỗi kiểu dữ liệu / trùng trạng thái', async () => {
  const db = createProfileTestDb();
  const srv = await startTestServer(db);
  try {
    const user = db.seedUser({ phone: '0904444441', two_factor_enabled: false });
    const cookie = await srv.loginAs(user);

    // TC-PF-03: enabled không phải kiểu boolean -> 422 VALIDATION_ERROR
    const pf3 = await srv.request('POST', '/api/profile/me/2fa', {
      cookie,
      body: { enabled: 'true', currentPassword: DEFAULT_PW, code: '123456' },
    });
    assert.equal(pf3.status, 422);
    assert.equal(pf3.body.code, 'VALIDATION_ERROR');

    // TC-PF-04: Tắt 2FA khi đang tắt -> 422 TWO_FACTOR_UNCHANGED
    const pf4 = await srv.request('POST', '/api/profile/me/2fa', {
      cookie,
      body: { enabled: false, currentPassword: DEFAULT_PW, code: '123456' },
    });
    assert.equal(pf4.status, 422);
    assert.equal(pf4.body.code, 'TWO_FACTOR_UNCHANGED');

    // Sai mật khẩu hiện tại -> 422 INVALID_CURRENT_PASSWORD
    const badPw = await srv.request('POST', '/api/profile/me/2fa', {
      cookie,
      body: { enabled: true, currentPassword: 'wrong', code: '123456' },
    });
    assert.equal(badPw.status, 422);
    assert.equal(badPw.body.code, 'INVALID_CURRENT_PASSWORD');

    // Sai mã OTP -> 422 OTP_INVALID
    const badOtp = await srv.request('POST', '/api/profile/me/2fa', {
      cookie,
      body: { enabled: true, currentPassword: DEFAULT_PW, code: '000000' },
    });
    assert.equal(badOtp.status, 422);
    assert.equal(badOtp.body.code, 'OTP_INVALID');

    // TC-PF-01: Bật 2FA thành công -> 200 { twoFactorEnabled: true }
    const { code: otpEnable } = await srv.issueOtpAndCapture(cookie, { purpose: 'TOGGLE_2FA' });
    const pf1 = await srv.request('POST', '/api/profile/me/2fa', {
      cookie,
      body: { enabled: true, currentPassword: DEFAULT_PW, code: otpEnable },
    });
    assert.equal(pf1.status, 200);
    assert.equal(pf1.body.twoFactorEnabled, true);
    assert.equal(user.two_factor_enabled, true);

    // TC-PF-02: Tắt 2FA thành công -> 200 { twoFactorEnabled: false }
    const { code: otpDisable } = await srv.issueOtpAndCapture(cookie, { purpose: 'TOGGLE_2FA' });
    const pf2 = await srv.request('POST', '/api/profile/me/2fa', {
      cookie,
      body: { enabled: false, currentPassword: DEFAULT_PW, code: otpDisable },
    });
    assert.equal(pf2.status, 200);
    assert.equal(pf2.body.twoFactorEnabled, false);
    assert.equal(user.two_factor_enabled, false);
  } finally {
    await srv.close();
  }
});

// ============================================================================
// 5. Nhóm Hồ sơ cá nhân: TC-PF-05..15 (Đổi SĐT, cập nhật họ tên, đổi/xóa Email, chặn unauth)
// ============================================================================
test('TC-PF-05..15\tAUTO-PF-02: Đổi SĐT (/me/phone), cập nhật họ tên & email (PATCH /me), race condition & chặn chưa đăng nhập', async () => {
  const db = createProfileTestDb();
  const srv = await startTestServer(db);
  try {
    const user = db.seedUser({ phone: '0905555551', email: 'pf05@example.com' });
    const cookie = await srv.loginAs(user);

    // TC-PF-06: Xác nhận đổi SĐT với newPhone sai định dạng -> 422
    const pf6 = await srv.request('POST', '/api/profile/me/phone', {
      cookie,
      body: { newPhone: '123', currentPassword: DEFAULT_PW, code: '123456' },
    });
    assert.equal(pf6.status, 422);
    assert.equal(pf6.body.code, 'VALIDATION_ERROR');

    // Đổi SĐT nhưng sai mật khẩu hiện tại -> 422 INVALID_CURRENT_PASSWORD
    const pfBadPw = await srv.request('POST', '/api/profile/me/phone', {
      cookie,
      body: { newPhone: '0915555552', currentPassword: 'wrong', code: '123456' },
    });
    assert.equal(pfBadPw.status, 422);
    assert.equal(pfBadPw.body.code, 'INVALID_CURRENT_PASSWORD');

    // TC-PF-07: Race condition: Số điện thoại mới bị chiếm ngay trước khi updateOne (E11000) -> 409 PHONE_EXISTS
    const { code: otpRace } = await srv.issueOtpAndCapture(cookie, {
      purpose: 'CHANGE_PHONE',
      newPhone: '0915555559',
    });
    db.triggerDuplicateOnNextUpdate();
    const pf7 = await srv.request('POST', '/api/profile/me/phone', {
      cookie,
      body: { newPhone: '0915555559', currentPassword: DEFAULT_PW, code: otpRace },
    });
    assert.equal(pf7.status, 409);
    assert.equal(pf7.body.code, 'PHONE_EXISTS');

    // TC-PF-05: Đổi số điện thoại thành công -> 200
    const { code: otpPhone } = await srv.issueOtpAndCapture(cookie, {
      purpose: 'CHANGE_PHONE',
      newPhone: '0915555552',
    });
    const pf5 = await srv.request('POST', '/api/profile/me/phone', {
      cookie,
      body: { newPhone: '0915555552', currentPassword: DEFAULT_PW, code: otpPhone },
    });
    assert.equal(pf5.status, 200);
    assert.equal(pf5.body.phone, '0915555552');
    assert.equal(user.phone, '0915555552');

    // TC-PF-08: Cập nhật họ tên hợp lệ (trim khoảng trắng) & từ chối tên quá ngắn
    const pf8Bad = await srv.request('PATCH', '/api/profile/me', {
      cookie,
      body: { fullName: 'A' },
    });
    assert.equal(pf8Bad.status, 422);

    const pf8 = await srv.request('PATCH', '/api/profile/me', {
      cookie,
      body: { fullName: '  Trần Thị B  ' },
    });
    assert.equal(pf8.status, 200);
    assert.equal(pf8.body.fullName, 'Trần Thị B');

    // TC-PF-09: Đổi email thành công (chuẩn hóa chữ thường)
    const pf9 = await srv.request('PATCH', '/api/profile/me', {
      cookie,
      body: { email: '  NewEmail@Example.COM ', currentPassword: DEFAULT_PW },
    });
    assert.equal(pf9.status, 200);
    assert.equal(pf9.body.email, 'newemail@example.com');

    // TC-PF-10: Đổi email nhưng sai mật khẩu hiện tại -> 422 INVALID_CURRENT_PASSWORD
    const pf10 = await srv.request('PATCH', '/api/profile/me', {
      cookie,
      body: { email: 'another@example.com', currentPassword: 'wrong' },
    });
    assert.equal(pf10.status, 422);
    assert.equal(pf10.body.code, 'INVALID_CURRENT_PASSWORD');

    // TC-PF-11: Đổi email sai định dạng -> 422 VALIDATION_ERROR
    const pf11 = await srv.request('PATCH', '/api/profile/me', {
      cookie,
      body: { email: 'not-an-email', currentPassword: DEFAULT_PW },
    });
    assert.equal(pf11.status, 422);
    assert.equal(pf11.body.code, 'VALIDATION_ERROR');

    // TC-PF-12: Đổi sang email đã tồn tại (E11000) -> 409 EMAIL_EXISTS
    const user2 = db.seedUser({ phone: '0906666661', email: 'u2@example.com' });
    const cookie2 = await srv.loginAs(user2);
    db.triggerDuplicateOnNextUpdate();
    const pf12 = await srv.request('PATCH', '/api/profile/me', {
      cookie: cookie2,
      body: { email: 'newemail@example.com', currentPassword: DEFAULT_PW },
    });
    assert.equal(pf12.status, 409);
    assert.equal(pf12.body.code, 'EMAIL_EXISTS');

    // TC-PF-13: Xóa email khỏi tài khoản (truyền chuỗi rỗng "")
    const pf13 = await srv.request('PATCH', '/api/profile/me', {
      cookie: cookie2,
      body: { email: '', currentPassword: DEFAULT_PW },
    });
    assert.equal(pf13.status, 200);
    assert.equal(pf13.body.email, null);

    // TC-PF-14: Gửi PATCH /me với body rỗng {} -> 422 VALIDATION_ERROR
    const pf14 = await srv.request('PATCH', '/api/profile/me', {
      cookie: cookie2,
      body: {},
    });
    assert.equal(pf14.status, 422);
    assert.equal(pf14.body.code, 'VALIDATION_ERROR');

    // TC-PF-15: Chặn toàn bộ 5 route cập nhật hồ sơ khi chưa đăng nhập -> 401
    for (const [m, p] of [
      ['POST', '/api/profile/me/otp'],
      ['POST', '/api/profile/me/password'],
      ['POST', '/api/profile/me/2fa'],
      ['POST', '/api/profile/me/phone'],
      ['PATCH', '/api/profile/me'],
    ]) {
      const rUnauth = await srv.request(m, p, { body: {} });
      assert.equal(rUnauth.status, 401);
      assert.equal(rUnauth.body.code, 'UNAUTHENTICATED');
    }
  } finally {
    await srv.close();
  }
});

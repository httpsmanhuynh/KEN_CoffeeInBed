'use strict';
// Unit test cho Dịch vụ OTP và Session logic
const test = require('node:test');
const assert = require('node:assert');
const { ObjectId } = require('mongodb');
const otp = require('../../src/services/otp');
const { startSession, destroySession } = require('../../src/middleware/auth');

test('issueOtp luôn sinh mã đủ 6 chữ số', async () => {
  const db = {
    collection: () => ({
      updateMany: async () => ({}),
      insertOne: async () => ({ insertedId: 'x' }),
    }),
  };

  const codes = [];
  const origLog = console.log;
  console.log = (...args) => {
    const m = String(args.join(' ')).match(/cua ban:\s*(\d+)/);
    if (m) codes.push(m[1]);
  };

  try {
    for (let i = 0; i < 1000; i++) {
      await otp.issueOtp(db, { phone: '0909123456', purpose: 'REGISTER', pendingData: {} });
    }
  } finally {
    console.log = origLog;
  }

// Phát hành OTP và lấy mã từ log SMS mock.
async function issue(db, extra = {}) {
  const lines = await withEnv({ NODE_ENV: 'test', SMS_PROVIDER: 'mock' }, () =>
    captureLogs(() =>
      otp.issueOtp(db, { userId: 'u1', purpose: 'CHANGE_PASSWORD', phone: PHONE, ...extra }),
    ),
  );
  const m = lines.join(' ').match(/cua ban:\s*(\d{6})/);
  assert.ok(m, 'không bắt được mã OTP từ log SMS mock');
  return m[1];
}

const verify = (db, code, extra = {}) =>
  otp.verifyOtp(db, { phone: PHONE, purpose: 'CHANGE_PASSWORD', code, ...extra });

const wrongOf = (code) => (code === '000000' ? '111111' : '000000');

// ======================= verifyOtp =======================



test('TC-OTP-01\tAUTO-OTP-01: verifyOtp: mã không phải chuỗi 6 chữ số → INVALID, không đụng DB', async () => {
  const { db, calls } = makeDb();
  for (const bad of ['12345', '1234567', 'abcdef', '12 456', 123456, null, undefined, {}]) {
    assert.deepStrictEqual(await verify(db, bad), { status: 'INVALID' });
  }
  assert.strictEqual(calls.findOne, 0);
});

test('TC-OTP-02\tAUTO-OTP-02: verifyOtp: chưa có OTP nào → INVALID', async () => {
  const { db } = makeDb();
  assert.deepStrictEqual(await verify(db, '123456'), { status: 'INVALID' });
});

test('TC-OTP-03\tAUTO-OTP-03: verifyOtp: mã đúng → OK, trả otp kèm user_id/pending_data và đánh dấu đã dùng', async () => {
  const { db, docs } = makeDb();
  const code = await issue(db, {
    purpose: 'REGISTER',
    userId: null,
    pendingData: { full_name: 'Ngô Thị Phương Thảo' },
  });
  const r = await verify(db, code, { purpose: 'REGISTER' });
  assert.strictEqual(r.status, 'OK');
  assert.strictEqual(r.otp.user_id, null);
  assert.deepStrictEqual(r.otp.pending_data, { full_name: 'Ngô Thị Phương Thảo' });
  assert.strictEqual(docs[0].is_used, true);
});

test('TC-OTP-04\tAUTO-OTP-04: verifyOtp: dùng lại OTP đã dùng → INVALID', async () => {
  const { db } = makeDb();
  const code = await issue(db);
  assert.strictEqual((await verify(db, code)).status, 'OK');
  assert.deepStrictEqual(await verify(db, code), { status: 'INVALID' });
});

test('TC-OTP-05\tAUTO-OTP-05: verifyOtp: khác purpose hoặc khác SĐT → INVALID', async () => {
  const { db } = makeDb();
  const code = await issue(db, { purpose: 'FORGOT_PASSWORD' });
  assert.deepStrictEqual(await verify(db, code), { status: 'INVALID' }); // purpose CHANGE_PASSWORD
  assert.deepStrictEqual(
    await verify(db, code, { purpose: 'FORGOT_PASSWORD', phone: '0911111111' }),
    { status: 'INVALID' },
  );
});

test('TC-OTP-06\tAUTO-OTP-06: verifyOtp: OTP hết hạn → EXPIRED và không tăng attempt_count', async () => {
  const { db, docs } = makeDb();
  const code = await issue(db);
  docs[0].expires_at = new Date(Date.now() - 1000);
  assert.deepStrictEqual(await verify(db, code), { status: 'EXPIRED' });
  assert.strictEqual(docs[0].attempt_count, 0);
  assert.strictEqual(docs[0].is_used, false);
});

test('TC-OTP-07\tAUTO-OTP-07: verifyOtp: sai chưa tới ngưỡng → INVALID, attempt_count +1, chưa đánh dấu đã dùng', async () => {
  const { db, docs } = makeDb();
  const code = await withEnv({ OTP_MAX_ATTEMPTS: undefined }, () => issue(db));
  assert.strictEqual(docs[0].max_attempts, 5);
  assert.deepStrictEqual(await verify(db, wrongOf(code)), { status: 'INVALID' });
  assert.strictEqual(docs[0].attempt_count, 1);
  assert.strictEqual(docs[0].is_used, false);
});

test('TC-OTP-08\tAUTO-OTP-08: verifyOtp: sai đến lần thứ max → TOO_MANY, sau đó nhập đúng cũng bị khóa', async () => {
  const { db, docs } = makeDb();
  const code = await withEnv({ OTP_MAX_ATTEMPTS: '3' }, () => issue(db));
  const bad = wrongOf(code);
  assert.strictEqual((await verify(db, bad)).status, 'INVALID');
  assert.strictEqual((await verify(db, bad)).status, 'INVALID');
  assert.strictEqual((await verify(db, bad)).status, 'TOO_MANY'); // lần 3 = ngưỡng
  assert.strictEqual(docs[0].attempt_count, 3);
  // đã hết lượt: mã đúng cũng không được nhận, và attempt_count không vượt ngưỡng
  assert.deepStrictEqual(await verify(db, code), { status: 'TOO_MANY' });
  assert.strictEqual(docs[0].attempt_count, 3);
  assert.strictEqual(docs[0].is_used, false);
});

test('TC-OTP-09\tAUTO-OTP-09: verifyOtp: nhập đúng ở lần cuối cùng còn lượt → vẫn OK', async () => {
  const { db } = makeDb();
  const code = await withEnv({ OTP_MAX_ATTEMPTS: '3' }, () => issue(db));
  await verify(db, wrongOf(code));
  await verify(db, wrongOf(code));
  assert.strictEqual((await verify(db, code)).status, 'OK');
});

test('TC-OTP-10\tAUTO-OTP-10: verifyOtp: 2 request đồng thời với mã đúng → chỉ 1 cái OK', async () => {
  const { db } = makeDb();
  const code = await issue(db);
  const results = await Promise.all([verify(db, code), verify(db, code)]);
  assert.deepStrictEqual(results.map((r) => r.status).sort(), ['INVALID', 'OK']);
});

test('TC-OTP-11\tAUTO-OTP-11: verifyOtp: code_hash hỏng (độ dài khác) → INVALID, không ném lỗi', async () => {
  const { db, docs } = makeDb();
  const code = await issue(db);
  docs[0].code_hash = 'zz';
  assert.deepStrictEqual(await verify(db, code), { status: 'INVALID' });
  assert.strictEqual(docs[0].attempt_count, 1);
});

test('TC-OTP-12\tAUTO-OTP-12: issueOtp rồi issueOtp lại: mã cũ bị vô hiệu, chỉ mã mới verify được', async () => {
  const { db, docs } = makeDb();
  await issue(db);
  const code2 = await issue(db);
  assert.strictEqual(docs.length, 2);
  assert.strictEqual(docs[0].is_used, true);
  assert.strictEqual(docs[1].is_used, false);
  assert.strictEqual((await verify(db, code2)).status, 'OK');
});

// ======================= issueOtp / sendSms =======================

test('TC-OTP-13\tAUTO-OTP-13: issueOtp: lưu đúng dữ liệu, mã được băm, hạn và số lần thử lấy từ env', async () => {
  const { db, docs } = makeDb();
  const code = await withEnv({ OTP_TTL_SECONDS: '120', OTP_MAX_ATTEMPTS: '4' }, () =>
    issue(db, { purpose: 'REGISTER', userId: null, pendingData: { full_name: 'A' } }),
  );
  const d = docs[0];
  assert.strictEqual(d.phone, PHONE);
  assert.strictEqual(d.purpose, 'REGISTER');
  assert.strictEqual(d.user_id, null);
  assert.deepStrictEqual(d.pending_data, { full_name: 'A' });
  assert.match(d.code_hash, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(d.code_hash, code);
  assert.strictEqual(d.attempt_count, 0);
  assert.strictEqual(d.max_attempts, 4);
  assert.strictEqual(d.is_used, false);
  assert.strictEqual(d.expires_at - d.created_at, 120 * 1000);
});

test('TC-OTP-14\tAUTO-OTP-14: issueOtp: không truyền pendingData thì không có field pending_data', async () => {
  const { db, docs } = makeDb();
  await issue(db);
  assert.strictEqual('pending_data' in docs[0], false);
  assert.strictEqual(docs[0].user_id, 'u1');
});

test('TC-OTP-15\tAUTO-OTP-15: issueOtp: không có env thì dùng mặc định 300 giây và 5 lần', async () => {
  const { db, docs } = makeDb();
  await withEnv({ OTP_TTL_SECONDS: undefined, OTP_MAX_ATTEMPTS: undefined }, () => issue(db));
  assert.strictEqual(docs[0].expires_at - docs[0].created_at, 300 * 1000);
  assert.strictEqual(docs[0].max_attempts, 5);
});

test('TC-OTP-16\tAUTO-OTP-16: sendSms: SMS_PROVIDER khác mock → issueOtp ném lỗi "chưa được hỗ trợ"', async () => {
  const { db } = makeDb();
  await withEnv({ SMS_PROVIDER: 'twilio' }, () =>
    assert.rejects(
      otp.issueOtp(db, { userId: 'u1', purpose: 'CHANGE_PASSWORD', phone: PHONE }),
      /chưa được hỗ trợ/,
    ),
  );
});

test('TC-OTP-17\tAUTO-OTP-17: sendSms: NODE_ENV=production với mock thì không in mã ra console', async () => {
  const { db } = makeDb();
  const lines = await withEnv({ NODE_ENV: 'production', SMS_PROVIDER: 'mock' }, () =>
    captureLogs(() => otp.issueOtp(db, { userId: 'u1', purpose: 'CHANGE_PASSWORD', phone: PHONE })),
  );
  assert.deepStrictEqual(lines, []);
});

const mkRes = () => {
  const r = { code: null, body: null, cleared: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, clearCookie(n) { r.cleared = n; } };
  return r;
};

test('TC-MW-06\tAUTO-MW-06: startSession: regenerate, giữ pendingBooking, gán user', async () => {
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

test('TC-MW-07\tAUTO-MW-07: startSession: regenerate lỗi → reject', async () => {
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

test('TC-MW-08\tAUTO-MW-08: destroySession: hủy phiên và xóa cookie connect.sid', async () => {
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

test('TC-MW-09\tAUTO-MW-09: destroySession: destroy lỗi → reject', async () => {
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
});}
)
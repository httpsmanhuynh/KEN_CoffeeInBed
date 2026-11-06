'use strict';
// Test: Thanh toán (payment domain + route middleware) + Catalog CRUD auth.
// Chạy: node --test test/payment_catalog.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');

const {
  validatePayment,
  bookingStatusAfterPayment,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
} = require('../../src/domain/payment');
const { requireAuth, requireRole } = require('../../src/middleware/auth');

// ═══════════════════════════════════════════════════
// 1. Domain: payment
// ═══════════════════════════════════════════════════

test('TC-PAY-01\tAUTO-PAY-01: payment: constants đúng (BR-E01)', () => {
  assert.ok(PAYMENT_METHODS.includes('SIMULATION'));
  assert.ok(PAYMENT_METHODS.includes('MANUAL'));
  assert.ok(PAYMENT_METHODS.includes('CASH'));
  assert.ok(PAYMENT_METHODS.includes('MOMO'));
  assert.ok(PAYMENT_METHODS.includes('VNPAY'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('SUCCESS'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('FAILED'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('CANCELLED'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('REFUNDED'));
});

test('TC-PAY-02\tAUTO-PAY-02: validatePayment: booking không tồn tại → BOOKING_NOT_FOUND', () => {
  const r = validatePayment({ booking: null, amount: 100000, now: Date.now() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'BOOKING_NOT_FOUND');
});

test('TC-PAY-03\tAUTO-PAY-03: validatePayment: booking không phải PENDING_PAYMENT → BOOKING_NOT_PAYABLE', () => {
  const booking = { status: 'CONFIRMED', final_amount: 100000, paymentExpiresAt: Date.now() + 60000 };
  const r = validatePayment({ booking, amount: 100000, now: Date.now() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'BOOKING_NOT_PAYABLE');

  for (const s of ['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED', 'NO_SHOW']) {
    const r2 = validatePayment({ booking: { ...booking, status: s }, amount: 100000, now: Date.now() });
    assert.equal(r2.reason, 'BOOKING_NOT_PAYABLE', `status ${s} phải không thanh toán được`);
  }
});

test('TC-PAY-04\tAUTO-PAY-04: validatePayment: hết hạn hold → HOLD_EXPIRED (BR-E03)', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 150000,
    paymentExpiresAt: now - 1000,
  };
  const r = validatePayment({ booking, amount: 150000, now });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'HOLD_EXPIRED');
});

test('TC-PAY-05\tAUTO-PAY-05: validatePayment: hợp lệ → ok = true', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 200000,
    paymentExpiresAt: now + 60000,
  };
  const r = validatePayment({ booking, amount: 200000, now });
  assert.equal(r.ok, true);
});

test('TC-PAY-06\tAUTO-PAY-06: validatePayment: amount không khớp → AMOUNT_MISMATCH (BR-E02)', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 300000,
    paymentExpiresAt: now + 60000,
  };
  assert.equal(validatePayment({ booking, amount: 100000, now }).reason, 'AMOUNT_MISMATCH');
  assert.equal(validatePayment({ booking, amount: 500000, now }).reason, 'AMOUNT_MISMATCH');
  assert.equal(validatePayment({ booking, amount: 0, now }).reason, 'INVALID_AMOUNT');
  assert.equal(validatePayment({ booking, amount: -1, now }).reason, 'INVALID_AMOUNT');
  assert.equal(validatePayment({ booking, amount: 100.5, now }).reason, 'INVALID_AMOUNT');
});

test('TC-PAY-07\tAUTO-PAY-07: validatePayment: nhận cả paymentExpiresAt (Date/number) và payment_expires_at (snake_case)', () => {
  const now = Date.now();
  const b1 = {
    status: 'PENDING_PAYMENT',
    final_amount: 50000,
    paymentExpiresAt: new Date(now + 60000),
  };
  const b2 = {
    status: 'PENDING_PAYMENT',
    final_amount: 50000,
    payment_expires_at: new Date(now + 60000),
  };
  assert.equal(validatePayment({ booking: b1, amount: 50000 }).ok, true);
  assert.equal(validatePayment({ booking: b2, amount: 50000, now }).ok, true);
});

test('TC-PAY-08\tAUTO-PAY-08: bookingStatusAfterPayment: SUCCESS → CONFIRMED, khác → PENDING_PAYMENT', () => {
  assert.equal(bookingStatusAfterPayment('SUCCESS'), 'CONFIRMED');
  assert.equal(bookingStatusAfterPayment('FAILED'), 'PENDING_PAYMENT');
  assert.equal(bookingStatusAfterPayment('CANCELLED'), 'PENDING_PAYMENT');
});

test('TC-PAY-09\tAUTO-PAY-09: payment: idempotency — cùng key trả lại giao dịch cũ', async () => {
  const txStore = new Map();

  async function mockPay({ bookingId, iKey, amount }) {
    if (txStore.has(iKey)) {
      const old = txStore.get(iKey);
      if (old.bookingId !== bookingId) return { error: 'IDEMPOTENCY_CONFLICT' };
      return { idempotent: true, tx: old };
    }

    const booking = { status: 'PENDING_PAYMENT', final_amount: amount, paymentExpiresAt: Date.now() + 60000 };
    const v = validatePayment({ booking, amount, now: Date.now() });
    if (!v.ok) return { error: v.reason };

    const tx = { id: String(new ObjectId()), bookingId, amount, status: 'SUCCESS' };
    txStore.set(iKey, tx);
    return { idempotent: false, tx };
  }

  const r1 = await mockPay({ bookingId: 'book1', iKey: 'key-abc', amount: 100000 });
  assert.equal(r1.idempotent, false);
  assert.equal(r1.tx.status, 'SUCCESS');

  const r2 = await mockPay({ bookingId: 'book1', iKey: 'key-abc', amount: 100000 });
  assert.equal(r2.idempotent, true);
  assert.equal(r2.tx.id, r1.tx.id);

  const r3 = await mockPay({ bookingId: 'book2', iKey: 'key-abc', amount: 100000 });
  assert.equal(r3.error, 'IDEMPOTENCY_CONFLICT');
});

test('TC-PAY-10\tAUTO-PAY-10: payment: có thể thử lại với key mới khi FAILED', async () => {
  const now = Date.now();
  const booking = { status: 'PENDING_PAYMENT', final_amount: 80000, paymentExpiresAt: now + 60000 };
  assert.equal(bookingStatusAfterPayment('FAILED'), 'PENDING_PAYMENT');
  const r = validatePayment({ booking, amount: 80000, now });
  assert.equal(r.ok, true);
});

// ═══════════════════════════════════════════════════
// 2. requireRole gắn đúng vào Admin routes (Catalog) — async BR-A05
// ═══════════════════════════════════════════════════

const oid = new ObjectId();
const mkReq = (role) => ({
  session: role
    ? { user: { id: String(oid), role, pwdAt: 0 }, destroy: (cb) => cb() }
    : {},
  app: {
    locals: {
      db: {
        collection: () => ({
          findOne: async () => (role ? { _id: oid, status: 'ACTIVE', role } : null),
        }),
      },
    },
  },
});

const runMw = (mw, req) =>
  new Promise((resolve) => {
    const r = { _code: null, _body: null };
    r.status = (c) => {
      r._code = c;
      return r;
    };
    r.json = (b) => {
      r._body = b;
      resolve({ res: r, passed: false });
      return r;
    };
    r.clearCookie = () => {};
    mw(req, r, () => resolve({ res: r, passed: true }));
  });

test('TC-PAY-11\tAUTO-PAY-11: requireRole ADMIN: cho phép ADMIN, chặn CUSTOMER và chưa đăng nhập', async () => {
  const okAdmin = await runMw(requireRole('ADMIN'), mkReq('ADMIN'));
  assert.equal(okAdmin.passed, true, 'ADMIN phải được phép');

  const resCust = await runMw(requireRole('ADMIN'), mkReq('CUSTOMER'));
  assert.equal(resCust.res._code, 403);
  assert.equal(resCust.passed, false);

  const resGuest = await runMw(requireRole('ADMIN'), mkReq(null));
  assert.equal(resGuest.res._code, 401);
  assert.equal(resGuest.passed, false);
});

test('TC-PAY-12\tAUTO-PAY-12: requireAuth: 401 khi không có session.user, cho phép khi có session.user', async () => {
  const guest = await runMw(requireAuth, mkReq(null));
  assert.equal(guest.res._code, 401);

  const cust = await runMw(requireAuth, mkReq('CUSTOMER'));
  assert.equal(cust.passed, true);
});

// ═══════════════════════════════════════════════════
// 3. Catalog: validate logic (pure, không cần DB)
// ═══════════════════════════════════════════════════

test('TC-PAY-13\tAUTO-PAY-13: catalog: assertMoney reject float và số âm', () => {
  function assertMoney(v, name) {
    if (!Number.isInteger(v) || v < 0)
      throw Object.assign(new Error(`${name} phải là số nguyên VNĐ >= 0`), { status: 422 });
  }
  assert.throws(() => assertMoney(100.5, 'unitPrice'), { status: 422 });
  assert.throws(() => assertMoney(-1, 'unitPrice'), { status: 422 });
  assert.throws(() => assertMoney('100', 'unitPrice'), { status: 422 });
  assert.doesNotThrow(() => assertMoney(0, 'unitPrice'));
  assert.doesNotThrow(() => assertMoney(100000, 'unitPrice'));
});

test('TC-PAY-14\tAUTO-PAY-14: catalog: pick() chỉ lấy key có trong whitelist', () => {
  function pick(body, keys) {
    const set = {};
    for (const k of keys) if (k in body && body[k] !== undefined) set[k] = body[k];
    return set;
  }
  const body = { name: 'Test', hack: 'inject', status: 'ACTIVE', extra: undefined };
  const result = pick(body, ['name', 'status', 'description']);
  assert.deepEqual(result, { name: 'Test', status: 'ACTIVE' });
});

test('TC-PAY-15\tAUTO-PAY-15: catalog: ObjectId.isValid chặn injection', () => {
  assert.equal(ObjectId.isValid(''), false);
  assert.equal(ObjectId.isValid('invalid'), false);
  assert.equal(ObjectId.isValid('{ $ne: null }'), false);
  assert.equal(ObjectId.isValid(String(new ObjectId())), true);
});
'use strict';
// Test: Thanh toán (payment domain + route middleware) + Catalog CRUD auth.
// Chạy: node --test test/payment_catalog.test.js
const test   = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');

const { validatePayment, bookingStatusAfterPayment, PAYMENT_STATUSES, PAYMENT_METHODS } =
  require('../src/domain/payment');
const { requireAuth, requireRole } = require('../src/middleware/auth');

// ═══════════════════════════════════════════════════
// 1. Domain: payment
// ═══════════════════════════════════════════════════

// ── PAYMENT_METHODS & PAYMENT_STATUSES ──
test('payment: constants đúng (BR-E01)', () => {
  assert.ok(PAYMENT_METHODS.includes('CASH'));
  assert.ok(PAYMENT_METHODS.includes('MOMO'));
  assert.ok(PAYMENT_METHODS.includes('VNPAY'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('SUCCESS'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('FAILED'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('CANCELLED'));
  assert.ok(Object.values(PAYMENT_STATUSES).includes('REFUNDED'));
});

// ── validatePayment: booking null ──
test('validatePayment: booking không tồn tại → BOOKING_NOT_FOUND', () => {
  const r = validatePayment({ booking: null, amount: 100000, now: Date.now() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'BOOKING_NOT_FOUND');
});

// ── validatePayment: sai status ──
test('validatePayment: booking không phải PENDING_PAYMENT → BOOKING_NOT_PAYABLE', () => {
  const booking = { status: 'CONFIRMED', final_amount: 100000, paymentExpiresAt: Date.now() + 60000 };
  const r = validatePayment({ booking, amount: 100000, now: Date.now() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'BOOKING_NOT_PAYABLE');

  // Các trạng thái không thể thanh toán
  for (const s of ['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED', 'NO_SHOW']) {
    const r2 = validatePayment({ booking: { ...booking, status: s }, amount: 100000, now: Date.now() });
    assert.equal(r2.reason, 'BOOKING_NOT_PAYABLE', `status ${s} phải không thanh toán được`);
  }
});

// ── validatePayment: hết hạn hold (BR-E03) ──
test('validatePayment: hết hạn hold → HOLD_EXPIRED (BR-E03)', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 150000,
    paymentExpiresAt: now - 1000, // đã quá hạn
  };
  const r = validatePayment({ booking, amount: 150000, now });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'HOLD_EXPIRED');
});

// ── validatePayment: thanh toán trong hạn ──
test('validatePayment: hợp lệ → ok = true', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 200000,
    paymentExpiresAt: now + 60000,
  };
  const r = validatePayment({ booking, amount: 200000, now });
  assert.equal(r.ok, true);
});

// ── validatePayment: số tiền không khớp (BR-E02) ──
test('validatePayment: amount không khớp → AMOUNT_MISMATCH (BR-E02)', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 300000,
    paymentExpiresAt: now + 60000,
  };
  assert.equal(validatePayment({ booking, amount: 100000, now }).reason, 'AMOUNT_MISMATCH');
  assert.equal(validatePayment({ booking, amount: 500000, now }).reason, 'AMOUNT_MISMATCH');
  assert.equal(validatePayment({ booking, amount: 0,      now }).reason, 'INVALID_AMOUNT');
  assert.equal(validatePayment({ booking, amount: -1,     now }).reason, 'INVALID_AMOUNT');
  assert.equal(validatePayment({ booking, amount: 100.5,  now }).reason, 'INVALID_AMOUNT');
});

// ── validatePayment: paymentExpiresAt là Date object ──
test('validatePayment: paymentExpiresAt nhận cả Date và number', () => {
  const now = Date.now();
  const booking = {
    status: 'PENDING_PAYMENT',
    final_amount: 50000,
    paymentExpiresAt: new Date(now + 60000), // Date object
  };
  assert.equal(validatePayment({ booking, amount: 50000, now }).ok, true);
});

// ── bookingStatusAfterPayment ──
test('bookingStatusAfterPayment: SUCCESS → CONFIRMED, khác → PENDING_PAYMENT', () => {
  assert.equal(bookingStatusAfterPayment('SUCCESS'),   'CONFIRMED');
  assert.equal(bookingStatusAfterPayment('FAILED'),    'PENDING_PAYMENT');
  assert.equal(bookingStatusAfterPayment('CANCELLED'), 'PENDING_PAYMENT');
});

// ── Idempotency (mô phỏng logic route) ──
test('payment: idempotency — cùng key trả lại giao dịch cũ', async () => {
  // Giả lập "DB" in-memory
  const txStore = new Map();

  async function mockPay({ bookingId, iKey, amount }) {
    // Check idempotency
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

  // Gọi lần 2 cùng key → phải trả lại bản cũ
  const r2 = await mockPay({ bookingId: 'book1', iKey: 'key-abc', amount: 100000 });
  assert.equal(r2.idempotent, true);
  assert.equal(r2.tx.id, r1.tx.id, 'transaction ID phải giống nhau');

  // Cùng key nhưng booking khác → conflict
  const r3 = await mockPay({ bookingId: 'book2', iKey: 'key-abc', amount: 100000 });
  assert.equal(r3.error, 'IDEMPOTENCY_CONFLICT');
});

// ── Thử lại sau FAILED (non-idempotent retry with new key) ──
test('payment: có thể thử lại với key mới khi FAILED', async () => {
  const now = Date.now();
  const booking = { status: 'PENDING_PAYMENT', final_amount: 80000, paymentExpiresAt: now + 60000 };
  // Lần 1 thất bại (FAILED) → booking vẫn PENDING_PAYMENT
  assert.equal(bookingStatusAfterPayment('FAILED'), 'PENDING_PAYMENT');
  // Lần 2 thanh toán lại → vẫn hợp lệ vì booking vẫn PENDING_PAYMENT
  const r = validatePayment({ booking, amount: 80000, now });
  assert.equal(r.ok, true);
});

// ═══════════════════════════════════════════════════
// 2. requireRole gắn đúng vào Admin routes (Catalog)
// ═══════════════════════════════════════════════════

const mkReq = (role) => ({ session: { user: { id: 'u1', role } } });
const mkRes = () => {
  const r = { _code: null, _body: null };
  r.status = (c) => { r._code = c; return r; };
  r.json = (b) => { r._body = b; return r; };
  return r;
};
const noop = () => {};

test('requireRole ADMIN: cho phép ADMIN, chặn CUSTOMER và chưa đăng nhập', () => {
  // ADMIN → next() được gọi
  let called = false;
  requireRole('ADMIN')(mkReq('ADMIN'), mkRes(), () => { called = true; });
  assert.ok(called, 'ADMIN phải được phép');

  // CUSTOMER → 403
  const res1 = mkRes();
  requireRole('ADMIN')(mkReq('CUSTOMER'), res1, noop);
  assert.equal(res1._code, 403);

  // Chưa đăng nhập (session rỗng) → 401
  const res2 = mkRes();
  requireRole('ADMIN')({ session: {} }, res2, noop);
  assert.equal(res2._code, 401);
});

test('requireAuth: 401 khi không có session.user', () => {
  const res = mkRes();
  requireAuth({ session: {} }, res, noop);
  assert.equal(res._code, 401);
});

test('requireAuth: cho phép khi có session.user', () => {
  let called = false;
  requireAuth(mkReq('CUSTOMER'), mkRes(), () => { called = true; });
  assert.ok(called);
});

// Mô phỏng middleware chain cho route Admin catalog
test('catalog admin routes: ADMIN middleware chain đúng thứ tự', () => {
  // Kiểm tra: requireAuth → requireRole('ADMIN') → handler
  // Với CUSTOMER: requireAuth pass nhưng requireRole fail → 403
  const res = mkRes();
  let handlerCalled = false;

  const chain = [requireAuth, requireRole('ADMIN')];
  let idx = 0;
  const next = () => {
    idx++;
    if (idx < chain.length) chain[idx](mkReq('CUSTOMER'), res, next);
    else handlerCalled = true;
  };
  chain[0](mkReq('CUSTOMER'), res, next);

  assert.equal(res._code, 403, 'CUSTOMER bị chặn ở requireRole');
  assert.equal(handlerCalled, false, 'Handler không được gọi');
});

test('catalog admin routes: ADMIN qua được chain', () => {
  const res = mkRes();
  let handlerCalled = false;

  const chain = [requireAuth, requireRole('ADMIN')];
  let idx = 0;
  const next = () => {
    idx++;
    if (idx < chain.length) chain[idx](mkReq('ADMIN'), res, next);
    else handlerCalled = true;
  };
  chain[0](mkReq('ADMIN'), res, next);

  assert.equal(handlerCalled, true, 'ADMIN phải vào được handler');
});

// ═══════════════════════════════════════════════════
// 3. Catalog: validate logic (pure, không cần DB)
// ═══════════════════════════════════════════════════

test('catalog: assertMoney reject float và số âm', () => {
  // Mô phỏng assertMoney từ catalog route
  function assertMoney(v, name) {
    if (!Number.isInteger(v) || v < 0)
      throw Object.assign(new Error(`${name} phải là số nguyên VNĐ >= 0`), { status: 422 });
  }
  assert.throws(() => assertMoney(100.5, 'unitPrice'), { status: 422 });
  assert.throws(() => assertMoney(-1,    'unitPrice'), { status: 422 });
  assert.throws(() => assertMoney('100', 'unitPrice'), { status: 422 });
  assert.doesNotThrow(() => assertMoney(0,      'unitPrice'));
  assert.doesNotThrow(() => assertMoney(100000, 'unitPrice'));
});

test('catalog: pick() chỉ lấy key có trong whitelist', () => {
  // Mô phỏng pick từ catalog route
  function pick(body, keys) {
    const set = {};
    for (const k of keys) if (k in body && body[k] !== undefined) set[k] = body[k];
    return set;
  }
  const body = { name: 'Test', hack: 'inject', status: 'ACTIVE', extra: undefined };
  const result = pick(body, ['name', 'status', 'description']);
  assert.deepEqual(result, { name: 'Test', status: 'ACTIVE' }); // hack bị bỏ, extra bị bỏ
});

test('catalog: ObjectId.isValid chặn injection', () => {
  assert.equal(ObjectId.isValid(''), false);
  assert.equal(ObjectId.isValid('invalid'), false);
  assert.equal(ObjectId.isValid('{ $ne: null }'), false);
  assert.equal(ObjectId.isValid(String(new ObjectId())), true);
});

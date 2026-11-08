'use strict';
// Booking & Thanh toán (mục 3.6, 3.7). Chạy: npm run test:payment
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const api = require('../helpers/paymentApi');
const { call, callback } = api;

before(() => api.start());
after(() => api.stop());

const newBooking = async (as = 'customer', body = { packageId: 'pkg-basic' }) => {
  const r = await call('POST', '/api/bookings', { as, body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.data;
};
const pay = (bookingId, extra = {}, { as = 'customer', key } = {}) =>
  call('POST', '/api/payments', { as, body: { bookingId, method: 'VNPAY', ...extra }, headers: key ? { 'Idempotency-Key': key } : {} });
const getBooking = async (id) => (await call('GET', `/api/bookings/${id}`, { as: 'admin' })).data;

describe('1. Tính tiền phía server (NFR-03 Never Trust the Client)', () => {
  test('TC-PAY-001: tổng = giá Package + Add-on × số lượng', async () => {
    const b = await newBooking('customer', { packageId: 'pkg-pro', addons: [{ id: 'cafe', qty: 2 }, { id: 'banh', qty: 1 }] });
    assert.equal(b.total, 800000 + 60000 + 25000);
  });
  test('TC-PAY-002: client gửi total giả (1đ) bị bỏ qua', async () => {
    const b = await newBooking('customer', { packageId: 'pkg-basic', total: 1, amount: 1 });
    assert.equal(b.total, 500000);
  });
  test('TC-PAY-003: số lượng Add-on âm/0/thập phân => 422', async () => {
    for (const qty of [-1, 0, 1.5]) {
      const r = await call('POST', '/api/bookings', { as: 'customer', body: { packageId: 'pkg-basic', addons: [{ id: 'cafe', qty }] } });
      assert.equal(r.status, 422, `qty=${qty}`);
    }
  });
  test('TC-PAY-004: Package/Add-on không tồn tại => 422', async () => {
    assert.equal((await call('POST', '/api/bookings', { as: 'customer', body: { packageId: 'x' } })).status, 422);
    assert.equal((await call('POST', '/api/bookings', { as: 'customer', body: { packageId: 'pkg-basic', addons: [{ id: 'zzz', qty: 1 }] } })).status, 422);
  });
  test('TC-PAY-005: số tiền thanh toán lấy từ booking, không theo amount client gửi', async () => {
    const b = await newBooking();
    const r = await pay(b.id, { amount: 1 });
    assert.equal(r.status, 201);
    assert.equal(r.data.amount, 500000);
  });
});

describe('2. Khởi tạo thanh toán & phân quyền', () => {
  test('TC-PAY-006: Guest tạo thanh toán => 401', async () => {
    const b = await newBooking();
    assert.equal((await pay(b.id, {}, { as: 'guest' })).status, 401);
  });
  test('TC-PAY-007: thanh toán booking của người khác => 403', async () => {
    const b = await newBooking('customer');
    assert.equal((await pay(b.id, {}, { as: 'customer2' })).status, 403);
  });
  test('TC-PAY-008: booking không tồn tại => 404', async () => {
    assert.equal((await pay('khong-co')).status, 404);
  });
  test('TC-PAY-009: phương thức không hợp lệ => 422', async () => {
    const b = await newBooking();
    assert.equal((await pay(b.id, { method: 'BITCOIN' })).status, 422);
    assert.equal((await pay(b.id, { method: undefined })).status, 422);
  });
  test('TC-PAY-010: tạo thành công => 201, PENDING, có paymentUrl, booking vẫn PENDING', async () => {
    const b = await newBooking();
    const r = await pay(b.id, { method: 'MOMO' });
    assert.equal(r.status, 201);
    assert.equal(r.data.status, 'PENDING');
    assert.ok(r.data.paymentUrl);
    assert.equal((await getBooking(b.id)).status, 'PENDING');
  });
  test('TC-PAY-011: chỉ chủ booking hoặc Admin xem được giao dịch', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'customer' })).status, 200);
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'admin' })).status, 200);
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'customer2' })).status, 403);
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'guest' })).status, 401);
  });
});

describe('3. Webhook cổng thanh toán', () => {
  test('TC-PAY-012: SUCCESS hợp lệ => Payment PAID, Booking CONFIRMED + PAID', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    const r = await callback(p.id, { result: 'SUCCESS', amount: p.amount });
    assert.equal(r.status, 200);
    const bk = await getBooking(b.id);
    assert.equal(bk.status, 'CONFIRMED');
    assert.equal(bk.paymentStatus, 'PAID');
  });
  test('TC-PAY-013: chữ ký sai => 401, không đổi trạng thái', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    const r = await callback(p.id, { result: 'SUCCESS', amount: p.amount }, { signature: 'deadbeef' });
    assert.equal(r.status, 401);
    assert.equal((await getBooking(b.id)).status, 'PENDING');
  });
  test('TC-PAY-014: thiếu chữ ký => 401', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    const r = await call('POST', `/api/payments/${p.id}/callback`, { body: { result: 'SUCCESS', amount: p.amount } });
    assert.equal(r.status, 401);
  });
  test('TC-PAY-015: số tiền callback sai => 422, booking không được xác nhận', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    const r = await callback(p.id, { result: 'SUCCESS', amount: 1000 });
    assert.equal(r.status, 422);
    assert.equal((await getBooking(b.id)).paymentStatus, 'UNPAID');
  });
  test('TC-PAY-016: callback SUCCESS lặp lại là idempotent (không xử lý hai lần)', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    const body = { result: 'SUCCESS', amount: p.amount };
    assert.equal((await callback(p.id, body)).status, 200);
    const again = await callback(p.id, body);
    assert.equal(again.status, 200);
    assert.equal((await getBooking(b.id)).status, 'CONFIRMED');
  });
  test('TC-PAY-017: FAILED => Payment FAILED, booking giữ PENDING', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    assert.equal((await callback(p.id, { result: 'FAILED' })).status, 200);
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'customer' })).data.status, 'FAILED');
    assert.equal((await getBooking(b.id)).status, 'PENDING');
  });
  test('TC-PAY-018: callback FAILED đến muộn sau khi đã PAID => 409, vẫn PAID', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    await callback(p.id, { result: 'SUCCESS', amount: p.amount });
    assert.equal((await callback(p.id, { result: 'FAILED' })).status, 409);
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'admin' })).data.status, 'PAID');
  });
  test('TC-PAY-019: SUCCESS sau FAILED => 409 (không "sống lại" giao dịch lỗi)', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    await callback(p.id, { result: 'FAILED' });
    assert.equal((await callback(p.id, { result: 'SUCCESS', amount: p.amount })).status, 409);
  });
  test('TC-PAY-020: kết quả lạ / payment không tồn tại', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    assert.equal((await callback(p.id, { result: 'MAYBE' })).status, 422);
    assert.equal((await callback('khong-co', { result: 'FAILED' })).status, 404);
  });
});

describe('4. Chống thanh toán trùng / race condition', () => {
  test('TC-PAY-021: booking đã PAID không thanh toán lại => 409', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    await callback(p.id, { result: 'SUCCESS', amount: p.amount });
    assert.equal((await pay(b.id)).status, 409);
  });
  test('TC-PAY-022: đang có giao dịch PENDING, tạo thêm không key => 409', async () => {
    const b = await newBooking();
    assert.equal((await pay(b.id)).status, 201);
    assert.equal((await pay(b.id)).status, 409);
  });
  test('TC-PAY-023: cùng Idempotency-Key => trả lại cùng giao dịch, không tạo mới', async () => {
    const b = await newBooking();
    const key = `k-${api.uid()}`;
    const a = await pay(b.id, {}, { key });
    const c = await pay(b.id, {}, { key });
    assert.equal(a.status, 201);
    assert.equal(c.status, 200);
    assert.equal(c.data.id, a.data.id);
  });
  test('TC-PAY-024: 5 request song song => đúng 1 giao dịch được tạo', async () => {
    const b = await newBooking();
    const rs = await Promise.all(Array.from({ length: 5 }, () => pay(b.id)));
    assert.equal(rs.filter((r) => r.status === 201).length, 1);
    assert.ok(rs.every((r) => [201, 409].includes(r.status)));
  });
  test('TC-PAY-025: thanh toán lỗi xong được thử lại với giao dịch mới', async () => {
    const b = await newBooking();
    const p1 = (await pay(b.id)).data;
    await callback(p1.id, { result: 'FAILED' });
    const p2 = await pay(b.id);
    assert.equal(p2.status, 201);
    assert.notEqual(p2.data.id, p1.id);
    await callback(p2.data.id, { result: 'SUCCESS', amount: p2.data.amount });
    assert.equal((await getBooking(b.id)).status, 'CONFIRMED');
  });
  test('TC-PAY-026: 5 callback SUCCESS song song => vẫn chỉ 1 lần xác nhận, kết quả nhất quán', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    const rs = await Promise.all(Array.from({ length: 5 }, () => callback(p.id, { result: 'SUCCESS', amount: p.amount })));
    assert.ok(rs.every((r) => r.status === 200));
    assert.equal((await getBooking(b.id)).status, 'CONFIRMED');
  });
});

describe('5. Hết hạn giữ chỗ', () => {
  test('TC-PAY-027: booking hết hạn không được thanh toán => 409', async (t) => {
    if (!api.server) return t.skip('Chỉ chạy với mock (cần ép hết hạn); backend thật: chờ hết thời gian giữ chỗ');
    const b = await newBooking();
    await api.expire(b.id);
    assert.equal((await pay(b.id)).status, 409);
    assert.equal((await getBooking(b.id)).status, 'EXPIRED');
  });
});

describe('6. Hoàn tiền (Admin)', () => {
  test('TC-PAY-028: Admin hoàn tiền giao dịch PAID => REFUNDED, booking CANCELLED', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    await callback(p.id, { result: 'SUCCESS', amount: p.amount });
    const r = await call('POST', `/api/payments/${p.id}/refund`, { as: 'admin' });
    assert.equal(r.status, 200);
    assert.equal(r.data.status, 'REFUNDED');
    assert.equal((await getBooking(b.id)).status, 'CANCELLED');
  });
  test('TC-PAY-029: Customer/Guest không được hoàn tiền (403/401)', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    await callback(p.id, { result: 'SUCCESS', amount: p.amount });
    assert.equal((await call('POST', `/api/payments/${p.id}/refund`, { as: 'customer' })).status, 403);
    assert.equal((await call('POST', `/api/payments/${p.id}/refund`)).status, 401);
    assert.equal((await call('GET', `/api/payments/${p.id}`, { as: 'admin' })).data.status, 'PAID');
  });
  test('TC-PAY-030: không hoàn tiền giao dịch chưa thanh toán, và không hoàn hai lần', async () => {
    const b = await newBooking();
    const p = (await pay(b.id)).data;
    assert.equal((await call('POST', `/api/payments/${p.id}/refund`, { as: 'admin' })).status, 409);
    await callback(p.id, { result: 'SUCCESS', amount: p.amount });
    assert.equal((await call('POST', `/api/payments/${p.id}/refund`, { as: 'admin' })).status, 200);
    assert.equal((await call('POST', `/api/payments/${p.id}/refund`, { as: 'admin' })).status, 409);
  });
});

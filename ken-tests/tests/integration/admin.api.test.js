'use strict';
// Admin Management & Dashboard (mục 3.11, 4.2). Chạy: npm run test:admin
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const api = require('../helpers/adminApi');
const { call } = api;

before(() => api.start());
after(() => api.stop());

const mk = async (as, total) => {
  const r = await call('POST', '/api/bookings', { as, body: { total } });
  assert.equal(r.status, 201);
  return r.data;
};
const setStatus = (id, status, as = 'admin', extra = {}) => call('PATCH', `/api/admin/bookings/${id}/status`, { as, body: { status, ...extra } });

describe('1. Đăng nhập Admin', () => {
  test('TC-ADM-001: đăng nhập đúng => 200, có token, role ADMIN, không lộ mật khẩu', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'admin@ken.vn', password: 'Admin@123' } });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.user.role, 'ADMIN');
    assert.equal(JSON.stringify(r.body).includes('Admin@123'), false);
    assert.equal(r.body.user.password, undefined);
  });
  test('TC-ADM-002: sai mật khẩu => 401', async () => {
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@ken.vn', password: 'sai' } })).status, 401);
  });
  test('TC-ADM-003: thiếu mật khẩu => 422', async () => {
    assert.equal((await call('POST', '/api/auth/login', { body: { email: 'admin@ken.vn' } })).status, 422);
  });
  test('TC-ADM-004: tài khoản bị khóa => 403, không cấp token', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'khoa@ken.vn', password: 'Lock@123' } });
    assert.equal(r.status, 403);
    assert.equal(r.body.token, undefined);
  });
  test('TC-ADM-005: đăng nhập Customer => role CUSTOMER (không phải ADMIN)', async () => {
    const r = await call('POST', '/api/auth/login', { body: { email: 'an@ken.vn', password: 'Cust@123' } });
    assert.equal(r.body.user.role, 'CUSTOMER');
  });
});

describe('2. Phân quyền từng chức năng quản trị (BR-A04, BR-A05)', () => {
  const endpoints = [
    ['GET', '/api/admin/bookings'],
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/bookings/abc'],
    ['PATCH', '/api/admin/bookings/abc/status'],
    ['GET', '/api/admin/customers/u-an'],
  ];
  for (const [m, path] of endpoints) {
    test(`TC-ADM-006: Guest ${m} ${path} => 401`, async () => {
      assert.equal((await call(m, path, { body: m === 'PATCH' ? { status: 'CONFIRMED' } : undefined })).status, 401);
    });
    test(`TC-ADM-007: Customer ${m} ${path} => 403`, async () => {
      assert.equal((await call(m, path, { as: 'customer', body: m === 'PATCH' ? { status: 'CONFIRMED' } : undefined })).status, 403);
    });
  }
  test('TC-ADM-008: Customer không đổi được trạng thái; dữ liệu giữ nguyên', async () => {
    const b = await mk('customer', 100000);
    assert.equal((await setStatus(b.id, 'CANCELLED', 'customer')).status, 403);
    assert.equal((await call('GET', `/api/admin/bookings/${b.id}`, { as: 'admin' })).data.status, 'PENDING');
  });
});

describe('3. Danh sách, tìm kiếm, lọc', () => {
  test('TC-ADM-009: Admin xem được booking của nhiều khách, kèm thông tin khách', async () => {
    const a = await mk('customer', 100000);
    const b = await mk('customer2', 200000);
    const r = await call('GET', '/api/admin/bookings', { as: 'admin' });
    assert.equal(r.status, 200);
    const ids = r.data.map((x) => x.id);
    assert.ok(ids.includes(a.id) && ids.includes(b.id));
    assert.equal(r.data.find((x) => x.id === a.id).customer.name, 'Nguyễn Văn An');
  });
  test('TC-ADM-010: lọc theo status chỉ trả đúng status đó', async () => {
    const b = await mk('customer', 100000);
    await setStatus(b.id, 'CONFIRMED');
    const r = await call('GET', '/api/admin/bookings?status=CONFIRMED', { as: 'admin' });
    assert.ok(r.data.length >= 1);
    assert.ok(r.data.every((x) => x.status === 'CONFIRMED'));
    assert.ok(r.data.some((x) => x.id === b.id));
  });
  test('TC-ADM-011: tìm theo tên khách (không phân biệt hoa/thường)', async () => {
    await mk('customer2', 50000);
    const r = await call('GET', '/api/admin/bookings?q=trần thị bình', { as: 'admin' });
    assert.ok(r.data.length >= 1);
    assert.ok(r.data.every((x) => x.customer.name === 'Trần Thị Bình'));
  });
  test('TC-ADM-012: tìm không có kết quả => danh sách rỗng (không lỗi)', async () => {
    const r = await call('GET', '/api/admin/bookings?q=khong-ton-tai-xyz', { as: 'admin' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, []);
  });
  test('TC-ADM-013: status lọc không hợp lệ => 422', async () => {
    assert.equal((await call('GET', '/api/admin/bookings?status=ABC', { as: 'admin' })).status, 422);
  });
  test('TC-ADM-014: kết quả lọc là tập con của danh sách đầy đủ', async () => {
    const all = (await call('GET', '/api/admin/bookings', { as: 'admin' })).data.map((x) => x.id);
    const sub = (await call('GET', '/api/admin/bookings?status=PENDING', { as: 'admin' })).data;
    assert.ok(sub.every((x) => all.includes(x.id)));
  });
  test('TC-ADM-015: chi tiết booking/khách không lộ trường nhạy cảm', async () => {
    const b = await mk('customer', 100000);
    const raw = JSON.stringify((await call('GET', `/api/admin/bookings/${b.id}`, { as: 'admin' })).body);
    for (const k of ['password', 'passwordHash', 'otp']) assert.equal(raw.includes(k), false, `Lộ ${k}`);
    assert.equal((await call('GET', '/api/admin/bookings/khong-co', { as: 'admin' })).status, 404);
  });
  test('TC-ADM-016: Admin xem thông tin khách (kèm số booking)', async () => {
    await mk('customer', 100000);
    const r = await call('GET', '/api/admin/customers/u-an', { as: 'admin' });
    assert.equal(r.status, 200);
    assert.ok(r.data.bookingCount >= 1);
    assert.equal(r.data.password, undefined);
  });
});

describe('4. Cập nhật trạng thái Booking (state machine)', () => {
  test('TC-ADM-017: PENDING -> CONFIRMED hợp lệ và được lưu', async () => {
    const b = await mk('customer', 100000);
    const r = await setStatus(b.id, 'CONFIRMED');
    assert.equal(r.status, 200);
    assert.equal((await call('GET', `/api/admin/bookings/${b.id}`, { as: 'admin' })).data.status, 'CONFIRMED');
  });
  test('TC-ADM-018: CONFIRMED -> COMPLETED hợp lệ', async () => {
    const b = await mk('customer', 100000);
    await setStatus(b.id, 'CONFIRMED');
    assert.equal((await setStatus(b.id, 'COMPLETED')).status, 200);
  });
  for (const [from, path, to] of [
    ['CONFIRMED', ['CONFIRMED'], 'PENDING'],
    ['PENDING', [], 'COMPLETED'],
    ['COMPLETED', ['CONFIRMED', 'COMPLETED'], 'CONFIRMED'],
    ['CANCELLED', ['CANCELLED'], 'CONFIRMED'],
  ]) {
    test(`TC-ADM-019: chuyển ${from} -> ${to} bị từ chối 409, trạng thái không đổi`, async () => {
      const b = await mk('customer', 100000);
      for (const s of path) assert.equal((await setStatus(b.id, s)).status, 200);
      assert.equal((await setStatus(b.id, to)).status, 409);
      assert.equal((await call('GET', `/api/admin/bookings/${b.id}`, { as: 'admin' })).data.status, from);
    });
  }
  test('TC-ADM-020: trạng thái lạ => 422', async () => {
    const b = await mk('customer', 100000);
    assert.equal((await setStatus(b.id, 'DELETED')).status, 422);
    assert.equal((await setStatus(b.id, undefined)).status, 422);
  });
  test('TC-ADM-021: booking không tồn tại => 404', async () => {
    assert.equal((await setStatus('khong-co', 'CONFIRMED')).status, 404);
  });
  test('TC-ADM-022: over-posting - total/customerId gửi kèm bị bỏ qua', async () => {
    const b = await mk('customer', 100000);
    const r = await setStatus(b.id, 'CONFIRMED', 'admin', { total: 1, customerId: 'u-binh', paymentStatus: 'PAID' });
    assert.equal(r.data.total, 100000);
    assert.equal(r.data.customer.id, 'u-an');
    assert.equal(r.data.paymentStatus, 'UNPAID');
  });
});

describe('5. Dashboard khớp dữ liệu nguồn', () => {
  const snapshot = async () => {
    const dash = (await call('GET', '/api/admin/dashboard', { as: 'admin' })).data;
    const list = (await call('GET', '/api/admin/bookings', { as: 'admin' })).data;
    return { dash, list };
  };
  test('TC-ADM-023: tổng booking = số dòng trong danh sách', async () => {
    await mk('customer', 100000);
    const { dash, list } = await snapshot();
    assert.equal(dash.totalBookings, list.length);
  });
  test('TC-ADM-024: số lượng theo trạng thái khớp danh sách và tổng bằng totalBookings', async () => {
    const b = await mk('customer2', 70000);
    await setStatus(b.id, 'CANCELLED');
    const { dash, list } = await snapshot();
    for (const [s, n] of Object.entries(dash.byStatus)) assert.equal(n, list.filter((x) => x.status === s).length, s);
    assert.equal(Object.values(dash.byStatus).reduce((a, c) => a + c, 0), dash.totalBookings);
  });
  test('TC-ADM-025: doanh thu = tổng booking đã thanh toán, chưa bị hủy; cập nhật sau khi hủy', async (t) => {
    if (!api.server) return t.skip('Cần tạo dữ liệu đã thanh toán bằng module Payment (backend thật)');
    const b = await mk('customer', 300000);
    const rec = api.server.__bookings.find((x) => x.id === b.id);
    rec.paymentStatus = 'PAID';
    await setStatus(b.id, 'CONFIRMED');
    const before = (await snapshot()).dash.revenue;
    assert.ok(before >= 300000);
    await setStatus(b.id, 'CANCELLED');
    assert.equal((await snapshot()).dash.revenue, before - 300000);
  });
  test('TC-ADM-026: Dashboard cập nhật ngay sau khi đổi trạng thái', async () => {
    const b = await mk('customer', 100000);
    const before = (await snapshot()).dash.byStatus;
    await setStatus(b.id, 'CONFIRMED');
    const after = (await snapshot()).dash.byStatus;
    assert.equal(after.CONFIRMED, before.CONFIRMED + 1);
    assert.equal(after.PENDING, before.PENDING - 1);
  });
  test('TC-ADM-027: số liệu Dashboard không âm và là số hữu hạn', async () => {
    const { dash } = await snapshot();
    for (const v of [dash.totalBookings, dash.revenue, ...Object.values(dash.byStatus)]) assert.ok(Number.isFinite(v) && v >= 0);
  });
});

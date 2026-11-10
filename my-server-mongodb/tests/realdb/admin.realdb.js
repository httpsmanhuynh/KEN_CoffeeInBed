'use strict';
/**
 * Kiểm thử tích hợp Module 11 (adminService + routes/admin) trên MongoDB Atlas THẬT.
 * - Chạy riêng bằng lệnh: npm run test:realdb (KHÔNG nằm trong npm test).
 * - Sử dụng database riêng biệt `ken_space_booking_test` để tuyệt đối không đụng dữ liệu thật (`ken_space_booking`).
 * - Tự động dọn dẹp (dropDatabase) sau khi chạy xong.
 */
require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const { MongoClient, ObjectId } = require('mongodb');
const svc = require('../../src/services/adminService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'ken_space_booking_test';

// Chốt chặn an toàn: tuyệt đối không cho phép chạy trên DB thật
assert.notEqual(
  TEST_DB_NAME,
  'ken_space_booking',
  'TEST_DB_NAME không được trùng với database thật ken_space_booking!',
);

let client;
let db;

const ids = {
  admin1: new ObjectId(),
  admin2: new ObjectId(),
  cust1: new ObjectId(),
  cust2: new ObjectId(),
  zonePriv: new ObjectId(),
  zoneComm: new ObjectId(),
  space1: new ObjectId(),
  space2: new ObjectId(),
  addonCoffee: new ObjectId(),
  addonSnack: new ObjectId(),
  bk1: new ObjectId(),
  bk2: new ObjectId(),
  bk3: new ObjectId(),
};

function loadAdminRouterWithAuth(currentUser) {
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

before(async () => {
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(TEST_DB_NAME);
  await db.dropDatabase();

  // Seed dữ liệu mẫu vào database riêng `ken_space_booking_test`
  await db.collection('users').insertMany([
    {
      _id: ids.admin1,
      full_name: 'Admin KÉN 1',
      phone: '0900000001',
      email: 'admin1@ken.vn',
      password_hash: 'hashed_secret_1',
      role: 'ADMIN',
      status: 'ACTIVE',
      tier: 'DIAMOND',
      created_at: new Date('2026-11-01T00:00:00Z'),
    },
    {
      _id: ids.admin2,
      full_name: 'Admin KÉN 2',
      phone: '0900000002',
      email: 'admin2@ken.vn',
      password_hash: 'hashed_secret_2',
      role: 'ADMIN',
      status: 'ACTIVE',
      tier: 'DIAMOND',
      created_at: new Date('2026-11-01T01:00:00Z'),
    },
    {
      _id: ids.cust1,
      full_name: 'Nguyễn Văn Khách',
      phone: '0901112222',
      email: 'khach1@ken.vn',
      password_hash: 'hashed_secret_3',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      tier: 'GOLD',
      created_at: new Date('2026-11-02T00:00:00Z'),
    },
    {
      _id: ids.cust2,
      full_name: 'Trần Thị B',
      phone: '0903334444',
      email: 'khach2@ken.vn',
      password_hash: 'hashed_secret_4',
      role: 'CUSTOMER',
      status: 'LOCKED',
      tier: 'BASIC',
      created_at: new Date('2026-11-03T00:00:00Z'),
    },
  ]);

  await db.collection('zones').insertMany([
    { _id: ids.zonePriv, zone_code: 'Z-PRIV', name: 'Khu Kén Riêng' },
    { _id: ids.zoneComm, zone_code: 'Z-COMM', name: 'Khu Chung' },
  ]);

  await db.collection('spaces').insertMany([
    {
      _id: ids.space1,
      zone_id: ids.zonePriv,
      space_code: 'POD-01',
      name: 'Focus Pod 01',
      booking_mode: 'EXCLUSIVE',
      capacity: 2,
      open_time: '08:00',
      close_time: '22:00',
      status: 'ACTIVE',
    },
    {
      _id: ids.space2,
      zone_id: ids.zoneComm,
      space_code: 'LNG-01',
      name: 'Work Lounge 01',
      booking_mode: 'SHARED',
      capacity: 10,
      open_time: '08:00',
      close_time: '22:00',
      status: 'ACTIVE',
    },
  ]);

  await db.collection('addons').insertMany([
    { _id: ids.addonCoffee, name: 'Cold Brew Cam Sả' },
    { _id: ids.addonSnack, name: 'Bánh Croissant Bơ Pháp' },
  ]);

  await db.collection('bookings').insertMany([
    {
      _id: ids.bk1,
      booking_code: 'BK-TEST-01',
      user_id: ids.cust1,
      space_id: ids.space1,
      status: 'CHECKED_OUT',
      guest_count: 2,
      final_amount: 250000,
      start_at: new Date('2026-11-05T02:00:00Z'), // 09:00 VN
      end_at: new Date('2026-11-05T06:00:00Z'),   // 13:00 VN (4 giờ)
      created_at: new Date('2026-11-05T01:00:00Z'),
    },
    {
      _id: ids.bk2,
      booking_code: 'BK-TEST-02',
      user_id: ids.cust1,
      space_id: ids.space2,
      status: 'CONFIRMED',
      guest_count: 5,
      final_amount: 150000,
      start_at: new Date('2026-11-06T03:00:00Z'), // 10:00 VN
      end_at: new Date('2026-11-06T05:00:00Z'),   // 12:00 VN (2 giờ * 5 khách = 10 guestHours)
      created_at: new Date('2026-11-06T01:00:00Z'),
    },
    {
      _id: ids.bk3,
      booking_code: 'BK-TEST-03',
      user_id: ids.cust1,
      space_id: ids.space1,
      status: 'CANCELLED',
      guest_count: 1,
      final_amount: 999000, // Đơn hủy không được tính vào doanh thu
      start_at: new Date('2026-11-06T07:00:00Z'),
      end_at: new Date('2026-11-06T09:00:00Z'),
      created_at: new Date('2026-11-06T02:00:00Z'),
    },
  ]);

  await db.collection('booking_addons').insertMany([
    {
      booking_id: ids.bk1,
      addon_id: ids.addonCoffee,
      quantity: 2,
      unit_price: 45000,
      line_total: 90000,
    },
    {
      booking_id: ids.bk2,
      addon_id: ids.addonSnack,
      quantity: 1,
      unit_price: 35000,
      line_total: 35000,
    },
  ]);

  await db.collection('sales_transactions').insertMany([
    {
      sold_at: new Date('2026-11-05T04:00:00Z'),
      total_amount: 120000,
      quantity: 3,
      unit_price: 40000,
    },
    {
      transaction_date: new Date('2026-11-06T04:00:00Z'),
      quantity: 2,
      unit_price: 30000, // Không có total_amount -> tự tính 2 * 30000 = 60000
    },
  ]);
});

after(async () => {
  if (db) {
    await db.dropDatabase();
  }
  if (client) {
    await client.close();
  }
});

test('TC-ADM-REAL-01 [Atlas] listUsers: phân trang, lọc status/role/tier/q và aggregate đếm bookingCount', async () => {
  const all = await svc.listUsers(db, { page: 1, limit: 10 });
  assert.equal(all.total, 4);
  const c1 = all.items.find((u) => String(u._id) === String(ids.cust1));
  assert.ok(c1);
  assert.equal(c1.bookingCount, 3);
  assert.ok(c1.lastBookingAt instanceof Date);
  assert.equal('password_hash' in c1, false);

  // Lọc theo status + role + tier + từ khóa tìm kiếm q
  const filtered = await svc.listUsers(db, { status: 'ACTIVE', role: 'customer', tier: 'gold', q: '090111' });
  assert.equal(filtered.total, 1);
  assert.equal(String(filtered.items[0]._id), String(ids.cust1));

  // Status sai -> 422 INVALID_STATUS
  await assert.rejects(
    svc.listUsers(db, { status: 'BANNED' }),
    (e) => e.code === 'INVALID_STATUS' && e.status === 422,
  );
});

test('TC-ADM-REAL-02 [Atlas] getUserProfile: aggregate thống kê đơn theo trạng thái & tổng chi tiêu thực tế', async () => {
  const profile = await svc.getUserProfile(db, String(ids.cust1));
  assert.equal(profile.user.full_name, 'Nguyễn Văn Khách');
  assert.equal('password_hash' in profile.user, false);
  assert.equal(profile.bookingStats.total, 3);
  assert.equal(profile.bookingStats.byStatus.CHECKED_OUT, 1);
  assert.equal(profile.bookingStats.byStatus.CONFIRMED, 1);
  assert.equal(profile.bookingStats.byStatus.CANCELLED, 1);
  // Chỉ cộng doanh thu đơn CHECKED_OUT (250k) + CONFIRMED (150k) = 400k, bỏ qua CANCELLED (999k)
  assert.equal(profile.bookingStats.totalSpent, 400000);

  await assert.rejects(
    svc.getUserProfile(db, 'bad-id'),
    (e) => e.code === 'INVALID_ID' && e.status === 400,
  );
  await assert.rejects(
    svc.getUserProfile(db, String(new ObjectId())),
    (e) => e.code === 'USER_NOT_FOUND' && e.status === 404,
  );
});

test('TC-ADM-REAL-03 [Atlas] listUserBookings: phân trang, lọc status và ghép thông tin Space', async () => {
  const bks = await svc.listUserBookings(db, String(ids.cust1), { page: 1, limit: 10 });
  assert.equal(bks.total, 3);
  const b1 = bks.items.find((b) => String(b._id) === String(ids.bk1));
  assert.ok(b1.space);
  assert.equal(b1.space.space_code, 'POD-01');

  const onlyConfirmed = await svc.listUserBookings(db, String(ids.cust1), { status: 'CONFIRMED' });
  assert.equal(onlyConfirmed.total, 1);
  assert.equal(onlyConfirmed.items[0].booking_code, 'BK-TEST-02');

  await assert.rejects(
    svc.listUserBookings(db, String(ids.cust1), { status: 'UNKNOWN' }),
    (e) => e.code === 'INVALID_STATUS' && e.status === 422,
  );
  await assert.rejects(
    svc.listUserBookings(db, String(new ObjectId())),
    (e) => e.code === 'USER_NOT_FOUND' && e.status === 404,
  );
});

test('TC-ADM-REAL-04 [Atlas] setUserStatus: cập nhật nguyên tử ACTIVE <-> LOCKED trên MongoDB thật', async () => {
  const locked = await svc.setUserStatus(db, {
    actor: { _id: ids.admin1 },
    targetId: String(ids.cust1),
    action: 'lock',
  });
  assert.equal(locked.status, 'LOCKED');

  const unlocked = await svc.setUserStatus(db, {
    actor: { _id: ids.admin1 },
    targetId: String(ids.cust1),
    action: 'unlock',
  });
  assert.equal(unlocked.status, 'ACTIVE');
});

test('TC-ADM-REAL-05 [Atlas] getDashboard: chạy full pipeline Aggregation (Bookings, Occupancy, Top Addons, F&B Direct, Daily Series, Zone Filter)', async () => {
  const now = new Date('2026-11-08T05:00:00Z');
  const dash = await svc.getDashboard(
    db,
    { from: '2026-11-05', to: '2026-11-06', groupBy: 'day', topAddons: '5' },
    now,
  );

  assert.equal(dash.range.days, 2);
  assert.equal(dash.bookings.total, 3);
  assert.equal(dash.bookings.byStatus.CHECKED_OUT, 1);
  assert.equal(dash.bookings.byStatus.CONFIRMED, 1);
  assert.equal(dash.bookings.byStatus.CANCELLED, 1);

  // Doanh thu booking: 250k + 150k = 400k; F&B trực tiếp: 120k + 60k = 180k; Tổng = 580k
  assert.equal(dash.revenue.bookings.total, 400000);
  assert.equal(dash.revenue.fnbDirect.total, 180000);
  assert.equal(dash.revenue.fnbDirect.transactions, 2);
  assert.equal(dash.revenue.grandTotal, 580000);

  // Top Add-ons từ $lookup booking_addons
  assert.equal(dash.topAddons.length, 2);
  assert.equal(dash.topAddons[0].name, 'Cold Brew Cam Sả');
  assert.equal(dash.topAddons[0].revenue, 90000);

  // Chuỗi theo ngày ($dateToString timezone +07:00)
  assert.ok(Array.isArray(dash.daily));
  assert.equal(dash.daily.length, 2);
  assert.deepEqual(dash.daily[0], { date: '2026-11-05', bookings: 1, revenue: 250000 });
  assert.deepEqual(dash.daily[1], { date: '2026-11-06', bookings: 1, revenue: 150000 });

  // Lọc theo zone_code ('Z-PRIV')
  const byZone = await svc.getDashboard(
    db,
    { from: '2026-11-05', to: '2026-11-06', zoneId: 'Z-PRIV' },
    now,
  );
  assert.equal(byZone.filters.zoneCode, 'Z-PRIV');
  assert.equal(byZone.revenue.bookings.total, 250000);

  // Lọc theo zone _id
  const byZoneOid = await svc.getDashboard(
    db,
    { from: '2026-11-05', to: '2026-11-06', zoneId: String(ids.zoneComm) },
    now,
  );
  assert.equal(byZoneOid.filters.zoneCode, 'Z-COMM');
  assert.equal(byZoneOid.revenue.bookings.total, 150000);

  // Zone không tồn tại -> 404 ZONE_NOT_FOUND
  await assert.rejects(
    svc.getDashboard(db, { from: '2026-11-05', to: '2026-11-06', zoneId: 'Z-NOT-EXIST' }, now),
    (e) => e.code === 'ZONE_NOT_FOUND' && e.status === 404,
  );
});

test('TC-ADM-REAL-06 [Atlas] HTTP Routes /api/admin/* kết nối DB thật (users, profile, bookings, dashboard)', async () => {
  const express = require('express');
  const router = loadAdminRouterWithAuth({ _id: ids.admin1, role: 'ADMIN' });
  const app = express();
  app.locals.db = db;
  app.use('/api/admin', router);

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin`;

  try {
    const rUsers = await fetch(`${baseUrl}/users?limit=5`);
    assert.equal(rUsers.status, 200);
    const bUsers = await rUsers.json();
    assert.equal(bUsers.total, 4);

    const rProfile = await fetch(`${baseUrl}/users/${ids.cust1}`);
    assert.equal(rProfile.status, 200);
    const bProfile = await rProfile.json();
    assert.equal(bProfile.bookingStats.totalSpent, 400000);

    const rBookings = await fetch(`${baseUrl}/users/${ids.cust1}/bookings`);
    assert.equal(rBookings.status, 200);
    const bBookings = await rBookings.json();
    assert.equal(bBookings.total, 3);

    const rDash = await fetch(`${baseUrl}/dashboard?from=2026-11-05&to=2026-11-06&groupBy=day`);
    assert.equal(rDash.status, 200);
    const bDash = await rDash.json();
    assert.equal(bDash.revenue.grandTotal, 580000);
  } finally {
    server.close();
  }
});

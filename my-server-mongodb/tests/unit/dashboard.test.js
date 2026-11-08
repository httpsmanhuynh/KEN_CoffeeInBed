'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOKING_STATUSES, REVENUE_STATUSES, parseDateRange, parseClock, openHoursOf, parseLimit,
  buildZoneStats, rankTopAddons, normalizeAddonLine,
} = require('../../src/domain/dashboard');

const NOW = new Date('2026-11-08T05:00:00Z'); // 12:00 giờ VN, 08/11/2026

/* ------------------------------------------------ TC-DSH-01..07: khoảng thời gian */
test('TC-DSH-01 mặc định 30 ngày kết thúc hôm nay (giờ VN)', () => {
  const r = parseDateRange({}, NOW);
  assert.equal(r.days, 30);
  assert.equal(r.toDate, '2026-11-08');
  assert.equal(r.fromDate, '2026-10-10');
  assert.equal(r.from.toISOString(), '2026-10-09T17:00:00.000Z'); // 00:00 VN = 17:00Z hôm trước
  assert.equal(r.to.toISOString(), '2026-11-08T17:00:00.000Z');
});

test('TC-DSH-02 from/to bao gồm cả ngày `to`', () => {
  const r = parseDateRange({ from: '2026-11-01', to: '2026-11-03' }, NOW);
  assert.equal(r.days, 3);
  assert.equal(r.to.toISOString(), '2026-11-03T17:00:00.000Z');
});

test('TC-DSH-03 ngày hôm nay theo VN khi UTC vẫn là hôm qua', () => {
  const r = parseDateRange({}, new Date('2026-11-07T20:00:00Z')); // 03:00 ngày 08/11 VN
  assert.equal(r.toDate, '2026-11-08');
});

test('TC-DSH-04 sai định dạng / ngày không tồn tại -> INVALID_DATE', () => {
  for (const q of [{ from: '08/11/2026' }, { to: '2026-02-30' }, { from: 'abc' }]) {
    assert.throws(() => parseDateRange(q, NOW), (e) => e.code === 'INVALID_DATE' && e.status === 422);
  }
});

test('TC-DSH-05 from > to -> INVALID_RANGE', () => {
  assert.throws(() => parseDateRange({ from: '2026-11-05', to: '2026-11-01' }, NOW), (e) => e.code === 'INVALID_RANGE');
});

test('TC-DSH-06 vượt 366 ngày -> RANGE_TOO_LARGE', () => {
  assert.throws(() => parseDateRange({ from: '2025-01-01', to: '2026-11-08' }, NOW), (e) => e.code === 'RANGE_TOO_LARGE');
  assert.equal(parseDateRange({ from: '2026-01-01', to: '2026-12-31' }, NOW).days, 365);
});

test('TC-DSH-07 parseLimit: mặc định 5, trần 20, sai -> INVALID_LIMIT', () => {
  assert.equal(parseLimit(undefined), 5);
  assert.equal(parseLimit('50'), 20);
  assert.equal(parseLimit('3'), 3);
  assert.throws(() => parseLimit('0'), (e) => e.code === 'INVALID_LIMIT');
  assert.throws(() => parseLimit('x'), (e) => e.code === 'INVALID_LIMIT');
});

/* ------------------------------------------------ giờ mở cửa */
test('TC-DSH-08 parseClock / openHoursOf', () => {
  assert.equal(parseClock('08:30'), 8.5);
  assert.equal(parseClock('22:00:00'), 22);
  assert.equal(parseClock('25:00'), null);
  assert.equal(parseClock(null), null);
  assert.equal(openHoursOf({ open_time: '08:00', close_time: '22:00' }), 14);
  assert.equal(openHoursOf({ open_time: '10:00', close_time: '09:00' }), 14); // sai -> mặc định
});

/* ------------------------------------------------ buildZoneStats */
const zones = [
  { _id: 'z1', zone_code: 'Z-PRIV', name: 'Phòng riêng' },
  { _id: 'z2', zone_code: 'Z-COMM', name: 'Khu chung' },
];
const spaces = [
  { _id: 's1', zone_id: 'z1', booking_mode: 'EXCLUSIVE', capacity: 4, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' },
  { _id: 's2', zone_id: 'z1', booking_mode: 'EXCLUSIVE', capacity: 6, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' },
  { _id: 's3', zone_id: 'z2', booking_mode: 'SHARED', capacity: 10, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' },
  { _id: 's4', zone_id: 'z2', booking_mode: 'EXCLUSIVE', capacity: 2, open_time: '08:00', close_time: '22:00', status: 'INACTIVE' },
];
const range = { days: 2 };
const g = (space, status, count, revenue = 0, hours = 0, guestHours = 0) => ({ _id: { space, status }, count, revenue, hours, guestHours });

test('TC-DSH-09 luôn đủ 7 trạng thái (kể cả 0) và đúng thứ tự khóa', () => {
  const r = buildZoneStats({ range, spaces, zones, bookingGroups: [] });
  assert.deepEqual(Object.keys(r.totals.bookings.byStatus), BOOKING_STATUSES);
  assert.equal(r.totals.bookings.total, 0);
  assert.equal(r.totals.revenue.total, 0);
});

test('TC-DSH-10 doanh thu chỉ tính CONFIRMED/CHECKED_IN/CHECKED_OUT/NO_SHOW', () => {
  const r = buildZoneStats({
    range, spaces, zones,
    bookingGroups: [
      g('s1', 'CHECKED_OUT', 2, 400000, 4),
      g('s1', 'CONFIRMED', 1, 100000, 2),
      g('s1', 'NO_SHOW', 1, 50000, 1),
      g('s1', 'CHECKED_IN', 1, 70000, 1),
      g('s1', 'CANCELLED', 3, 999999),
      g('s1', 'EXPIRED', 2, 888888),
      g('s1', 'PENDING_PAYMENT', 1, 777777),
    ],
  });
  assert.equal(r.totals.revenue.total, 400000 + 100000 + 50000 + 70000);
  assert.deepEqual(Object.keys(r.totals.revenue.byStatus), REVENUE_STATUSES);
  assert.equal(r.totals.bookings.total, 11);
  assert.equal(r.totals.bookings.byStatus.CANCELLED, 3);
});

test('TC-DSH-11 occupancy EXCLUSIVE = giờ đặt / (ngày × giờ mở cửa)', () => {
  // s1: 14h × 2 ngày = 28h khả dụng; đã dùng 7h => 25%
  const r = buildZoneStats({ range, spaces: [spaces[0]], zones, bookingGroups: [g('s1', 'CHECKED_OUT', 2, 0, 7)] });
  assert.equal(r.totals.occupancy.rate, 25);
  assert.equal(r.totals.occupancy.availableHours, 28);
  assert.equal(r.totals.occupancy.occupiedHours, 7);
});

test('TC-DSH-12 occupancy SHARED quy đổi theo sức chứa (giờ-khách / capacity)', () => {
  // s3: capacity 10, 28h khả dụng; 70 giờ-khách = 7 giờ-không-gian => 25%
  const r = buildZoneStats({ range, spaces: [spaces[2]], zones, bookingGroups: [g('s3', 'CONFIRMED', 5, 0, 20, 70)] });
  assert.equal(r.totals.occupancy.rate, 25);
});

test('TC-DSH-13 đơn hủy/hết hạn/chờ thanh toán không chiếm chỗ', () => {
  const r = buildZoneStats({
    range, spaces: [spaces[0]], zones,
    bookingGroups: [g('s1', 'CANCELLED', 1, 0, 0), g('s1', 'EXPIRED', 1, 0, 0), g('s1', 'PENDING_PAYMENT', 1, 0, 0)],
  });
  assert.equal(r.totals.occupancy.rate, 0);
});

test('TC-DSH-14 space INACTIVE không vào mẫu số, trừ khi có giờ dùng trong kỳ', () => {
  const a = buildZoneStats({ range, spaces, zones, bookingGroups: [] });
  assert.equal(a.totals.occupancy.availableHours, 3 * 28); // s1,s2,s3
  const b = buildZoneStats({ range, spaces, zones, bookingGroups: [g('s4', 'CHECKED_OUT', 1, 0, 2)] });
  assert.equal(b.totals.occupancy.availableHours, 4 * 28);
});

test('TC-DSH-15 tách theo Zone & tổng khớp tổng các Zone', () => {
  const r = buildZoneStats({
    range, spaces, zones,
    bookingGroups: [g('s1', 'CHECKED_OUT', 1, 300000, 4), g('s3', 'CONFIRMED', 2, 120000, 6, 30)],
  });
  assert.equal(r.zones.length, 2);
  const priv = r.zones.find((z) => z.zoneCode === 'Z-PRIV');
  const comm = r.zones.find((z) => z.zoneCode === 'Z-COMM');
  assert.equal(priv.revenue.total, 300000);
  assert.equal(comm.revenue.total, 120000);
  assert.equal(priv.bookings.total, 1);
  assert.equal(comm.bookings.total, 2);
  assert.equal(r.totals.revenue.total, priv.revenue.total + comm.revenue.total);
  assert.equal(r.totals.bookings.total, 3);
  assert.equal(priv.spaceCount, 2);
});

test('TC-DSH-16 bỏ qua nhóm thuộc space ngoài phạm vi lọc và trạng thái lạ', () => {
  const r = buildZoneStats({
    range, spaces: [spaces[0]], zones,
    bookingGroups: [g('s3', 'CONFIRMED', 9, 999), g('s1', 'WEIRD', 4, 111), g('s1', 'CONFIRMED', 1, 50)],
  });
  assert.equal(r.totals.bookings.total, 1);
  assert.equal(r.totals.revenue.total, 50);
});

/* ------------------------------------------------ Top Add-on */
test('TC-DSH-17 xếp hạng theo số lượng, hòa thì theo doanh thu, rồi tên', () => {
  const lines = [
    { booking_id: 'b1', addon_id: 'a1', addon_name: 'Hoa', quantity: 2, unit_price: 50000 },
    { booking_id: 'b2', addon_id: 'a1', addon_name: 'Hoa', quantity: 1, unit_price: 50000 },
    { booking_id: 'b2', addon_id: 'a2', addon_name: 'Bóng bay', quantity: 3, unit_price: 20000 },
    { booking_id: 'b3', addon_id: 'a3', addon_name: 'Nến', quantity: 3, unit_price: 30000 },
  ];
  const top = rankTopAddons(lines, { limit: 5 });
  assert.deepEqual(top.map((t) => t.name), ['Hoa', 'Nến', 'Bóng bay']); // Hoa=3, Nến=3 (90k>60k), Bóng bay=3 (60k)
  assert.equal(top[0].quantity, 3);
  assert.equal(top[0].revenue, 150000);
  assert.equal(top[0].bookings, 2);
});

test('TC-DSH-18 limit cắt danh sách; dòng quantity<=0 bị bỏ', () => {
  const lines = [
    { addon_id: 'a1', name: 'A', quantity: 5, line_total: 5 },
    { addon_id: 'a2', name: 'B', quantity: 4, line_total: 4 },
    { addon_id: 'a3', name: 'C', quantity: 0, line_total: 100 },
  ];
  const top = rankTopAddons(lines, { limit: 1 });
  assert.equal(top.length, 1);
  assert.equal(top[0].name, 'A');
  assert.equal(rankTopAddons(lines, { limit: 10 }).length, 2);
});

test('TC-DSH-19 tên lấy từ catalog khi dòng snapshot không có tên; ưu tiên line_total', () => {
  const names = new Map([['a9', 'Cắm trại']]);
  const l = normalizeAddonLine({ addon_id: 'a9', quantity: 2, unit_price: 10, line_total: 25 }, names);
  assert.equal(l.name, 'Cắm trại');
  assert.equal(l.revenue, 25);
  assert.equal(normalizeAddonLine({ addon_id: 'x', quantity: 2, unit_price: 10 }).revenue, 20);
});

'use strict';
/**
 * Kiểm thử đơn vị Module 11 — Admin Dashboard Domain (src/domain/dashboard.js).
 * Mã TC đồng bộ 100% với sheet Test_Module11_Admin_Dashboard (TC-ADM-01..64) và Postman Collection Module 11.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOKING_STATUSES, PAID_STATUSES, parseDateRange, parseClock, openHoursOf, parseLimit,
  allocateAmount, buildRevenue, buildZoneStats, rankTopAddons, normalizeAddonLine,
} = require('../../src/domain/dashboard');

const NOW = new Date('2026-11-10T05:00:00Z'); // 12:00 giờ VN, 10/11/2026

/* ------------------------------------------------ Khoảng thời gian & tham số */
test('TC-ADM-41\t[ADM-41] Không truyền tham số: mặc định 30 ngày gần nhất kết thúc hôm nay (giờ VN) (ADM-B41)', () => {
  const r = parseDateRange({}, NOW);
  assert.equal(r.days, 30);
  assert.equal(r.toDate, '2026-11-10');
  assert.equal(r.fromDate, '2026-10-12');
  assert.equal(r.timezone, 'Asia/Ho_Chi_Minh');
  assert.equal(r.from.toISOString(), '2026-10-11T17:00:00.000Z'); // 00:00 VN = 17:00Z hôm trước
  assert.equal(r.to.toISOString(), '2026-11-10T17:00:00.000Z');

  // Khoảng 0–7h sáng VN khi UTC vẫn là hôm qua (03:00 sáng ngày 10/11 VN = 20:00Z ngày 09/11)
  const earlyVn = parseDateRange({}, new Date('2026-11-09T20:00:00Z'));
  assert.equal(earlyVn.days, 30);
  assert.equal(earlyVn.toDate, '2026-11-10');
  assert.equal(earlyVn.fromDate, '2026-10-12');
});

test('TC-ADM-14, TC-ADM-42\t[ADM-14, ADM-42] from/to (YYYY-MM-DD giờ VN) bao gồm cả ngày to [from 00:00 VN, to+1 00:00 VN) (ADM-B14; ADM-B42)', () => {
  const r = parseDateRange({ from: '2026-11-01', to: '2026-11-07' }, NOW);
  assert.equal(r.days, 7);
  assert.equal(r.from.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(r.to.toISOString(), '2026-11-07T17:00:00.000Z');

  const oneDay = parseDateRange({ from: '2026-11-01', to: '2026-11-01' }, NOW);
  assert.equal(oneDay.days, 1);
  assert.equal(oneDay.from.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.equal(oneDay.to.toISOString(), '2026-11-01T17:00:00.000Z');
});

test('TC-ADM-15\t[ADM-15] from > to hoặc ngày sai định dạng / quá 366 ngày -> 422 INVALID_RANGE / INVALID_DATE / RANGE_TOO_LARGE (ADM-B15)', () => {
  assert.throws(
    () => parseDateRange({ from: '2026-12-31', to: '2026-01-01' }, NOW),
    (e) => e.code === 'INVALID_RANGE' && e.status === 422
  );
  for (const q of [
    { from: 'abc' },
    { from: '2026-01-01T00:00:00Z' },
    { from: '08/11/2026' },
    { to: '2026-02-30' },
  ]) {
    assert.throws(() => parseDateRange(q, NOW), (e) => e.code === 'INVALID_DATE' && e.status === 422);
  }
  assert.throws(
    () => parseDateRange({ from: '2025-11-09', to: '2026-11-10' }, NOW), // 367 ngày
    (e) => e.code === 'RANGE_TOO_LARGE' && e.status === 422
  );
  assert.equal(parseDateRange({ from: '2026-01-01', to: '2026-12-31' }, NOW).days, 365);
});

test('TC-ADM-50\t[ADM-50] Tham số topAddons: mặc định 5, trần 20, 0 hoặc abc -> 422 INVALID_LIMIT (ADM-B50)', () => {
  assert.equal(parseLimit(undefined), 5);
  assert.equal(parseLimit('3'), 3);
  assert.equal(parseLimit('50'), 20);
  assert.throws(() => parseLimit('0'), (e) => e.code === 'INVALID_LIMIT' && e.status === 422);
  assert.throws(() => parseLimit('abc'), (e) => e.code === 'INVALID_LIMIT' && e.status === 422);
});

/* ------------------------------------------------ Giờ mở cửa */
test('TC-ADM-16\t[ADM-16] parseClock & openHoursOf: tính giờ mở cửa Space (08:00–22:00 = 14h) (ADM-B16)', () => {
  assert.equal(parseClock('08:30'), 8.5);
  assert.equal(parseClock('22:00:00'), 22);
  assert.equal(parseClock('25:00'), null);
  assert.equal(parseClock(null), null);
  assert.equal(openHoursOf({ open_time: '08:00', close_time: '22:00' }), 14);
  assert.equal(openHoursOf({ open_time: '10:00', close_time: '09:00' }), 14); // sai -> mặc định 14h
});

/* ------------------------------------------------ buildZoneStats: Số đơn & Occupancy Rate */
const zones = [
  { _id: 'z1', zone_code: 'Z-PRIV', name: 'Phòng riêng' },
  { _id: 'z2', zone_code: 'Z-COMM', name: 'Khu chung' },
];
const spaces = [
  { _id: 's1', zone_id: 'z1', booking_mode: 'EXCLUSIVE', capacity: 4, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' },
  { _id: 's2', zone_id: 'z1', booking_mode: 'EXCLUSIVE', capacity: 6, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' },
  { _id: 's3', zone_id: 'z2', booking_mode: 'SHARED', capacity: 10, open_time: '08:00', close_time: '22:00', status: 'ACTIVE' },
  { _id: 's4', zone_id: 'z2', booking_mode: 'EXCLUSIVE', capacity: 2, open_time: '08:00', close_time: '22:00', status: 'MAINTENANCE' },
];
const range1Day = { days: 1 };
const range2Days = { days: 2 };
const g = (space, status, count, hours = 0, guestHours = 0) => ({ _id: { space, status }, count, hours, guestHours });

test('TC-ADM-13, TC-ADM-46\t[ADM-13, ADM-46] Số đơn theo 7 trạng thái luôn đủ 7 khóa (kể cả 0 đơn); kỳ không có đơn không NaN (ADM-B13; ADM-B46)', () => {
  const r = buildZoneStats({ range: range2Days, spaces, zones, bookingGroups: [] });
  assert.deepEqual(Object.keys(r.totals.bookings.byStatus), BOOKING_STATUSES);
  assert.equal(r.totals.bookings.total, 0);
  assert.equal(r.totals.occupancy.rate, 0);
  assert.ok(r.zones.every((z) => z.revenue.total === 0 && z.revenue.breakdown.package === 0));
});

test('TC-ADM-13, TC-ADM-48\t[ADM-13, ADM-48] Số đơn đếm đủ 7 trạng thái; chỉ 4 trạng thái PAID_STATUSES chiếm chỗ, CANCELLED/EXPIRED/PENDING_PAYMENT không chiếm chỗ (ADM-B13; ADM-B48)', () => {
  const r = buildZoneStats({
    range: range2Days,
    spaces,
    zones,
    bookingGroups: [
      g('s1', 'CHECKED_OUT', 2, 4),
      g('s1', 'CONFIRMED', 1, 2),
      g('s1', 'NO_SHOW', 1, 1),
      g('s1', 'CHECKED_IN', 1, 1),
      g('s1', 'CANCELLED', 3, 9),
      g('s1', 'EXPIRED', 2, 9),
      g('s1', 'PENDING_PAYMENT', 1, 9),
    ],
  });
  assert.deepEqual(PAID_STATUSES, ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW']);
  assert.equal(r.totals.bookings.total, 11);
  assert.equal(r.totals.bookings.byStatus.CANCELLED, 3);
  assert.equal(r.totals.occupancy.occupiedHours, 8); // 4 + 2 + 1 + 1; CANCELLED/EXPIRED/PENDING_PAYMENT không tính
  assert.equal('revenue' in r.totals, false); // doanh thu tính riêng bằng buildRevenue (theo giao dịch)
});

test('TC-ADM-16\t[ADM-16] Occupancy Rate EXCLUSIVE = giờ đã đặt / (số ngày × giờ mở cửa) (7h / 14h = 50%) (ADM-B16)', () => {
  const r = buildZoneStats({
    range: range1Day,
    spaces: [spaces[0]],
    zones: [zones[0]],
    bookingGroups: [g('s1', 'CHECKED_OUT', 1, 7)],
  });
  assert.equal(r.totals.occupancy.rate, 50);
  assert.equal(r.totals.occupancy.occupiedHours, 7);
  assert.equal(r.totals.occupancy.availableHours, 14);
});

test('TC-ADM-47\t[ADM-47] Space SHARED: giờ-khách quy đổi theo sức chứa (70 giờ-khách / capacity 10 = 7h / 14h = 50%) (ADM-B47)', () => {
  const r = buildZoneStats({
    range: range1Day,
    spaces: [spaces[2]],
    zones: [zones[1]],
    bookingGroups: [g('s3', 'CONFIRMED', 1, 7, 70)],
  });
  assert.equal(r.totals.occupancy.rate, 50);
  assert.equal(r.totals.occupancy.occupiedHours, 7);
  assert.equal(r.totals.occupancy.availableHours, 14);
});

test('TC-ADM-17, TC-ADM-48\t[ADM-17, ADM-48] Biên Occupancy Rate: không có đơn -> 0%; kín lịch 14h/14h -> 100%; không chia cho 0; đơn CANCELLED/EXPIRED/PENDING_PAYMENT -> 0% (ADM-B17; ADM-B48)', () => {
  const zero = buildZoneStats({
    range: range1Day,
    spaces: [spaces[0]],
    zones: [zones[0]],
    bookingGroups: [g('s1', 'CANCELLED', 1, 3), g('s1', 'EXPIRED', 1, 3), g('s1', 'PENDING_PAYMENT', 1, 3)],
  });
  assert.equal(zero.totals.occupancy.rate, 0);
  assert.equal(zero.totals.occupancy.occupiedHours, 0);

  const full = buildZoneStats({
    range: range1Day,
    spaces: [spaces[0]],
    zones: [zones[0]],
    bookingGroups: [g('s1', 'CHECKED_OUT', 1, 14)],
  });
  assert.equal(full.totals.occupancy.rate, 100);

  const noSpace = buildZoneStats({ range: range1Day, spaces: [], zones: [], bookingGroups: [] });
  assert.equal(noSpace.totals.occupancy.rate, 0);
  assert.equal(Number.isNaN(noSpace.totals.occupancy.rate), false);
});

test('TC-ADM-49\t[ADM-49] Space không ACTIVE (MAINTENANCE) chỉ vào mẫu số khi có giờ dùng trong kỳ (ADM-B49)', () => {
  const zoneSpaces = [spaces[2], spaces[3]]; // 1 ACTIVE (14h) + 1 MAINTENANCE (14h)
  const a = buildZoneStats({ range: range1Day, spaces: zoneSpaces, zones: [zones[1]], bookingGroups: [] });
  assert.equal(a.totals.occupancy.availableHours, 14); // chỉ tính Space ACTIVE

  const b = buildZoneStats({
    range: range1Day,
    spaces: zoneSpaces,
    zones: [zones[1]],
    bookingGroups: [g('s4', 'CHECKED_OUT', 1, 2)],
  });
  assert.equal(b.totals.occupancy.availableHours, 28); // cả 2 Space
  assert.equal(b.totals.occupancy.occupiedHours, 2);
});

test('TC-ADM-44\t[ADM-44] Tách theo Zone: tổng các Zone khớp toàn hệ thống (bookings.total và revenue.total) (ADM-B44)', () => {
  const spaceById = new Map(spaces.map((x) => [String(x._id), x]));
  const revenue = buildRevenue({
    spaceById,
    transactions: [
      { type: 'PAYMENT', amount: 300000, at: '2026-11-01T03:00:00Z', spaceId: 's1', final: 300000 },
      { type: 'PAYMENT', amount: 120000, at: '2026-11-01T04:00:00Z', spaceId: 's3', final: 120000 },
    ],
  });
  const r = buildZoneStats({
    range: range2Days,
    spaces,
    zones,
    revenue,
    bookingGroups: [g('s1', 'CHECKED_OUT', 1, 4), g('s3', 'CONFIRMED', 2, 6, 30)],
  });
  assert.equal(r.zones.length, 2);
  const priv = r.zones.find((z) => z.zoneCode === 'Z-PRIV');
  const comm = r.zones.find((z) => z.zoneCode === 'Z-COMM');
  assert.equal(priv.revenue.total, 300000);
  assert.equal(comm.revenue.total, 120000);
  assert.equal(priv.bookings.total, 1);
  assert.equal(comm.bookings.total, 2);
  assert.equal(revenue.total, priv.revenue.total + comm.revenue.total);
  assert.equal(r.totals.bookings.total, priv.bookings.total + comm.bookings.total);
  assert.equal(priv.spaceCount, 2);
});

test('TC-ADM-14\t[ADM-14] Lọc Zone: bỏ qua nhóm thuộc Space ngoài phạm vi lọc và trạng thái lạ (ADM-B14)', () => {
  const r = buildZoneStats({
    range: range2Days,
    spaces: [spaces[0]],
    zones,
    bookingGroups: [g('s3', 'CONFIRMED', 9), g('s1', 'WEIRD', 4), g('s1', 'CONFIRMED', 1)],
  });
  assert.equal(r.totals.bookings.total, 1);
});

/* ------------------------------------------------ Top Add-on */
test('TC-ADM-18\t[ADM-18] Top Add-on theo số lượng bán giảm dần, hòa thì theo doanh thu, rồi tên (ADM-B18)', () => {
  const lines = [
    { booking_id: 'b1', addon_id: 'a1', addon_name: 'Hoa', quantity: 2, unit_price: 50000 },
    { booking_id: 'b2', addon_id: 'a1', addon_name: 'Hoa', quantity: 1, unit_price: 50000 },
    { booking_id: 'b2', addon_id: 'a2', addon_name: 'Bóng bay', quantity: 3, unit_price: 20000 },
    { booking_id: 'b3', addon_id: 'a3', addon_name: 'Nến', quantity: 3, unit_price: 30000 },
  ];
  const top = rankTopAddons(lines, { limit: 5 });
  assert.deepEqual(top.map((t) => t.name), ['Hoa', 'Nến', 'Bóng bay']); // Hoa=3 (150k), Nến=3 (90k), Bóng bay=3 (60k)
  assert.equal(top[0].quantity, 3);
  assert.equal(top[0].revenue, 150000);
  assert.equal(top[0].bookings, 2);
});

test('TC-ADM-18, TC-ADM-50\t[ADM-18, ADM-50] Top Add-on: cắt theo limit và bỏ qua dòng quantity <= 0 (ADM-B18; ADM-B50)', () => {
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

test('TC-ADM-18\t[ADM-18] normalizeAddonLine: lấy tên từ catalog khi snapshot thiếu tên, ưu tiên line_total (ADM-B18)', () => {
  const names = new Map([['a9', 'Cắm trại']]);
  const l = normalizeAddonLine({ addon_id: 'a9', quantity: 2, unit_price: 10, line_total: 25 }, names);
  assert.equal(l.name, 'Cắm trại');
  assert.equal(l.revenue, 25);
  assert.equal(normalizeAddonLine({ addon_id: 'x', quantity: 2, unit_price: 10 }).revenue, 20);
});

/* ------------------------------------------------ Doanh thu thực thu (Report B.3.30, UC-29, UC-31) */
const spaceById = new Map(spaces.map((x) => [String(x._id), x]));
// Đơn mẫu: Package 500.000 + Inclusion 59.000 + Add-on 100.000 − Voucher 50.000 − Hạng 9.000 = 600.000
const SNAP = { final: 600000, inclusion: 59000, addon: 100000, voucherDiscount: 50000, tierDiscount: 9000 };
const tx = (type, amount, at, extra = {}) => ({ type, amount, at, spaceId: 's1', ...SNAP, ...extra });

test('TC-ADM-20\t[ADM-20] Doanh thu = tổng PAYMENT thành công − tổng REFUND thành công, tính theo thời điểm giao dịch (ADM-B20)', () => {
  const r = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'),
      tx('PAYMENT', 300000, '2026-11-01T05:00:00Z', { final: 300000, inclusion: 0, addon: 0, voucherDiscount: 0, tierDiscount: 0 }),
      tx('REFUND', 200000, '2026-11-02T03:00:00Z', { final: 300000, inclusion: 0, addon: 0, voucherDiscount: 0, tierDiscount: 0 }),
    ],
  });
  assert.equal(r.total, 600000 + 300000 - 200000);
  assert.equal(r.collected.amount, 900000);
  assert.equal(r.collected.count, 2);
  assert.equal(r.refunded.amount, 200000);
  assert.equal(r.refunded.count, 1);
});

test('TC-ADM-22\t[ADM-22] Đơn hủy: hoàn tiền đủ bù trừ về 0; hoàn một phần chỉ giảm đúng số tiền đã hoàn (ADM-B22)', () => {
  const full = buildRevenue({
    spaceById,
    transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'), tx('REFUND', 600000, '2026-11-01T04:00:00Z')],
  });
  assert.equal(full.total, 0);
  assert.deepEqual(full.breakdown, { package: 0, inclusionSurcharge: 0, addon: 0, discount: 0 });

  const partial = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 500000, '2026-11-01T03:00:00Z', { final: 500000, inclusion: 0, addon: 0, voucherDiscount: 0, tierDiscount: 0 }),
      tx('REFUND', 400000, '2026-11-01T04:00:00Z', { final: 500000, inclusion: 0, addon: 0, voucherDiscount: 0, tierDiscount: 0 }),
    ],
  });
  assert.equal(partial.total, 100000); // phần phí hủy 100.000 giữ lại vẫn là doanh thu
  assert.equal(partial.refunded.amount, 400000);
});

test('TC-ADM-59\t[ADM-59] Đơn hủy nhưng hoàn tiền thất bại (REFUND FAILED): chưa trừ doanh thu cho đến khi Admin đối soát (ADM-B59)', () => {
  // Bước 3: REFUND FAILED bị loại ở tầng lọc status=SUCCESS nên chưa trừ vào doanh thu
  const beforeReconcile = buildRevenue({
    spaceById,
    transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z')],
  });
  assert.equal(beforeReconcile.total, 600000);
  assert.equal(beforeReconcile.refunded.amount, 0);
  assert.equal(beforeReconcile.refunded.count, 0);

  // Bước 5: Admin đối soát (refund-reconcile) ghi REFUND method MANUAL, status SUCCESS -> trừ đúng 600.000
  const afterReconcile = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'),
      tx('REFUND', 600000, '2026-11-03T03:00:00Z'),
    ],
  });
  assert.equal(afterReconcile.total, 0);
  assert.deepEqual(afterReconcile.refunded, { amount: 600000, count: 1 });
});

test('TC-ADM-60\t[ADM-60] Hoàn tiền đang xử lý (REFUND PENDING) chưa trừ doanh thu; khi đổi sang SUCCESS mới trừ (ADM-B60)', () => {
  // Bước 1: REFUND đang PENDING nên chưa tham gia doanh thu
  const whilePending = buildRevenue({
    spaceById,
    transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z')],
  });
  assert.equal(whilePending.total, 600000);
  assert.equal(whilePending.refunded.count, 0);

  // Bước 3: Sau khi REFUND chuyển thành SUCCESS
  const afterSuccess = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'),
      tx('REFUND', 600000, '2026-11-02T03:00:00Z'),
    ],
  });
  assert.equal(afterSuccess.total, 0);
  assert.deepEqual(afterSuccess.refunded, { amount: 600000, count: 1 });
});

test('TC-ADM-23, TC-ADM-52\t[ADM-23, ADM-52] Doanh thu phân rã Package, Phụ phí Inclusion, Add-on, trừ Giảm giá; tổng phân rã khớp doanh thu thực thu (ADM-B23; ADM-B52)', () => {
  const r = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z')] });
  assert.deepEqual(r.breakdown, { package: 500000, inclusionSurcharge: 59000, addon: 100000, discount: 59000 });
  const b = r.breakdown;
  assert.equal(b.package + b.inclusionSurcharge + b.addon - b.discount, r.total);
  assert.equal(r.total, 600000);

  // TC-ADM-52: Giá gốc 500.000đ, giảm 50.000đ -> thực thu 450.000đ
  const discounted = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 450000, '2026-11-01T03:00:00Z', {
        final: 450000, inclusion: 0, addon: 0, voucherDiscount: 50000, tierDiscount: 0,
      }),
    ],
  });
  assert.equal(discounted.total, 450000);
  assert.equal(discounted.breakdown.discount, 50000);
  assert.equal(discounted.breakdown.package, 500000);
  assert.equal(
    discounted.breakdown.package + discounted.breakdown.inclusionSurcharge + discounted.breakdown.addon - discounted.breakdown.discount,
    discounted.total
  );
});

test('TC-ADM-61\t[ADM-61] Phân rã doanh thu vẫn khớp tổng khi có hoàn tiền một phần và khi lọc Zone (ADM-B61)', () => {
  const r = buildRevenue({
    spaceById,
    transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'), tx('REFUND', 100000, '2026-11-02T03:00:00Z')],
  });
  const b = r.breakdown;
  assert.equal(r.total, 500000);
  assert.equal(b.package + b.inclusionSurcharge + b.addon - b.discount, r.total);
  assert.ok(Number.isInteger(b.package) && Number.isInteger(b.inclusionSurcharge) && Number.isInteger(b.addon) && Number.isInteger(b.discount));
  const p = allocateAmount(100000, SNAP);
  assert.equal(p.package + p.inclusionSurcharge + p.addon - p.discount, 100000);
});

test('TC-ADM-45, TC-ADM-54\t[ADM-45, ADM-54] Chuỗi doanh thu thực thu theo ngày giao dịch (giờ VN, groupBy=day) và ranh giới ngày giờ VN (ADM-B45; ADM-B54)', () => {
  const r = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 600000, '2026-11-01T16:30:00Z'), // 23:30 VN 01/11
      tx('PAYMENT', 600000, '2026-11-01T17:00:00Z'), // 00:00 VN 02/11
      tx('REFUND', 200000, '2026-11-01T18:00:00Z'),  // 01:00 VN 02/11
    ],
  });
  assert.deepEqual(r.daily, [
    { date: '2026-11-01', revenue: 600000, payment: 600000, refund: 0 },
    { date: '2026-11-02', revenue: 400000, payment: 600000, refund: 200000 },
  ]);
  assert.equal(r.daily.reduce((a, d) => a + d.revenue, 0), r.total);
});

test('TC-ADM-46, TC-ADM-64\t[ADM-46, ADM-64] Doanh thu theo thời điểm giao dịch: thu ở kỳ trước, hoàn ở kỳ sau (ra số âm −600.000, không chặn ở 0); kỳ rỗng = 0 (ADM-B46; ADM-B64)', () => {
  const oct = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-10-20T03:00:00Z')] });
  assert.equal(oct.total, 600000);

  const nov = buildRevenue({ spaceById, transactions: [tx('REFUND', 600000, '2026-11-05T03:00:00Z')] });
  assert.equal(nov.total, -600000);

  const both = buildRevenue({
    spaceById,
    transactions: [tx('PAYMENT', 600000, '2026-10-20T03:00:00Z'), tx('REFUND', 600000, '2026-11-05T03:00:00Z')],
  });
  assert.equal(both.total, 0);

  const empty = buildRevenue({ spaceById, transactions: [] });
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.daily, []);
  assert.equal(empty.collected.count, 0);
});

test('TC-ADM-14, TC-ADM-44, TC-ADM-61\t[ADM-14, ADM-44, ADM-61] Lọc Zone: bỏ giao dịch của Booking ngoài Zone; không lọc thì tính đủ và chia theo Zone (ADM-B14; ADM-B44; ADM-B61)', () => {
  const transactions = [
    tx('PAYMENT', 600000, '2026-11-01T03:00:00Z', { spaceId: 's1' }),
    tx('PAYMENT', 600000, '2026-11-01T03:00:00Z', { spaceId: 's3' }),
    tx('PAYMENT', 600000, '2026-11-01T03:00:00Z', { spaceId: 'ghost' }), // Booking của Space đã xóa
  ];
  const all = buildRevenue({ spaceById, transactions });
  assert.equal(all.total, 1800000);
  assert.equal(all.byZone.get('z1').total, 600000);
  assert.equal(all.byZone.get('z2').total, 600000);
  assert.equal(all.byZone.get('null').total, 600000);

  const onlyZ2 = buildRevenue({ spaceById: new Map([['s3', spaces[2]]]), zoneFiltered: true, transactions });
  assert.equal(onlyZ2.total, 600000);
});

test('TC-ADM-20, TC-ADM-62\t[ADM-20, ADM-62] Loại giao dịch lạ và số tiền 0; số tiền REFUND âm vẫn hiểu là số tiền hoàn (ADM-B20; ADM-B62)', () => {
  const r = buildRevenue({
    spaceById,
    transactions: [
      tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'),
      tx('ADJUST', 99999, '2026-11-01T03:00:00Z'),
      tx('PAYMENT', 0, '2026-11-01T03:00:00Z'),
      tx('REFUND', -100000, '2026-11-01T04:00:00Z'),
    ],
  });
  assert.equal(r.total, 500000);
});

test('TC-ADM-42, TC-ADM-44\t[ADM-42, ADM-44] Zone chỉ có giao dịch (không có đơn bắt đầu trong kỳ) vẫn hiện doanh thu trong zones[] (ADM-B42; ADM-B44)', () => {
  const revenue = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z', { spaceId: 's3' })] });
  const r = buildZoneStats({ range: range2Days, spaces, zones, bookingGroups: [], revenue });
  const comm = r.zones.find((z) => z.zoneCode === 'Z-COMM');
  assert.equal(comm.revenue.total, 600000);
  assert.equal(comm.bookings.total, 0);
});

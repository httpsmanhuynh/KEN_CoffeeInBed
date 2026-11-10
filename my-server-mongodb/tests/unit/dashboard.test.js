'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOKING_STATUSES, PAID_STATUSES, parseDateRange, parseClock, openHoursOf, parseLimit,
  allocateAmount, buildRevenue, buildZoneStats, rankTopAddons, normalizeAddonLine,
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
const g = (space, status, count, hours = 0, guestHours = 0) => ({ _id: { space, status }, count, hours, guestHours });

test('TC-DSH-09 luôn đủ 7 trạng thái (kể cả 0) và đúng thứ tự khóa', () => {
  const r = buildZoneStats({ range, spaces, zones, bookingGroups: [] });
  assert.deepEqual(Object.keys(r.totals.bookings.byStatus), BOOKING_STATUSES);
  assert.equal(r.totals.bookings.total, 0);
  assert.ok(r.zones.every((z) => z.revenue.total === 0 && z.revenue.breakdown.package === 0)); // chưa có giao dịch -> doanh thu 0
});

test('TC-DSH-10 số đơn đếm đủ 7 trạng thái; chỉ 4 trạng thái đã thanh toán & chưa hủy chiếm chỗ', () => {
  const r = buildZoneStats({
    range, spaces, zones,
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
  assert.equal(r.totals.occupancy.occupiedHours, 8); // 4 + 2 + 1 + 1; CANCELLED/EXPIRED/PENDING không tính
  assert.equal('revenue' in r.totals, false); // doanh thu tính riêng bằng buildRevenue (theo giao dịch)
});

test('TC-DSH-11 occupancy EXCLUSIVE = giờ đặt / (ngày × giờ mở cửa)', () => {
  // s1: 14h × 2 ngày = 28h khả dụng; đã dùng 7h => 25%
  const r = buildZoneStats({ range, spaces: [spaces[0]], zones, bookingGroups: [g('s1', 'CHECKED_OUT', 2, 7)] });
  assert.equal(r.totals.occupancy.rate, 25);
  assert.equal(r.totals.occupancy.availableHours, 28);
  assert.equal(r.totals.occupancy.occupiedHours, 7);
});

test('TC-DSH-12 occupancy SHARED quy đổi theo sức chứa (giờ-khách / capacity)', () => {
  // s3: capacity 10, 28h khả dụng; 70 giờ-khách = 7 giờ-không-gian => 25%
  const r = buildZoneStats({ range, spaces: [spaces[2]], zones, bookingGroups: [g('s3', 'CONFIRMED', 5, 20, 70)] });
  assert.equal(r.totals.occupancy.rate, 25);
});

test('TC-DSH-13 đơn hủy/hết hạn/chờ thanh toán không chiếm chỗ', () => {
  const r = buildZoneStats({
    range, spaces: [spaces[0]], zones,
    bookingGroups: [g('s1', 'CANCELLED', 1, 3), g('s1', 'EXPIRED', 1, 3), g('s1', 'PENDING_PAYMENT', 1, 3)],
  });
  assert.equal(r.totals.occupancy.rate, 0);
});

test('TC-DSH-14 space INACTIVE không vào mẫu số, trừ khi có giờ dùng trong kỳ', () => {
  const a = buildZoneStats({ range, spaces, zones, bookingGroups: [] });
  assert.equal(a.totals.occupancy.availableHours, 3 * 28); // s1,s2,s3
  const b = buildZoneStats({ range, spaces, zones, bookingGroups: [g('s4', 'CHECKED_OUT', 1, 2)] });
  assert.equal(b.totals.occupancy.availableHours, 4 * 28);
});

test('TC-DSH-15 tách theo Zone & tổng khớp tổng các Zone (số đơn); doanh thu Zone lấy từ buildRevenue', () => {
  const spaceById = new Map(spaces.map((x) => [String(x._id), x]));
  const revenue = buildRevenue({
    spaceById,
    transactions: [
      { type: 'PAYMENT', amount: 300000, at: '2026-11-01T03:00:00Z', spaceId: 's1', final: 300000 },
      { type: 'PAYMENT', amount: 120000, at: '2026-11-01T04:00:00Z', spaceId: 's3', final: 120000 },
    ],
  });
  const r = buildZoneStats({
    range, spaces, zones, revenue,
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
  assert.equal(r.totals.bookings.total, 3);
  assert.equal(priv.spaceCount, 2);
});

test('TC-DSH-16 bỏ qua nhóm thuộc space ngoài phạm vi lọc và trạng thái lạ', () => {
  const r = buildZoneStats({
    range, spaces: [spaces[0]], zones,
    bookingGroups: [g('s3', 'CONFIRMED', 9), g('s1', 'WEIRD', 4), g('s1', 'CONFIRMED', 1)],
  });
  assert.equal(r.totals.bookings.total, 1);
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

/* ------------------------------------------------ Doanh thu thực thu (Report B.3.30, UC-29, UC-31) */
const spaceById = new Map(spaces.map((x) => [String(x._id), x]));
// Đơn mẫu: Package 500.000 + Inclusion 59.000 + Add-on 100.000 − Voucher 50.000 − Hạng 9.000 = 600.000
const SNAP = { final: 600000, inclusion: 59000, addon: 100000, voucherDiscount: 50000, tierDiscount: 9000 };
const tx = (type, amount, at, extra = {}) => ({ type, amount, at, spaceId: 's1', ...SNAP, ...extra });

test('TC-DSH-20 doanh thu = Σ PAYMENT − Σ REFUND thành công; không phụ thuộc trạng thái đơn', () => {
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

test('TC-DSH-21 đơn CANCELLED đã hoàn đủ bù trừ về 0; hoàn một phần chỉ giảm đúng số đã hoàn', () => {
  const full = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'), tx('REFUND', 600000, '2026-11-01T04:00:00Z')] });
  assert.equal(full.total, 0);
  assert.deepEqual(full.breakdown, { package: 0, inclusionSurcharge: 0, addon: 0, discount: 0 });
  const partial = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'), tx('REFUND', 450000, '2026-11-01T04:00:00Z')] });
  assert.equal(partial.total, 150000); // phần phí hủy giữ lại vẫn là doanh thu
});

test('TC-DSH-22 hoàn tiền FAILED/PENDING không vào doanh thu nên chưa trừ; đối soát ghi REFUND mới thì mới trừ', () => {
  // Pipeline chỉ lấy giao dịch SUCCESS; ở đây mô phỏng đúng đầu vào của buildRevenue.
  const before = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z')] });
  assert.equal(before.total, 600000);
  const after = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z'), tx('REFUND', 600000, '2026-11-03T03:00:00Z')] });
  assert.equal(after.total, 0);
});

test('TC-DSH-23 phân rã: Package + Inclusion + Add-on − Giảm giá = doanh thu', () => {
  const r = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z')] });
  assert.deepEqual(r.breakdown, { package: 500000, inclusionSurcharge: 59000, addon: 100000, discount: 59000 });
  const b = r.breakdown;
  assert.equal(b.package + b.inclusionSurcharge + b.addon - b.discount, r.total);
  assert.equal(r.total, 600000);
});

test('TC-DSH-24 phân rã vẫn khớp tổng khi hoàn một phần (chia theo tỷ lệ, làm tròn dồn vào Package)', () => {
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

test('TC-DSH-25 doanh thu theo thời điểm giao dịch, ngày giờ VN, tăng dần; Σ daily = tổng', () => {
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

test('TC-DSH-26 kỳ chỉ có hoàn tiền cho ra doanh thu âm (không chặn ở 0); kỳ rỗng = 0', () => {
  const neg = buildRevenue({ spaceById, transactions: [tx('REFUND', 150000, '2026-11-05T03:00:00Z')] });
  assert.equal(neg.total, -150000);
  const empty = buildRevenue({ spaceById, transactions: [] });
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.daily, []);
  assert.equal(empty.collected.count, 0);
});

test('TC-DSH-27 lọc Zone: bỏ giao dịch của Booking ngoài Zone; không lọc thì tính đủ và chia theo Zone', () => {
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

test('TC-DSH-28 loại loại giao dịch lạ và số tiền 0; số tiền REFUND âm vẫn được hiểu là số tiền hoàn', () => {
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

test('TC-DSH-29 Zone chỉ có giao dịch (không có đơn bắt đầu trong kỳ) vẫn hiện doanh thu trong zones[]', () => {
  const revenue = buildRevenue({ spaceById, transactions: [tx('PAYMENT', 600000, '2026-11-01T03:00:00Z', { spaceId: 's3' })] });
  const r = buildZoneStats({ range, spaces, zones, bookingGroups: [], revenue });
  const comm = r.zones.find((z) => z.zoneCode === 'Z-COMM');
  assert.equal(comm.revenue.total, 600000);
  assert.equal(comm.bookings.total, 0);
});

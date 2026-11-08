'use strict';

/**
 * Domain thuần (không phụ thuộc DB) cho Dashboard Admin — Module 11.
 * Mọi hàm ở đây nhận dữ liệu đã lấy sẵn và trả kết quả, để unit test không cần MongoDB.
 */

const { AdminError } = require('./adminError');

/** 7 trạng thái đơn (bookingStateMachine). */
const BOOKING_STATUSES = Object.freeze([
  'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED', 'EXPIRED',
]);

/** Trạng thái được tính là doanh thu thực tế (đọc từ Price Snapshot `final_amount`). */
const REVENUE_STATUSES = Object.freeze(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW']);

/** Trạng thái được tính là đã chiếm chỗ khi tính Occupancy Rate (cùng tập với doanh thu). */
const OCCUPANCY_STATUSES = REVENUE_STATUSES;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const DEFAULT_OPEN_HOURS = 14; // 08:00–22:00, dùng khi open_time/close_time không đọc được

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function pct(num, den) {
  return den > 0 ? round2((num / den) * 100) : 0;
}

/* ---------------------------------------------------------------- khoảng thời gian */

function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, mo, d };
}

function vnDayStart({ y, mo, d }) {
  return new Date(Date.UTC(y, mo - 1, d) - VN_OFFSET_MS);
}

function ymdString(date) {
  const v = new Date(date.getTime() + VN_OFFSET_MS);
  return v.toISOString().slice(0, 10);
}

/**
 * Chuyển `from`/`to` (YYYY-MM-DD, giờ Việt Nam, gồm cả ngày `to`) thành khoảng [from, toExclusive).
 * Mặc định: 30 ngày gần nhất kết thúc hôm nay.
 */
function parseDateRange(query = {}, now = new Date()) {
  const today = ymdString(now);
  const hasFrom = query.from != null && String(query.from).trim() !== '';
  const hasTo = query.to != null && String(query.to).trim() !== '';

  const toParts = hasTo ? parseYmd(query.to) : parseYmd(today);
  if (!toParts) throw new AdminError(422, 'INVALID_DATE', 'Tham số `to` phải có dạng YYYY-MM-DD.');
  const toStart = vnDayStart(toParts);

  let fromStart;
  if (hasFrom) {
    const fromParts = parseYmd(query.from);
    if (!fromParts) throw new AdminError(422, 'INVALID_DATE', 'Tham số `from` phải có dạng YYYY-MM-DD.');
    fromStart = vnDayStart(fromParts);
  } else {
    fromStart = new Date(toStart.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  }

  if (fromStart.getTime() > toStart.getTime()) {
    throw new AdminError(422, 'INVALID_RANGE', '`from` phải nhỏ hơn hoặc bằng `to`.');
  }
  const toExclusive = new Date(toStart.getTime() + DAY_MS);
  const days = Math.round((toExclusive.getTime() - fromStart.getTime()) / DAY_MS);
  if (days > MAX_RANGE_DAYS) {
    throw new AdminError(422, 'RANGE_TOO_LARGE', `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày.`);
  }
  return {
    from: fromStart,
    to: toExclusive,
    days,
    fromDate: ymdString(fromStart),
    toDate: ymdString(new Date(toExclusive.getTime() - DAY_MS)),
    timezone: 'Asia/Ho_Chi_Minh',
  };
}

/* ---------------------------------------------------------------- giờ mở cửa */

/** 'HH:mm' | 'HH:mm:ss' -> số giờ (float); không đọc được -> null. */
function parseClock(v) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(v == null ? '' : v).trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 24 || mi > 59) return null;
  return h + mi / 60;
}

function openHoursOf(space) {
  const open = parseClock(space && space.open_time);
  const close = parseClock(space && space.close_time);
  if (open == null || close == null || close <= open) return DEFAULT_OPEN_HOURS;
  return close - open;
}

/* ---------------------------------------------------------------- tổng hợp theo Zone */

function zeroStatuses() {
  const o = {};
  for (const s of BOOKING_STATUSES) o[s] = 0;
  return o;
}

function zeroRevenue() {
  const o = {};
  for (const s of REVENUE_STATUSES) o[s] = 0;
  return o;
}

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

/**
 * @param {object}   p
 * @param {object}   p.range          kết quả parseDateRange
 * @param {object[]} p.spaces         spaces (đã lọc theo zone nếu có): _id, zone_id, space_code, name, booking_mode, capacity, open_time, close_time, status
 * @param {object[]} p.zones          zones: _id, zone_code, name
 * @param {object[]} p.bookingGroups  kết quả $group: { _id:{space,status}, count, revenue, hours, guestHours }
 */
function buildZoneStats({ range, spaces, zones, bookingGroups }) {
  const spaceById = new Map(spaces.map((s) => [String(s._id), s]));
  const zoneInfo = new Map(zones.map((z) => [String(z._id), z]));

  // Số giờ-không-gian đã dùng theo từng space.
  // EXCLUSIVE: số giờ đặt. SHARED: giờ-khách / sức chứa (quy đổi ra giờ-không-gian) để cùng đơn vị với mẫu số.
  const usedSpaceHours = new Map();
  const zoneAgg = new Map();

  const ensureZone = (zoneId) => {
    const key = String(zoneId);
    if (!zoneAgg.has(key)) {
      const z = zoneInfo.get(key);
      zoneAgg.set(key, {
        zoneId: key === 'null' || key === 'undefined' ? null : key,
        zoneCode: z ? z.zone_code : null,
        name: z ? z.name : 'Không rõ khu vực',
        spaceCount: 0,
        byStatus: zeroStatuses(),
        revenueByStatus: zeroRevenue(),
        occupiedSpaceHours: 0,
        availableSpaceHours: 0,
      });
    }
    return zoneAgg.get(key);
  };

  for (const g of bookingGroups) {
    const spaceId = String(g._id.space);
    const status = g._id.status;
    if (!BOOKING_STATUSES.includes(status)) continue;
    const space = spaceById.get(spaceId);
    if (!space) continue; // không thuộc phạm vi lọc (hoặc space đã bị xóa)
    const z = ensureZone(space.zone_id);

    z.byStatus[status] += g.count || 0;
    if (REVENUE_STATUSES.includes(status)) z.revenueByStatus[status] += g.revenue || 0;
    if (OCCUPANCY_STATUSES.includes(status)) {
      const used = space.booking_mode === 'SHARED'
        ? (space.capacity > 0 ? (g.guestHours || 0) / space.capacity : 0)
        : (g.hours || 0);
      usedSpaceHours.set(spaceId, (usedSpaceHours.get(spaceId) || 0) + used);
    }
  }

  // Mẫu số: space ACTIVE, hoặc space đã có giờ dùng trong kỳ (vd. vừa chuyển MAINTENANCE).
  for (const space of spaces) {
    const used = usedSpaceHours.get(String(space._id)) || 0;
    if (space.status !== 'ACTIVE' && used <= 0) continue;
    const z = ensureZone(space.zone_id);
    z.spaceCount += 1;
    z.availableSpaceHours += range.days * openHoursOf(space);
    z.occupiedSpaceHours += used;
  }

  const zonesOut = [...zoneAgg.values()].map((z) => {
    const revenue = sum(z.revenueByStatus);
    return {
      zoneId: z.zoneId,
      zoneCode: z.zoneCode,
      name: z.name,
      spaceCount: z.spaceCount,
      bookings: { total: sum(z.byStatus), byStatus: z.byStatus },
      occupancy: {
        rate: pct(z.occupiedSpaceHours, z.availableSpaceHours),
        occupiedHours: round2(z.occupiedSpaceHours),
        availableHours: round2(z.availableSpaceHours),
      },
      revenue: { total: revenue, byStatus: z.revenueByStatus },
    };
  }).sort((a, b) => String(a.zoneCode).localeCompare(String(b.zoneCode)));

  // Tổng toàn bộ
  const totalStatuses = zeroStatuses();
  const totalRevenue = zeroRevenue();
  let occ = 0, avail = 0;
  for (const z of zoneAgg.values()) {
    for (const s of BOOKING_STATUSES) totalStatuses[s] += z.byStatus[s];
    for (const s of REVENUE_STATUSES) totalRevenue[s] += z.revenueByStatus[s];
    occ += z.occupiedSpaceHours;
    avail += z.availableSpaceHours;
  }

  return {
    zones: zonesOut,
    totals: {
      bookings: { total: sum(totalStatuses), byStatus: totalStatuses },
      occupancy: { rate: pct(occ, avail), occupiedHours: round2(occ), availableHours: round2(avail) },
      revenue: { total: sum(totalRevenue), byStatus: totalRevenue },
    },
  };
}

/* ---------------------------------------------------------------- Top Add-on */

/**
 * Chuẩn hóa 1 dòng `booking_addons` (Price Snapshot). Chấp nhận vài tên field phổ biến
 * vì tên chính xác nằm trong booking_addons.validator.json — xác nhận lại khi tích hợp.
 */
function normalizeAddonLine(line, names = new Map()) {
  const a = line || {};
  const qty = Number(a.quantity != null ? a.quantity : (a.qty != null ? a.qty : 1)) || 0;
  const unit = Number(a.unit_price != null ? a.unit_price : (a.unit_price_snapshot != null ? a.unit_price_snapshot : a.price)) || 0;
  const rawTotal = a.line_total != null ? a.line_total : (a.total_price != null ? a.total_price : (a.total != null ? a.total : a.subtotal));
  const revenue = rawTotal != null ? Number(rawTotal) || 0 : unit * qty;
  const key = a.addon_id != null ? String(a.addon_id) : null;
  const name = a.addon_name || a.name || a.name_snapshot || (key && names.get(key)) || 'Không rõ';
  return { key: key || `name:${name}`, addonId: key, name, quantity: qty, revenue, bookingId: a.booking_id != null ? String(a.booking_id) : null };
}

function rankTopAddons(lines, { names = new Map(), limit = 5 } = {}) {
  const agg = new Map();
  for (const raw of lines) {
    const l = normalizeAddonLine(raw, names);
    if (l.quantity <= 0) continue;
    let e = agg.get(l.key);
    if (!e) {
      e = { addonId: l.addonId, name: l.name, quantity: 0, revenue: 0, bookingIds: new Set() };
      agg.set(l.key, e);
    }
    e.quantity += l.quantity;
    e.revenue += l.revenue;
    if (l.bookingId) e.bookingIds.add(l.bookingId);
  }
  return [...agg.values()]
    .map((e) => ({ addonId: e.addonId, name: e.name, quantity: e.quantity, revenue: e.revenue, bookings: e.bookingIds.size }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

function parseLimit(v, def = 5, max = 20) {
  if (v == null || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new AdminError(422, 'INVALID_LIMIT', '`topAddons` phải là số nguyên dương.');
  return Math.min(n, max);
}

module.exports = {
  BOOKING_STATUSES, REVENUE_STATUSES, OCCUPANCY_STATUSES,
  VN_OFFSET_MS, DEFAULT_RANGE_DAYS, MAX_RANGE_DAYS,
  parseDateRange, parseClock, openHoursOf, parseLimit,
  buildZoneStats, normalizeAddonLine, rankTopAddons,
  round2, pct,
};

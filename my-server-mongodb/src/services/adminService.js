'use strict';

/**
 * Dịch vụ Admin Management & Dashboard (Module 11).
 * Quy ước như bookingService: hàm nhận `db` làm tham số đầu tiên.
 */

const { ObjectId } = require('mongodb');
const { AdminError } = require('../domain/adminError');
const { sanitizeUser, loyaltyOf, tierFilter, decideStatusChange } = require('../domain/adminUser');
const {
  BOOKING_STATUSES, PAID_STATUSES, REVENUE_TX_TYPES,
  parseDateRange, parseLimit, buildRevenue, buildZoneStats, rankTopAddons,
} = require('../domain/dashboard');

/**
 * Nguồn doanh thu: giao dịch `payment_transactions` (PAYMENT cộng, REFUND trừ, chỉ status SUCCESS),
 * tính theo thời điểm giao dịch. Tên field chính xác nằm trong payment_transactions.validator.json —
 * XÁC NHẬN lại khi tích hợp (chỉ cần sửa tại đây).
 */
const PAYMENT_TX = Object.freeze({
  collection: 'payment_transactions',
  typeField: 'type',
  statusField: 'status',
  successStatus: 'SUCCESS',
  bookingField: 'booking_id',
  amountField: 'amount',
  dateFields: ['processed_at', 'paid_at', 'created_at'],
});

/**
 * Field Price Snapshot trên `bookings` dùng để phân rã doanh thu (Package, Phụ phí Inclusion, Add-on, Giảm giá).
 * Package là phần còn lại nên không cần field riêng. XÁC NHẬN lại tên field khi tích hợp.
 */
const BOOKING_SNAPSHOT = Object.freeze({
  final: ['final_amount'],
  inclusion: ['inclusion_surcharge', 'inclusion_surcharge_total'],
  addon: ['addon_total', 'addons_total'],
  voucherDiscount: ['voucher_discount'],
  tierDiscount: ['tier_discount'],
});

/* ---------------------------------------------------------------- helpers */

function toOid(v) {
  if (v instanceof ObjectId) return v;
  if (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)) return new ObjectId(v);
  return null;
}

function mustOid(v, what = 'id') {
  const o = toOid(v);
  if (!o) throw new AdminError(400, 'INVALID_ID', `${what} không hợp lệ.`);
  return o;
}

function parsePaging(query = {}) {
  let page = Number(query.page || 1);
  let limit = Number(query.limit || 20);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  return { page, limit: Math.min(limit, 100) };
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const coalesce = (fields, fallback = null) =>
  fields.reduceRight((acc, f) => ({ $ifNull: [`$${f}`, acc] }), fallback);

/* ---------------------------------------------------------------- Users */

async function listUsers(db, query = {}) {
  const { page, limit } = parsePaging(query);
  const filter = {};
  if (query.status) {
    if (!['ACTIVE', 'LOCKED'].includes(query.status)) throw new AdminError(422, 'INVALID_STATUS', 'status phải là ACTIVE hoặc LOCKED.');
    filter.status = query.status;
  }
  if (query.role) filter.role = String(query.role).toUpperCase();
  const and = [];
  if (query.tier) and.push(tierFilter(query.tier));
  if (query.q && String(query.q).trim()) {
    const rx = new RegExp(escapeRegex(String(query.q).trim()), 'i');
    and.push({ $or: ['phone', 'email', 'full_name', 'name'].map((f) => ({ [f]: rx })) });
  }
  if (and.length) filter.$and = and;

  const col = db.collection('users');
  const [items, total] = await Promise.all([
    col.find(filter).sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  // Gắn số đơn & lần đặt gần nhất cho từng user của trang hiện tại
  const ids = items.map((u) => u._id);
  const stats = ids.length
    ? await db.collection('bookings').aggregate([
      { $match: { user_id: { $in: ids } } },
      { $group: { _id: '$user_id', bookingCount: { $sum: 1 }, lastBookingAt: { $max: '$created_at' } } },
    ]).toArray()
    : [];
  const statById = new Map(stats.map((s) => [String(s._id), s]));

  return {
    items: items.map((u) => {
      const s = statById.get(String(u._id));
      return {
        ...sanitizeUser(u),
        loyalty: loyaltyOf(u),
        bookingCount: s ? s.bookingCount : 0,
        lastBookingAt: s ? s.lastBookingAt : null,
      };
    }),
    page, limit, total, totalPages: Math.ceil(total / limit),
  };
}

async function getUserProfile(db, id) {
  const _id = mustOid(id, 'userId');
  const user = await db.collection('users').findOne({ _id });
  if (!user) throw new AdminError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');

  const groups = await db.collection('bookings').aggregate([
    { $match: { user_id: _id } },
    { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: { $ifNull: ['$final_amount', 0] } } } },
  ]).toArray();

  const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0]));
  let totalSpent = 0;
  for (const g of groups) {
    if (g._id in byStatus) byStatus[g._id] = g.count;
    if (PAID_STATUSES.includes(g._id)) totalSpent += g.amount;
  }
  return {
    user: { ...sanitizeUser(user), loyalty: loyaltyOf(user) },
    bookingStats: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, totalSpent },
  };
}

async function listUserBookings(db, id, query = {}) {
  const _id = mustOid(id, 'userId');
  const exists = await db.collection('users').findOne({ _id }, { projection: { _id: 1 } });
  if (!exists) throw new AdminError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');

  const { page, limit } = parsePaging(query);
  const filter = { user_id: _id };
  if (query.status) {
    if (!BOOKING_STATUSES.includes(query.status)) throw new AdminError(422, 'INVALID_STATUS', 'status không thuộc 7 trạng thái đơn.');
    filter.status = query.status;
  }

  const col = db.collection('bookings');
  const [items, total] = await Promise.all([
    col.find(filter).sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    col.countDocuments(filter),
  ]);

  const spaceIds = [...new Set(items.map((b) => String(b.space_id)))].map((s) => new ObjectId(s));
  const spaces = spaceIds.length
    ? await db.collection('spaces').find({ _id: { $in: spaceIds } }, { projection: { name: 1, space_code: 1, zone_id: 1 } }).toArray()
    : [];
  const spaceById = new Map(spaces.map((s) => [String(s._id), s]));

  return {
    items: items.map((b) => {
      const s = spaceById.get(String(b.space_id));
      return { ...b, space: s ? { _id: s._id, space_code: s.space_code, name: s.name, zone_id: s.zone_id } : null };
    }),
    page, limit, total, totalPages: Math.ceil(total / limit),
  };
}

/**
 * Khóa / Mở khóa tài khoản (ACTIVE <-> LOCKED).
 * Cập nhật nguyên tử theo trạng thái nguồn để 2 Admin thao tác song song không ghi đè nhau.
 * Chỉ ghi field `status` (validator users dùng additionalProperties:false).
 * BR-A05: tài khoản LOCKED không đăng nhập và không đặt chỗ mới. Cơ chế: requireAuth đọc lại DB nên session
 * đang đăng nhập bị thu hồi ở request kế tiếp (mọi route cần đăng nhập, gồm đặt chỗ, trả 401).
 * Khóa không đổi trạng thái các Booking đã có của khách.
 */
async function setUserStatus(db, { actor, targetId, action }) {
  const _id = mustOid(targetId, 'userId');
  const users = db.collection('users');
  const target = await users.findOne({ _id });
  const { from, to } = decideStatusChange({ actorId: actor && actor._id, target, action });

  const cond = { _id, status: from };
  if (action === 'lock') cond.role = { $ne: 'ADMIN' };
  const res = await users.updateOne(cond, { $set: { status: to } });
  if (!res.matchedCount) {
    throw new AdminError(409, 'USER_STATE_CHANGED', 'Trạng thái tài khoản vừa bị thay đổi, vui lòng tải lại.');
  }
  const updated = await users.findOne({ _id });
  return sanitizeUser(updated);
}

/* ---------------------------------------------------------------- Dashboard */

async function resolveZone(db, zoneParam) {
  if (zoneParam == null || String(zoneParam).trim() === '') return null;
  const raw = String(zoneParam).trim();
  const oid = toOid(raw);
  const zone = await db.collection('zones').findOne(oid ? { $or: [{ _id: oid }, { zone_code: raw }] } : { zone_code: raw });
  if (!zone) throw new AdminError(404, 'ZONE_NOT_FOUND', 'Không tìm thấy khu vực.');
  return zone;
}

/**
 * Giao dịch tham gia doanh thu trong kỳ (PAYMENT/REFUND, SUCCESS, theo thời điểm giao dịch),
 * kèm Price Snapshot của Booking để phân rã. Việc cộng/trừ và chia Zone làm ở domain `buildRevenue`.
 */
async function revenueTransactions(db, range) {
  const snap = (fields) => coalesce(fields.map((f) => `__b.${f}`), 0);
  return db.collection(PAYMENT_TX.collection).aggregate([
    { $match: {
      [PAYMENT_TX.statusField]: PAYMENT_TX.successStatus,
      [PAYMENT_TX.typeField]: { $in: Object.keys(REVENUE_TX_TYPES) },
      $or: PAYMENT_TX.dateFields.map((f) => ({ [f]: { $gte: range.from, $lt: range.to } })),
    } },
    { $addFields: { __at: coalesce(PAYMENT_TX.dateFields) } },
    { $match: { __at: { $gte: range.from, $lt: range.to } } },
    { $lookup: { from: 'bookings', localField: PAYMENT_TX.bookingField, foreignField: '_id', as: '__b' } },
    { $unwind: { path: '$__b', preserveNullAndEmptyArrays: true } },
    { $project: {
      _id: 0,
      type: `$${PAYMENT_TX.typeField}`,
      amount: `$${PAYMENT_TX.amountField}`,
      at: '$__at',
      spaceId: '$__b.space_id',
      final: snap(BOOKING_SNAPSHOT.final),
      inclusion: snap(BOOKING_SNAPSHOT.inclusion),
      addon: snap(BOOKING_SNAPSHOT.addon),
      voucherDiscount: snap(BOOKING_SNAPSHOT.voucherDiscount),
      tierDiscount: snap(BOOKING_SNAPSHOT.tierDiscount),
    } },
  ]).toArray();
}

/**
 * GET dashboard — 4 nhóm chỉ số theo Zone & khoảng thời gian (Report B.3.30, UC-29, UC-31):
 *  - số đơn theo 7 trạng thái, Occupancy Rate, Top Add-on: lọc theo `bookings.start_at` (ngày sử dụng);
 *  - doanh thu thực thu: Σ PAYMENT − Σ REFUND thành công, lọc theo thời điểm giao dịch, kèm phân rã.
 * F&B bán trực tiếp tại quầy (POS) nằm ngoài phạm vi hệ thống nên không có trong Dashboard.
 */
async function getDashboard(db, query = {}, now = new Date()) {
  const range = parseDateRange(query, now);
  const topLimit = parseLimit(query.topAddons);
  const zone = await resolveZone(db, query.zoneId);

  const spaceFilter = zone ? { zone_id: zone._id } : {};
  const [spaces, zones] = await Promise.all([
    db.collection('spaces').find(spaceFilter, {
      projection: { zone_id: 1, space_code: 1, name: 1, booking_mode: 1, capacity: 1, open_time: 1, close_time: 1, status: 1 },
    }).toArray(),
    db.collection('zones').find({}, { projection: { zone_code: 1, name: 1 } }).toArray(),
  ]);
  const spaceIds = zone ? spaces.map((s) => s._id) : null;

  const bookingMatch = { start_at: { $gte: range.from, $lt: range.to } };
  if (spaceIds) bookingMatch.space_id = { $in: spaceIds };

  // Thời lượng (giờ), cắt ở cuối kỳ để đơn vắt qua ranh giới không vượt 100%
  const hoursExpr = { $max: [0, { $divide: [{ $subtract: [{ $min: ['$end_at', range.to] }, '$start_at'] }, 3600000] }] };
  const occupiedHours = { $cond: [{ $in: ['$status', PAID_STATUSES] }, hoursExpr, 0] };

  const addonPipeline = [
    { $match: { ...bookingMatch, status: { $in: PAID_STATUSES } } },
    { $lookup: { from: 'booking_addons', localField: '_id', foreignField: 'booking_id', as: 'addons' } },
    { $unwind: '$addons' },
    { $replaceRoot: { newRoot: '$addons' } },
  ];

  const [bookingGroups, addonLines, addonCatalog, txRows] = await Promise.all([
    db.collection('bookings').aggregate([
      { $match: bookingMatch },
      { $group: {
        _id: { space: '$space_id', status: '$status' },
        count: { $sum: 1 },
        hours: { $sum: occupiedHours },
        guestHours: { $sum: { $multiply: [occupiedHours, { $ifNull: ['$guest_count', 0] }] } },
      } },
    ]).toArray(),
    db.collection('bookings').aggregate(addonPipeline).toArray(),
    db.collection('addons').find({}, { projection: { name: 1 } }).toArray(),
    revenueTransactions(db, range),
  ]);

  const revenue = buildRevenue({
    transactions: txRows,
    spaceById: new Map(spaces.map((sp) => [String(sp._id), sp])),
    zoneFiltered: !!zone,
  });
  const stats = buildZoneStats({ range, spaces, zones, bookingGroups, revenue });
  const names = new Map(addonCatalog.map((a) => [String(a._id), a.name]));

  const result = {
    range: { from: range.fromDate, to: range.toDate, days: range.days, timezone: range.timezone },
    filters: { zoneId: zone ? String(zone._id) : null, zoneCode: zone ? zone.zone_code : null },
    bookings: stats.totals.bookings,
    occupancy: stats.totals.occupancy,
    revenue: {
      basis: 'TRANSACTION_TIME',
      total: revenue.total,
      breakdown: revenue.breakdown,
      collected: revenue.collected,
      refunded: revenue.refunded,
    },
    topAddons: rankTopAddons(addonLines, { names, limit: topLimit }),
    zones: stats.zones,
  };
  if (String(query.groupBy || '') === 'day') result.daily = revenue.daily;
  return result;
}

module.exports = {
  PAYMENT_TX, BOOKING_SNAPSHOT,
  listUsers, getUserProfile, listUserBookings, setUserStatus, getDashboard,
};

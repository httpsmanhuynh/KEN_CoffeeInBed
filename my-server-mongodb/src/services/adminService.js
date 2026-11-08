'use strict';

/**
 * Dịch vụ Admin Management & Dashboard (Module 11).
 * Quy ước như bookingService: hàm nhận `db` làm tham số đầu tiên.
 */

const { ObjectId } = require('mongodb');
const { AdminError } = require('../domain/adminError');
const { sanitizeUser, decideStatusChange } = require('../domain/adminUser');
const {
  BOOKING_STATUSES, REVENUE_STATUSES, OCCUPANCY_STATUSES,
  parseDateRange, parseLimit, buildZoneStats, rankTopAddons,
} = require('../domain/dashboard');

/**
 * Collection bán F&B trực tiếp. Tên field chính xác nằm trong sales_transactions.validator.json —
 * XÁC NHẬN lại 3 mảng dưới đây khi tích hợp (chỉ cần sửa tại đây).
 */
const FNB = Object.freeze({
  collection: 'sales_transactions',
  dateFields: ['sold_at', 'transaction_date', 'created_at'],
  amountFields: ['total_amount', 'line_total', 'amount'],
  qtyFields: ['quantity', 'transaction_qty'],
  unitPriceFields: ['unit_price', 'price'],
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
  if (query.tier) filter.tier = String(query.tier).toUpperCase();
  if (query.q && String(query.q).trim()) {
    const rx = new RegExp(escapeRegex(String(query.q).trim()), 'i');
    filter.$or = ['phone', 'email', 'full_name', 'name'].map((f) => ({ [f]: rx }));
  }

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
      return { ...sanitizeUser(u), bookingCount: s ? s.bookingCount : 0, lastBookingAt: s ? s.lastBookingAt : null };
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
    if (REVENUE_STATUSES.includes(g._id)) totalSpent += g.amount;
  }
  return {
    user: sanitizeUser(user),
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
 * Session đang đăng nhập bị thu hồi ở request kế tiếp nhờ requireAuth đọc lại DB (BR-A05).
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

async function fnbDirectRevenue(db, range) {
  const dateExpr = coalesce(FNB.dateFields);
  const amountExpr = coalesce(FNB.amountFields, {
    $multiply: [{ $ifNull: [coalesce(FNB.qtyFields), 0] }, { $ifNull: [coalesce(FNB.unitPriceFields), 0] }],
  });
  const rows = await db.collection(FNB.collection).aggregate([
    { $match: { $or: FNB.dateFields.map((f) => ({ [f]: { $gte: range.from, $lt: range.to } })) } },
    { $addFields: { __d: dateExpr, __a: amountExpr } },
    { $match: { __d: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: null, total: { $sum: '$__a' }, transactions: { $sum: 1 } } },
  ]).toArray();
  const r = rows[0] || { total: 0, transactions: 0 };
  return { total: r.total, transactions: r.transactions, scope: 'ALL_ZONES' };
}

async function dailySeries(db, range, spaceIds) {
  const match = { start_at: { $gte: range.from, $lt: range.to }, status: { $in: REVENUE_STATUSES } };
  if (spaceIds) match.space_id = { $in: spaceIds };
  const rows = await db.collection('bookings').aggregate([
    { $match: match },
    { $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$start_at', timezone: '+07:00' } },
      bookings: { $sum: 1 },
      revenue: { $sum: { $ifNull: ['$final_amount', 0] } },
    } },
    { $sort: { _id: 1 } },
  ]).toArray();
  return rows.map((r) => ({ date: r._id, bookings: r.bookings, revenue: r.revenue }));
}

/**
 * GET dashboard: số đơn theo 7 trạng thái, Occupancy Rate, doanh thu thực tế (Price Snapshot),
 * Top Add-on và doanh thu F&B trực tiếp — theo Zone & khoảng thời gian (lọc theo `start_at`).
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
  const occupiedHours = { $cond: [{ $in: ['$status', OCCUPANCY_STATUSES] }, hoursExpr, 0] };

  const addonPipeline = [
    { $match: { ...bookingMatch, status: { $in: REVENUE_STATUSES } } },
    { $lookup: { from: 'booking_addons', localField: '_id', foreignField: 'booking_id', as: 'addons' } },
    { $unwind: '$addons' },
    { $replaceRoot: { newRoot: '$addons' } },
  ];

  const [bookingGroups, addonLines, addonCatalog, fnb, daily] = await Promise.all([
    db.collection('bookings').aggregate([
      { $match: bookingMatch },
      { $group: {
        _id: { space: '$space_id', status: '$status' },
        count: { $sum: 1 },
        revenue: { $sum: { $ifNull: ['$final_amount', 0] } },
        hours: { $sum: occupiedHours },
        guestHours: { $sum: { $multiply: [occupiedHours, { $ifNull: ['$guest_count', 0] }] } },
      } },
    ]).toArray(),
    db.collection('bookings').aggregate(addonPipeline).toArray(),
    db.collection('addons').find({}, { projection: { name: 1 } }).toArray(),
    fnbDirectRevenue(db, range),
    String(query.groupBy || '') === 'day' ? dailySeries(db, range, spaceIds) : Promise.resolve(null),
  ]);

  const stats = buildZoneStats({ range, spaces, zones, bookingGroups });
  const names = new Map(addonCatalog.map((a) => [String(a._id), a.name]));

  const result = {
    range: { from: range.fromDate, to: range.toDate, days: range.days, timezone: range.timezone },
    filters: { zoneId: zone ? String(zone._id) : null, zoneCode: zone ? zone.zone_code : null },
    bookings: stats.totals.bookings,
    occupancy: stats.totals.occupancy,
    revenue: {
      bookings: stats.totals.revenue,
      fnbDirect: fnb,
      grandTotal: stats.totals.revenue.total + fnb.total,
    },
    topAddons: rankTopAddons(addonLines, { names, limit: topLimit }),
    zones: stats.zones,
  };
  if (daily) result.daily = daily;
  return result;
}

module.exports = {
  FNB,
  listUsers, getUserProfile, listUserBookings, setUserStatus, getDashboard,
};

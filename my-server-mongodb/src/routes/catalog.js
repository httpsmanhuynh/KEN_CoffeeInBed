'use strict';
// Danh mục, Khám phá chỗ trống (BR-D01) & Quản trị Catalog CRUD (UC-18..22, UC-29..30):
// - Customer/Public:
//   Bước 1 (UC-04): Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách — Read-only BR-C07)
//   Bước 2 (UC-05): Chọn Không gian (Space) & Gói dịch vụ (Package)
//   Bước 3 (UC-06): Danh mục món trong gói (Inclusion) & Dịch vụ mua thêm (Add-on)
//   Bước 4 (UC-07): Danh mục Voucher áp dụng tại Checkout.
// - Admin CRUD (requireRole('ADMIN')):
//   zones, spaces, packages, package_prices (/pricing), package_inclusions, products, addons, recipes, vouchers.
const express = require('express');
const { ObjectId } = require('mongodb');
const { requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { wrap, fail, str, isDup } = require('../utils/http');
const {
  BookingError,
  resolveTimeWindow,
  evaluateSpaceAvailability,
  searchAvailableSpaces,
} = require('../services/bookingService');
const { listSpaceReviews } = require('../services/reviewService');
const { AdminError } = require('../domain/adminError');
const { getBookingMenuRecommendations } = require('../services/forecastService');
const { resolveOptionalUser } = require('./forecast');

const router = express.Router();
const adminLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });
const ADMIN = [requireRole('ADMIN'), adminLimit];

const oid = (id) => new ObjectId(id);
const validId = (id) => Boolean(id && ObjectId.isValid(id));

function pick(body, keys) {
  const set = {};
  for (const k of keys) {
    if (k in body && body[k] !== undefined) set[k] = body[k];
  }
  return set;
}

function assertMoney(v, name) {
  if (!Number.isInteger(v) || v < 0) {
    throw Object.assign(new Error(`${name} phải là số nguyên VNĐ >= 0`), { status: 422 });
  }
}

function notFound(res, name = 'Mục') {
  return fail(res, 404, 'NOT_FOUND', `${name} không tồn tại`);
}

function badId(res) {
  return fail(res, 422, 'VALIDATION_ERROR', 'id không hợp lệ');
}

const handleErr = (res, err) => {
  if (err instanceof BookingError || err instanceof AdminError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  throw err;
};

// ═══════════════════════════════════════════════════
// 1. ZONES — Khu vực (zones.validator.json)
// ═══════════════════════════════════════════════════
// GET /api/zones — Danh sách khu vực (KÉN Kết Nối, KÉN Tập Trung, KÉN Tái Tạo — UC-04 Bước 1)
router.get(
  '/zones',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    if (req.query.bookable === 'true') filter.is_bookable = true;
    const zones = await db.collection('zones').find(filter).toArray();
    res.json(zones);
  }),
);

// POST /api/zones [ADMIN]
router.post(
  '/zones',
  ...ADMIN,
  wrap(async (req, res) => {
    const name = str(req.body.name);
    if (!name) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
    const zoneCode =
      str(req.body.zoneCode || req.body.zone_code).toUpperCase() ||
      `ZONE_${Date.now().toString(36).toUpperCase()}`;
    const doc = {
      _id: new ObjectId(),
      zone_code: zoneCode.slice(0, 30),
      name: name.slice(0, 50),
      description: req.body.description !== undefined ? str(req.body.description) : null,
      is_bookable: req.body.isBookable !== undefined ? Boolean(req.body.isBookable) : true,
      is_active: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      image_url: str(req.body.imageUrl || req.body.image_url) || '/images/zones/default.jpg',
    };
    const { insertedId } = await req.app.locals.db.collection('zones').insertOne(doc);
    res.status(201).json({ id: String(insertedId), zone: doc });
  }),
);

// PATCH /api/zones/:id [ADMIN]
router.patch(
  '/zones/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const set = pick(req.body, [
      'name',
      'description',
      'is_bookable',
      'is_active',
      'image_url',
      'isBookable',
      'isActive',
      'imageUrl',
    ]);
    if ('name' in set) set.name = str(set.name).slice(0, 50);
    if ('isBookable' in set) {
      set.is_bookable = Boolean(set.isBookable);
      delete set.isBookable;
    }
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    if ('imageUrl' in set) {
      set.image_url = str(set.imageUrl);
      delete set.imageUrl;
    }
    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    const r = await req.app.locals.db.collection('zones').updateOne({ _id: oid(id) }, { $set: set });
    if (!r.matchedCount) return notFound(res, 'Zone');
    res.json({ updated: true });
  }),
);

// DELETE /api/zones/:id [ADMIN] — Soft Delete
router.delete(
  '/zones/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const r = await req.app.locals.db
      .collection('zones')
      .updateOne({ _id: oid(id) }, { $set: { is_active: false } });
    if (!r.matchedCount) return notFound(res, 'Zone');
    res.json({ deleted: true });
  }),
);

// ═══════════════════════════════════════════════════
// 2. SPACES — Không gian (spaces.validator.json)
// ═══════════════════════════════════════════════════
// GET /api/spaces — Bước 1 (UC-04): Khám phá danh sách không gian & Kiểm tra chỗ trống
router.get(
  '/spaces',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const startAt = str(req.query.startAt);
      if (startAt) {
        const enriched = await searchAvailableSpaces(db, {
          zoneId: str(req.query.zoneId) || null,
          startAt,
          endAt: str(req.query.endAt) || null,
          hours: req.query.hours !== undefined ? Number(req.query.hours) : null,
          guestCount: Number(req.query.guestCount ?? req.query.guests ?? 1),
          spaceType: str(req.query.spaceType) || null,
          bookingMode: str(req.query.bookingMode) || null,
          minCapacity: req.query.minCapacity !== undefined ? Number(req.query.minCapacity) : null,
          maxPrice: req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : null,
        });
        return res.json(enriched);
      }

      const adminAll = (req.session?.user?.role === 'ADMIN' || req.user?.role === 'ADMIN') && req.query.all === 'true';
      const filter = {};
      if (str(req.query.status)) {
        filter.status = str(req.query.status);
      } else if (!adminAll) {
        filter.status = 'ACTIVE';
      }
      const zoneId = str(req.query.zoneId);
      if (zoneId && ObjectId.isValid(zoneId)) filter.zone_id = new ObjectId(zoneId);
      const spaceType = str(req.query.spaceType);
      if (spaceType) filter.space_type = spaceType;
      const bookingMode = str(req.query.bookingMode);
      if (bookingMode) filter.booking_mode = bookingMode;
      const minCap = Number(req.query.minCapacity);
      if (Number.isInteger(minCap) && minCap > 0) filter.capacity = { $gte: minCap };

      const spaces = await db.collection('spaces').find(filter).toArray();
      if (adminAll && spaces.length) {
        const spaceIds = spaces.map((s) => s._id);
        const futureBookings = await db
          .collection('bookings')
          .find({
            space_id: { $in: spaceIds },
            status: { $in: ['PENDING_PAYMENT', 'CONFIRMED'] },
            end_at: { $gt: new Date() },
          })
          .toArray();
        const countBySpace = new Map();
        for (const b of futureBookings) {
          const k = String(b.space_id);
          countBySpace.set(k, (countBySpace.get(k) || 0) + 1);
        }
        return res.json(
          spaces.map((s) => ({
            ...s,
            futureBookingCount: countBySpace.get(String(s._id)) || 0,
          })),
        );
      }
      res.json(spaces);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// GET /api/spaces/:id — Chi tiết không gian + Gói tương thích + Quyền lợi đi kèm (Bước 1 UC-04 & Bước 2 UC-05)
router.get(
  '/spaces/:id',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const id = str(req.params.id);
    const space =
      ObjectId.isValid(id) && id.length === 24
        ? await db.collection('spaces').findOne({ _id: new ObjectId(id) })
        : await db.collection('spaces').findOne({ space_code: id.toUpperCase() });

    if (!space) return fail(res, 404, 'SPACE_NOT_FOUND', 'Không tìm thấy không gian');

    const [zone, priceDocs] = await Promise.all([
      db.collection('zones').findOne({ _id: space.zone_id }),
      db.collection('package_prices').find({ space_id: space._id }).toArray(),
    ]);

    const pkgIds = priceDocs.map((p) => p.package_id);
    const priceByPkg = new Map(priceDocs.map((p) => [String(p.package_id), p.price]));

    const [packages, inclusions] = await Promise.all([
      pkgIds.length
        ? db
            .collection('packages')
            .find({ _id: { $in: pkgIds }, is_active: true })
            .toArray()
        : [],
      pkgIds.length
        ? db
            .collection('package_inclusions')
            .find({ package_id: { $in: pkgIds }, is_active: true })
            .toArray()
        : [],
    ]);

    const incByPkg = new Map();
    for (const inc of inclusions) {
      const k = String(inc.package_id);
      if (!incByPkg.has(k)) incByPkg.set(k, []);
      incByPkg.get(k).push(inc);
    }

    const compatiblePackages = packages.map((pkg) => ({
      ...pkg,
      base_price: priceByPkg.get(String(pkg._id)),
      inclusions: incByPkg.get(String(pkg._id)) || [],
    }));

    res.json({
      ...space,
      zone,
      packages: compatiblePackages,
    });
  }),
);

// GET /api/spaces/:id/reviews — Xem danh sách đánh giá & điểm trung bình của không gian (UC-16)
router.get(
  '/spaces/:id/reviews',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const result = await listSpaceReviews(db, { spaceId: req.params.id });
      res.json(result);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/spaces [ADMIN] (UC-18, BR-B02)
router.post(
  '/spaces',
  ...ADMIN,
  wrap(async (req, res) => {
    const name = str(req.body.name);
    const zoneId = str(req.body.zoneId || req.body.zone_id);
    const bookingMode = str(req.body.bookingMode || req.body.booking_mode || req.body.mode).toUpperCase();
    const minGuests = Number(req.body.minGuests ?? req.body.min_guests);
    const maxGuests = Number(req.body.maxGuests ?? req.body.max_guests);
    const capacity = Number(req.body.capacity);

    if (!name) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
    if (!validId(zoneId)) return fail(res, 422, 'VALIDATION_ERROR', 'zoneId không hợp lệ');
    if (!['EXCLUSIVE', 'SHARED'].includes(bookingMode)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'bookingMode phải là EXCLUSIVE hoặc SHARED');
    }
    if (
      !Number.isInteger(minGuests) ||
      !Number.isInteger(maxGuests) ||
      !Number.isInteger(capacity) ||
      minGuests < 1 ||
      minGuests > maxGuests ||
      maxGuests > capacity
    ) {
      return fail(
        res,
        422,
        'VALIDATION_ERROR',
        'minGuests, maxGuests, capacity phải là số nguyên hợp lệ (1 <= minGuests <= maxGuests <= capacity)',
      );
    }

    const now = new Date();
    const spaceCode =
      str(req.body.spaceCode || req.body.space_code).toUpperCase() ||
      `SP_${Date.now().toString(36).toUpperCase()}`;
    const bufMin =
      bookingMode === 'SHARED'
        ? 0
        : Number.isInteger(req.body.bufferMinutes ?? req.body.buffer_minutes)
          ? Number(req.body.bufferMinutes ?? req.body.buffer_minutes)
          : 15;

    const doc = {
      _id: new ObjectId(),
      zone_id: oid(zoneId),
      space_code: spaceCode.slice(0, 30),
      name: name.slice(0, 100),
      space_type: str(req.body.spaceType || req.body.space_type) || 'STANDARD',
      amenities: Array.isArray(req.body.amenities) ? req.body.amenities.map(String) : [],
      booking_mode: bookingMode,
      capacity,
      min_guests: minGuests,
      max_guests: maxGuests,
      open_time: str(req.body.openTime || req.body.open_time) || '08:00',
      close_time: str(req.body.closeTime || req.body.close_time) || '22:00',
      buffer_minutes: bufMin,
      status: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(req.body.status)
        ? req.body.status
        : 'ACTIVE',
      lock_version: 0,
      image_url: str(req.body.imageUrl || req.body.image_url) || '/images/spaces/default.jpg',
      created_at: now,
      updated_at: now,
    };

    const { insertedId } = await req.app.locals.db.collection('spaces').insertOne(doc);
    res.status(201).json({ id: String(insertedId), space: doc });
  }),
);

// PATCH /api/spaces/:id [ADMIN] (UC-19, UC-20)
router.patch(
  '/spaces/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const set = pick(req.body, [
      'name',
      'status',
      'booking_mode',
      'min_guests',
      'max_guests',
      'capacity',
      'buffer_minutes',
      'open_time',
      'close_time',
      'space_type',
      'amenities',
      'image_url',
      'mode',
      'bookingMode',
      'minGuests',
      'maxGuests',
      'bufferMinutes',
      'zoneId',
    ]);
    if ('name' in set) set.name = str(set.name).slice(0, 100);
    if ('mode' in set) {
      set.booking_mode = str(set.mode).toUpperCase();
      delete set.mode;
    }
    if ('bookingMode' in set) {
      set.booking_mode = str(set.bookingMode).toUpperCase();
      delete set.bookingMode;
    }
    if ('minGuests' in set) {
      set.min_guests = Number(set.minGuests);
      delete set.minGuests;
    }
    if ('maxGuests' in set) {
      set.max_guests = Number(set.maxGuests);
      delete set.maxGuests;
    }
    if ('bufferMinutes' in set) {
      set.buffer_minutes = Number(set.bufferMinutes);
      delete set.bufferMinutes;
    }
    if ('zoneId' in set) {
      if (!validId(set.zoneId)) return fail(res, 422, 'VALIDATION_ERROR', 'zoneId không hợp lệ');
      set.zone_id = oid(set.zoneId);
      delete set.zoneId;
    }
    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    set.updated_at = new Date();
    const r = await req.app.locals.db.collection('spaces').updateOne({ _id: oid(id) }, { $set: set });
    if (!r.matchedCount) return notFound(res, 'Space');
    res.json({ updated: true });
  }),
);

// DELETE /api/spaces/:id [ADMIN] — Soft Delete (UC-20, BR-B02)
router.delete(
  '/spaces/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const r = await req.app.locals.db
      .collection('spaces')
      .updateOne({ _id: oid(id) }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
    if (!r.matchedCount) return notFound(res, 'Space');
    res.json({ deleted: true });
  }),
);

// ═══════════════════════════════════════════════════
// 3. PACKAGES, PACKAGE_PRICES & PACKAGE_INCLUSIONS (UC-21)
// ═══════════════════════════════════════════════════
// GET /api/packages — Danh sách gói dịch vụ
router.get(
  '/packages',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    const zoneId = str(req.query.zoneId);
    if (zoneId && ObjectId.isValid(zoneId)) filter.zone_id = new ObjectId(zoneId);
    const packages = await db.collection('packages').find(filter).toArray();
    res.json(packages);
  }),
);

// GET /api/packages/:id
router.get(
  '/packages/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const pkg = await req.app.locals.db.collection('packages').findOne({ _id: oid(id) });
    if (!pkg) return notFound(res, 'Package');
    res.json(pkg);
  }),
);

// POST /api/packages [ADMIN] (packages.validator.json)
router.post(
  '/packages',
  ...ADMIN,
  wrap(async (req, res) => {
    const name = str(req.body.name);
    const zoneId = str(req.body.zoneId || req.body.zone_id);
    if (!name) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
    if (!validId(zoneId)) return fail(res, 422, 'VALIDATION_ERROR', 'zoneId không hợp lệ');

    const pkgType = str(req.body.packageType || req.body.package_type || 'HOURLY').toUpperCase();
    const pricingUnit = str(req.body.pricingUnit || req.body.pricing_unit || 'PER_SPACE').toUpperCase();
    if (!['FIXED', 'HOURLY'].includes(pkgType)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'packageType phải là FIXED hoặc HOURLY');
    }
    if (!['PER_SPACE', 'PER_PERSON'].includes(pricingUnit)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'pricingUnit phải là PER_SPACE hoặc PER_PERSON');
    }

    const isFullDay = Boolean(req.body.isFullDay ?? req.body.is_full_day ?? false);
    const durationHours =
      pkgType === 'HOURLY'
        ? null
        : isFullDay && req.body.durationHours === undefined && req.body.duration_hours === undefined
          ? null
          : Number(req.body.durationHours ?? req.body.duration_hours ?? 4);
    const minHours = Number(req.body.minHours ?? req.body.min_hours ?? 1);
    if (isNaN(minHours) || minHours < 1) {
      return fail(res, 422, 'VALIDATION_ERROR', 'minHours phải lớn hơn hoặc bằng 1');
    }
    const pkgCode =
      str(req.body.packageCode || req.body.package_code).toUpperCase() ||
      `PKG_${Date.now().toString(36).toUpperCase()}`;

    const existingPkg = await req.app.locals.db.collection('packages').findOne({
      package_code: pkgCode.slice(0, 30),
    });
    if (existingPkg) {
      return fail(res, 409, 'DUPLICATE_CODE', 'Mã gói dịch vụ (package_code) đã tồn tại');
    }

    const doc = {
      _id: new ObjectId(),
      zone_id: oid(zoneId),
      package_code: pkgCode.slice(0, 30),
      name: name.slice(0, 100),
      package_type: pkgType,
      pricing_unit: pricingUnit,
      duration_hours: durationHours,
      is_full_day: isFullDay,
      min_hours: minHours,
      description: req.body.description !== undefined ? str(req.body.description) : null,
      is_active: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    };

    try {
      const { insertedId } = await req.app.locals.db.collection('packages').insertOne(doc);
      res.status(201).json({ id: String(insertedId), package: doc });
    } catch (e) {
      if (isDup(e)) {
        return fail(res, 409, 'DUPLICATE_CODE', 'Mã gói dịch vụ (package_code) đã tồn tại');
      }
      throw e;
    }
  }),
);

// PATCH /api/packages/:id [ADMIN]
router.patch(
  '/packages/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const set = pick(req.body, [
      'name',
      'description',
      'is_active',
      'isActive',
      'min_hours',
      'minHours',
      'duration_hours',
      'durationHours',
      'package_type',
      'packageType',
      'pricing_unit',
      'pricingUnit',
    ]);
    if ('name' in set) set.name = str(set.name).slice(0, 100);
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    const rawPkgType = set.packageType !== undefined ? set.packageType : set.package_type;
    if (rawPkgType !== undefined) {
      const pkgType = str(rawPkgType).toUpperCase();
      if (!['FIXED', 'HOURLY'].includes(pkgType)) {
        return fail(res, 422, 'VALIDATION_ERROR', 'packageType phải là FIXED hoặc HOURLY');
      }
      set.package_type = pkgType;
      delete set.packageType;
    }
    const rawPricingUnit = set.pricingUnit !== undefined ? set.pricingUnit : set.pricing_unit;
    if (rawPricingUnit !== undefined) {
      const pricingUnit = str(rawPricingUnit).toUpperCase();
      if (!['PER_SPACE', 'PER_PERSON'].includes(pricingUnit)) {
        return fail(res, 422, 'VALIDATION_ERROR', 'pricingUnit phải là PER_SPACE hoặc PER_PERSON');
      }
      set.pricing_unit = pricingUnit;
      delete set.pricingUnit;
    }
    if ('minHours' in set || 'min_hours' in set) {
      const rawVal = set.minHours !== undefined ? set.minHours : set.min_hours;
      const val = Number(rawVal);
      if (!Number.isFinite(val) || val < 1) {
        return fail(res, 422, 'VALIDATION_ERROR', 'minHours phải là số nguyên lớn hơn hoặc bằng 1');
      }
      set.min_hours = val;
      delete set.minHours;
    }
    if ('durationHours' in set || 'duration_hours' in set) {
      const rawDur = set.durationHours !== undefined ? set.durationHours : set.duration_hours;
      set.duration_hours = rawDur === null ? null : Number(rawDur);
      delete set.durationHours;
    }

    const rawPrice = req.body.price !== undefined ? req.body.price : req.body.unitPrice;
    const hasPriceUpdate = rawPrice !== undefined;
    let newPrice;
    if (hasPriceUpdate) {
      if (rawPrice === '' || rawPrice === null || typeof rawPrice === 'boolean') {
        return fail(res, 422, 'VALIDATION_ERROR', 'price phải là số nguyên VNĐ >= 0');
      }
      newPrice = Math.round(Number(rawPrice));
      try {
        assertMoney(newPrice, 'price');
      } catch (e) {
        return fail(res, 422, 'VALIDATION_ERROR', e.message);
      }
    }

    if (!Object.keys(set).length && !hasPriceUpdate) {
      return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    }

    const pkgDoc = await db.collection('packages').findOne({ _id: oid(id) });
    if (!pkgDoc) return notFound(res, 'Package');

    if (Object.keys(set).length) {
      await db.collection('packages').updateOne({ _id: oid(id) }, { $set: set });
    }

    if (hasPriceUpdate) {
      const priceCol = db.collection('package_prices');
      const priceDocs = await priceCol.find({ package_id: oid(id) }).toArray();
      const reqSpaceId = str(req.body.space_id || req.body.spaceId);
      const matchedBySpace = validId(reqSpaceId)
        ? priceDocs.filter((d) => String(d.space_id) === reqSpaceId)
        : [];
      if (matchedBySpace.length > 0) {
        await Promise.all(
          matchedBySpace.map((d) => priceCol.updateOne({ _id: d._id }, { $set: { price: newPrice } })),
        );
      } else if (priceDocs.length === 1) {
        await priceCol.updateOne({ _id: priceDocs[0]._id }, { $set: { price: newPrice } });
      } else if (priceDocs.length > 1) {
        const minOld = Math.min(...priceDocs.map((d) => Number(d.price || 0)));
        const delta = newPrice - minOld;
        await Promise.all(
          priceDocs.map((d) =>
            priceCol.updateOne(
              { _id: d._id },
              { $set: { price: Math.max(0, Math.round(Number(d.price || 0) + delta)) } },
            ),
          ),
        );
      }
    }

    res.json({ updated: true });
  }),
);

// DELETE /api/packages/:id [ADMIN] — Soft Delete
router.delete(
  '/packages/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const r = await req.app.locals.db
      .collection('packages')
      .updateOne({ _id: oid(id) }, { $set: { is_active: false } });
    if (!r.matchedCount) return notFound(res, 'Package');
    res.json({ deleted: true });
  }),
);

// ── Bảng giá theo từng Space (package_prices.validator.json) ──
router.get(
  '/pricing',
  wrap(async (req, res) => {
    const filter = {};
    if (req.query.spaceId && validId(req.query.spaceId)) filter.space_id = oid(req.query.spaceId);
    if (req.query.packageId && validId(req.query.packageId)) filter.package_id = oid(req.query.packageId);
    const pricing = await req.app.locals.db.collection('package_prices').find(filter).toArray();
    res.json(pricing);
  }),
);

router.post(
  '/pricing',
  ...ADMIN,
  wrap(async (req, res) => {
    const spaceId = str(req.body.spaceId || req.body.space_id);
    const packageId = str(req.body.packageId || req.body.package_id);
    const price = req.body.price ?? req.body.unitPrice;
    if (!validId(spaceId) || !validId(packageId)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'spaceId và packageId bắt buộc hợp lệ');
    }
    try {
      assertMoney(price, 'price');
    } catch (e) {
      return fail(res, 422, 'VALIDATION_ERROR', e.message);
    }
    const existingPrice = await req.app.locals.db.collection('package_prices').findOne({
      package_id: oid(packageId),
      space_id: oid(spaceId),
    });
    if (existingPrice) {
      return fail(res, 409, 'DUPLICATE_PRICING', 'Bảng giá cho cặp packageId và spaceId đã tồn tại');
    }
    const doc = {
      _id: new ObjectId(),
      package_id: oid(packageId),
      space_id: oid(spaceId),
      price,
    };
    try {
      const { insertedId } = await req.app.locals.db.collection('package_prices').insertOne(doc);
      res.status(201).json({ id: String(insertedId), packagePrice: doc });
    } catch (e) {
      if (isDup(e)) {
        return fail(res, 409, 'DUPLICATE_PRICING', 'Bảng giá cho cặp packageId và spaceId đã tồn tại');
      }
      throw e;
    }
  }),
);

router.patch(
  '/pricing/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const price = req.body.price ?? req.body.unitPrice;
    if (price === undefined) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    try {
      assertMoney(price, 'price');
    } catch (e) {
      return fail(res, 422, 'VALIDATION_ERROR', e.message);
    }
    const r = await req.app.locals.db
      .collection('package_prices')
      .updateOne({ _id: oid(id) }, { $set: { price } });
    if (!r.matchedCount) return notFound(res, 'PackagePrice');
    res.json({ updated: true });
  }),
);

router.delete(
  '/pricing/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const r = await req.app.locals.db.collection('package_prices').deleteOne({ _id: oid(id) });
    if (!r.deletedCount) return notFound(res, 'PackagePrice');
    res.json({ deleted: true });
  }),
);

// ── Cấu hình định mức Inclusion (package_inclusions.validator.json — hạn mức hỗ trợ 50.000đ) ──
router.get(
  '/package-inclusions',
  wrap(async (req, res) => {
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    if (req.query.packageId && validId(req.query.packageId)) filter.package_id = oid(req.query.packageId);
    const items = await req.app.locals.db.collection('package_inclusions').find(filter).toArray();
    res.json(items);
  }),
);

router.post(
  '/package-inclusions',
  ...ADMIN,
  wrap(async (req, res) => {
    const packageId = str(req.body.packageId || req.body.package_id);
    const itemType = str(req.body.itemType || req.body.item_type).toUpperCase();
    const quantity = Number(req.body.quantity ?? 1);
    const quantityBasis = str(req.body.quantityBasis || req.body.quantity_basis || 'PER_GUEST').toUpperCase();
    if (!validId(packageId)) return fail(res, 422, 'VALIDATION_ERROR', 'packageId không hợp lệ');
    const targetPackage = await req.app.locals.db.collection('packages').findOne({ _id: oid(packageId) });
    if (!targetPackage) {
      return fail(res, 422, 'VALIDATION_ERROR', 'packageId không tồn tại');
    }
    if (!['STANDARD_DRINK', 'PASTRY', 'WATER', 'EQUIPMENT'].includes(itemType)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'itemType không hợp lệ');
    }
    if (!['PER_GUEST', 'PER_BOOKING'].includes(quantityBasis)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'quantityBasis phải là PER_GUEST hoặc PER_BOOKING');
    }
    const doc = {
      _id: new ObjectId(),
      package_id: oid(packageId),
      item_type: itemType,
      product_id: validId(req.body.productId) ? oid(req.body.productId) : null,
      label: str(req.body.label || itemType).slice(0, 100),
      quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
      quantity_basis: quantityBasis,
      subsidy_limit:
        req.body.subsidyLimit !== undefined
          ? Number(req.body.subsidyLimit)
          : itemType === 'STANDARD_DRINK'
            ? 50000
            : null,
      min_hours_required: Number(req.body.minHoursRequired ?? req.body.min_hours_required ?? 0),
      is_active: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    };
    const { insertedId } = await req.app.locals.db.collection('package_inclusions').insertOne(doc);
    res.status(201).json({ id: String(insertedId), inclusion: doc });
  }),
);

// ═══════════════════════════════════════════════════
// 4. PRODUCTS & ADD-ONS (UC-22, products.validator.json, addons.validator.json)
// ═══════════════════════════════════════════════════
function normalizeVariants(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const name = str(item?.name).slice(0, 50);
    if (!name) continue;
    const price = Number(item?.price);
    if (!Number.isFinite(price) || price < 0) {
      throw Object.assign(new Error('Giá biến thể phải là số nguyên VNĐ >= 0'), { status: 422 });
    }
    out.push({ name, price: Math.round(price) });
  }
  return out;
}
// GET /api/products — Menu đồ uống & bánh (13 món F&B KÉN Kết Nối & chọn món Inclusion)
router.get(
  '/products',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const category = str(req.query.category).toUpperCase();
    if (req.query.recommend === 'true') {
      try {
        const user = await resolveOptionalUser(req);
        const rec = await getBookingMenuRecommendations(db, req.query, user);
        const list = category ? rec.inclusions.filter((p) => p.category === category) : rec.inclusions;
        return res.json(list);
      } catch (err) {
        return handleErr(res, err);
      }
    }
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    if (category) filter.category = category;
    const products = await db.collection('products').find(filter).toArray();
    res.json(products);
  }),
);

// GET /api/products/:id — Chi tiết món kèm variants
router.get(
  '/products/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const prod = await req.app.locals.db.collection('products').findOne({ _id: oid(id) });
    if (!prod) return notFound(res, 'Product');
    res.json(prod);
  }),
);

// POST /api/products [ADMIN]
router.post(
  '/products',
  ...ADMIN,
  wrap(async (req, res) => {
    const name = str(req.body.name);
    const price = req.body.price ?? req.body.unitPrice;
    const category = str(req.body.category || 'DRINK').toUpperCase();
    if (!name) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
    if (!['DRINK', 'PASTRY', 'SNACK'].includes(category)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'category phải là DRINK, PASTRY hoặc SNACK');
    }
    try {
      assertMoney(price, 'price');
    } catch (e) {
      return fail(res, 422, 'VALIDATION_ERROR', e.message);
    }

    let variants = [];
    try {
      variants = normalizeVariants(req.body.variants);
    } catch (e) {
      return fail(res, 422, 'VALIDATION_ERROR', e.message);
    }

    const itemCode =
      str(req.body.itemCode || req.body.item_code).toUpperCase() ||
      `PRD_${Date.now().toString(36).toUpperCase()}`;
    const doc = {
      _id: new ObjectId(),
      item_code: itemCode.slice(0, 50),
      name: name.slice(0, 100),
      category,
      sub_category: req.body.subCategory ? str(req.body.subCategory) : null,
      variants,
      price,
      image_url: str(req.body.imageUrl || req.body.image_url) || '/images/addons/cf-den.png',
      description: req.body.description ? str(req.body.description) : null,
      is_active: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    };
    const { insertedId } = await req.app.locals.db.collection('products').insertOne(doc);
    res.status(201).json({ id: String(insertedId), product: doc });
  }),
);

// PATCH /api/products/:id [ADMIN]
router.patch(
  '/products/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const existingProd = await db.collection('products').findOne({ _id: oid(id) });
    if (!existingProd) return notFound(res, 'Product');

    const set = pick(req.body, [
      'name',
      'price',
      'unitPrice',
      'category',
      'description',
      'is_active',
      'isActive',
      'variants',
      'image_url',
      'imageUrl',
    ]);
    if ('name' in set) set.name = str(set.name).slice(0, 100);
    if ('unitPrice' in set) {
      set.price = set.unitPrice;
      delete set.unitPrice;
    }
    if ('price' in set) {
      try {
        assertMoney(set.price, 'price');
      } catch (e) {
        return fail(res, 422, 'VALIDATION_ERROR', e.message);
      }
    }
    if ('category' in set) {
      const cat = str(set.category).toUpperCase();
      if (cat === 'PASTRY' && existingProd.category === 'SNACK') {
        set.category = 'SNACK';
      } else if (['DRINK', 'PASTRY', 'SNACK'].includes(cat)) {
        set.category = cat;
      } else {
        delete set.category;
      }
    }
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    if ('imageUrl' in set) {
      set.image_url = str(set.imageUrl);
      delete set.imageUrl;
    } else if ('image_url' in set) {
      set.image_url = str(set.image_url);
    }

    const priceDelta = 'price' in set ? set.price - Number(existingProd.price ?? set.price) : 0;
    if ('price' in set && set.variants === undefined && Array.isArray(existingProd.variants) && existingProd.variants.length > 0) {
      set.variants = existingProd.variants.map((v) => ({
        name: String(v.name).slice(0, 50),
        price: Math.max(0, Math.round(Number(v.price ?? existingProd.price ?? 0) + priceDelta)),
      }));
    } else if (Array.isArray(set.variants)) {
      try {
        set.variants = normalizeVariants(set.variants);
      } catch (e) {
        return fail(res, 422, 'VALIDATION_ERROR', e.message);
      }
    }

    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    await db.collection('products').updateOne({ _id: oid(id) }, { $set: set });

    const linkedAddon = await db.collection('addons').findOne({ product_id: oid(id) });
    if (linkedAddon) {
      const addonSet = {};
      if ('name' in set) addonSet.name = set.name;
      if ('price' in set) addonSet.price = set.price;
      if ('image_url' in set) addonSet.image_url = set.image_url;
      if ('is_active' in set) addonSet.is_active = set.is_active;
      if (Array.isArray(req.body.variants) && Array.isArray(set.variants)) {
        addonSet.variants = set.variants;
      } else if ('price' in set && Array.isArray(linkedAddon.variants) && linkedAddon.variants.length > 0) {
        addonSet.variants = linkedAddon.variants.map((v) => ({
          name: String(v.name).slice(0, 50),
          price: Math.max(0, Math.round(Number(v.price ?? linkedAddon.price ?? 0) + priceDelta)),
        }));
      }
      if (Object.keys(addonSet).length) {
        await db.collection('addons').updateOne({ _id: linkedAddon._id }, { $set: addonSet });
      }
    }

    res.json({ updated: true });
  }),
);

// DELETE /api/products/:id [ADMIN] — Soft Delete
router.delete(
  '/products/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const r = await req.app.locals.db
      .collection('products')
      .updateOne({ _id: oid(id) }, { $set: { is_active: false } });
    if (!r.matchedCount) return notFound(res, 'Product');
    res.json({ deleted: true });
  }),
);

// GET /api/addons — Danh sách dịch vụ mua thêm (Bước 3 UC-06)
router.get(
  '/addons',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    if (req.query.recommend === 'true') {
      try {
        const user = await resolveOptionalUser(req);
        const rec = await getBookingMenuRecommendations(db, req.query, user);
        return res.json(rec.addons);
      } catch (err) {
        return handleErr(res, err);
      }
    }
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    const addons = await db.collection('addons').find(filter).toArray();
    res.json(addons);
  }),
);

// GET /api/addons/:id — Chi tiết Add-on
router.get(
  '/addons/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const addon = await req.app.locals.db.collection('addons').findOne({ _id: oid(id) });
    if (!addon) return notFound(res, 'Addon');
    res.json(addon);
  }),
);

// POST /api/addons [ADMIN] (addons.validator.json)
router.post(
  '/addons',
  ...ADMIN,
  wrap(async (req, res) => {
    const name = str(req.body.name);
    const price = req.body.price ?? req.body.unitPrice;
    const unit = str(req.body.unit || 'PER_ITEM').toUpperCase();
    if (!name) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
    if (!['PER_ITEM', 'PER_BOOKING'].includes(unit)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'unit phải là PER_ITEM hoặc PER_BOOKING');
    }
    try {
      assertMoney(price, 'price');
    } catch (e) {
      return fail(res, 422, 'VALIDATION_ERROR', e.message);
    }

    let variants = [];
    try {
      variants = normalizeVariants(req.body.variants);
    } catch (e) {
      return fail(res, 422, 'VALIDATION_ERROR', e.message);
    }

    const doc = {
      _id: new ObjectId(),
      product_id: validId(req.body.productId) ? oid(req.body.productId) : null,
      name: name.slice(0, 100),
      variants,
      price,
      unit,
      operation_note: req.body.description || req.body.operation_note ? str(req.body.description || req.body.operation_note) : null,
      image_url: str(req.body.imageUrl || req.body.image_url) || '/images/addons/cf-den.png',
      is_active: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
    };
    const { insertedId } = await req.app.locals.db.collection('addons').insertOne(doc);
    res.status(201).json({ id: String(insertedId), addon: doc });
  }),
);

// PATCH /api/addons/:id [ADMIN]
router.patch(
  '/addons/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const existingAddon = await db.collection('addons').findOne({ _id: oid(id) });
    if (!existingAddon) return notFound(res, 'Addon');

    const set = pick(req.body, [
      'name',
      'price',
      'unitPrice',
      'unit',
      'operation_note',
      'is_active',
      'isActive',
      'variants',
      'image_url',
      'imageUrl',
    ]);
    if ('name' in set) set.name = str(set.name).slice(0, 100);
    if ('unit' in set) {
      const uVal = str(set.unit).toUpperCase();
      if (['PER_ITEM', 'PER_BOOKING'].includes(uVal)) {
        set.unit = uVal;
      } else {
        delete set.unit;
      }
    }
    if ('unitPrice' in set) {
      set.price = set.unitPrice;
      delete set.unitPrice;
    }
    if ('price' in set) {
      try {
        assertMoney(set.price, 'price');
      } catch (e) {
        return fail(res, 422, 'VALIDATION_ERROR', e.message);
      }
    }
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    if ('imageUrl' in set) {
      set.image_url = str(set.imageUrl);
      delete set.imageUrl;
    } else if ('image_url' in set) {
      set.image_url = str(set.image_url);
    }

    const priceDelta = 'price' in set ? set.price - Number(existingAddon.price ?? set.price) : 0;
    if ('price' in set && set.variants === undefined && Array.isArray(existingAddon.variants) && existingAddon.variants.length > 0) {
      set.variants = existingAddon.variants.map((v) => ({
        name: String(v.name).slice(0, 50),
        price: Math.max(0, Math.round(Number(v.price ?? existingAddon.price ?? 0) + priceDelta)),
      }));
    } else if (Array.isArray(set.variants)) {
      try {
        set.variants = normalizeVariants(set.variants);
      } catch (e) {
        return fail(res, 422, 'VALIDATION_ERROR', e.message);
      }
    }

    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    await db.collection('addons').updateOne({ _id: oid(id) }, { $set: set });

    if (existingAddon.product_id) {
      const linkedProd = await db.collection('products').findOne({ _id: existingAddon.product_id });
      if (linkedProd) {
        const prodSet = {};
        if ('name' in set) prodSet.name = set.name;
        if ('price' in set) prodSet.price = set.price;
        if ('image_url' in set) prodSet.image_url = set.image_url;
        if ('is_active' in set) prodSet.is_active = set.is_active;
        if (Array.isArray(req.body.variants) && Array.isArray(set.variants)) {
          prodSet.variants = set.variants;
        } else if ('price' in set && Array.isArray(linkedProd.variants) && linkedProd.variants.length > 0) {
          prodSet.variants = linkedProd.variants.map((v) => ({
            name: String(v.name).slice(0, 50),
            price: Math.max(0, Math.round(Number(v.price ?? linkedProd.price ?? 0) + priceDelta)),
          }));
        }
        if (Object.keys(prodSet).length) {
          await db.collection('products').updateOne({ _id: linkedProd._id }, { $set: prodSet });
        }
      }
    }

    res.json({ updated: true });
  }),
);

// DELETE /api/addons/:id [ADMIN] — Soft Delete
router.delete(
  '/addons/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const r = await req.app.locals.db
      .collection('addons')
      .updateOne({ _id: oid(id) }, { $set: { is_active: false } });
    if (!r.matchedCount) return notFound(res, 'Addon');
    res.json({ deleted: true });
  }),
);

// ═══════════════════════════════════════════════════
// 5. VOUCHERS & RECIPES (UC-29, UC-30)
// ═══════════════════════════════════════════════════
// GET /api/vouchers — Danh sách mã ưu đãi đang hoạt động (Bước 4 UC-07)
router.get(
  '/vouchers',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { status: 'ACTIVE' };
    const vouchers = await db.collection('vouchers').find(filter).toArray();

    const userIdStr = req.session?.user?.id;
    if (!userIdStr || !ObjectId.isValid(userIdStr)) {
      return res.json(vouchers);
    }

    const userOid = new ObjectId(userIdStr);
    let usedGeneralIds = new Set();
    let userVouchers = [];
    try {
      const [userBookings, uvList] = await Promise.all([
        db
          .collection('bookings')
          .find({
            user_id: userOid,
            voucher_usage_released: { $ne: true },
            status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'] },
          })
          .toArray(),
        db.collection('user_vouchers').find({ user_id: userOid }).toArray(),
      ]);
      usedGeneralIds = new Set(
        userBookings.filter((b) => b.voucher_id).map((b) => String(b.voucher_id)),
      );
      userVouchers = Array.isArray(uvList) ? uvList : [];
    } catch (_) {
      return res.json(vouchers);
    }

    const enriched = vouchers.map((v) => {
      const vid = String(v._id);
      const isCoinVoucher = Number(v.coins_cost || 0) > 0;
      if (isCoinVoucher) {
        const owned = userVouchers.filter((uv) => String(uv.voucher_id) === vid);
        const unusedCount = owned.filter((uv) => !uv.used_booking_id).length;
        return {
          ...v,
          used_by_user: owned.length > 0 && unusedCount === 0,
          owned_unused_count: unusedCount,
        };
      }
      const usedGeneral = usedGeneralIds.has(vid);
      return {
        ...v,
        used_by_user: usedGeneral,
        owned_unused_count: usedGeneral ? 0 : 1,
      };
    });

    res.json(enriched);
  }),
);

// POST /api/vouchers [ADMIN] (UC-29, vouchers.validator.json)
router.post(
  '/vouchers',
  ...ADMIN,
  wrap(async (req, res) => {
    const code = str(req.body.code).toUpperCase();
    const discountType = str(req.body.discountType || req.body.discount_type).toUpperCase();
    const discountValue = Number(req.body.discountValue ?? req.body.discount_value);
    if (!code) return fail(res, 422, 'VALIDATION_ERROR', 'code bắt buộc');
    if (!['PERCENT', 'FIXED_AMOUNT'].includes(discountType)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'discountType phải là PERCENT hoặc FIXED_AMOUNT');
    }
    if (!Number.isInteger(discountValue) || discountValue < 1 || (discountType === 'PERCENT' && discountValue > 100)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'discountValue không hợp lệ');
    }
    const now = new Date();
    const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : now;
    const validTo = req.body.validTo ? new Date(req.body.validTo) : new Date(now.getTime() + 30 * 86400000);
    const coinsCost = Number(req.body.coinsCost ?? req.body.coins_cost ?? 0);
    const redeemLimit = coinsCost > 0 ? Number(req.body.redeemLimit ?? req.body.redeem_limit ?? 100) : 0;
    const usageLimit = Math.max(Number(req.body.usageLimit ?? req.body.usage_limit ?? 100), redeemLimit);
    const doc = {
      _id: new ObjectId(),
      code: code.slice(0, 30),
      description: req.body.description ? str(req.body.description) : null,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_value: Number(req.body.minOrderValue ?? req.body.min_order_value ?? 0),
      valid_from: validFrom,
      valid_to: validTo,
      usage_limit: usageLimit,
      usage_count: 0,
      redeem_limit: redeemLimit,
      redeem_count: 0,
      redeem_valid_to: coinsCost > 0 ? validTo : null,
      coins_cost: coinsCost,
      status: req.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      created_at: now,
      updated_at: now,
    };
    const existing = await req.app.locals.db.collection('vouchers').findOne({ code: code.slice(0, 30) });
    if (existing) {
      return fail(res, 409, 'CODE_EXISTS', 'Mã Voucher đã tồn tại');
    }
    try {
      const { insertedId } = await req.app.locals.db.collection('vouchers').insertOne(doc);
      res.status(201).json({ id: String(insertedId), voucher: doc });
    } catch (e) {
      if (isDup(e)) return fail(res, 409, 'CODE_EXISTS', 'Mã Voucher đã tồn tại');
      throw e;
    }
  }),
);

// PATCH /api/vouchers/:id [ADMIN] (UC-30)
router.patch(
  '/vouchers/:id',
  ...ADMIN,
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const set = pick(req.body, [
      'description',
      'discount_type',
      'discountType',
      'discount_value',
      'discountValue',
      'min_order_value',
      'minOrderValue',
      'valid_from',
      'validFrom',
      'valid_to',
      'validTo',
      'usage_limit',
      'usageLimit',
      'redeem_limit',
      'redeemLimit',
      'coins_cost',
      'coinsCost',
      'status',
    ]);
    if ('discountType' in set) {
      set.discount_type = str(set.discountType).toUpperCase();
      delete set.discountType;
    }
    if ('discountValue' in set) {
      set.discount_value = Number(set.discountValue);
      delete set.discountValue;
    }
    if ('minOrderValue' in set) {
      set.min_order_value = Number(set.minOrderValue);
      delete set.minOrderValue;
    }
    if ('validFrom' in set) {
      set.valid_from = new Date(set.validFrom);
      delete set.validFrom;
    } else if ('valid_from' in set) {
      set.valid_from = new Date(set.valid_from);
    }
    if ('validTo' in set) {
      set.valid_to = new Date(set.validTo);
      delete set.validTo;
    } else if ('valid_to' in set) {
      set.valid_to = new Date(set.valid_to);
    }
    if ('usageLimit' in set) {
      set.usage_limit = Number(set.usageLimit);
      delete set.usageLimit;
    }
    if ('redeemLimit' in set) {
      set.redeem_limit = Number(set.redeemLimit);
      delete set.redeemLimit;
    }
    if ('coinsCost' in set) {
      set.coins_cost = Number(set.coinsCost);
      delete set.coinsCost;
    }
    if ('discount_type' in set && !['PERCENT', 'FIXED_AMOUNT'].includes(set.discount_type)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'discountType phải là PERCENT hoặc FIXED_AMOUNT');
    }
    if ('status' in set && !['ACTIVE', 'INACTIVE'].includes(set.status)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'status phải là ACTIVE hoặc INACTIVE');
    }
    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    set.updated_at = new Date();
    const r = await req.app.locals.db.collection('vouchers').updateOne({ _id: oid(id) }, { $set: set });
    if (!r.matchedCount) return notFound(res, 'Voucher');
    res.json({ updated: true });
  }),
);

// RECIPES — công thức nguyên vật liệu (recipes.validator.json)
router.get(
  '/recipes',
  wrap(async (req, res) => {
    const filter = {};
    const itemId = req.query.itemId || req.query.productId;
    if (itemId && validId(itemId)) filter.item_id = oid(itemId);
    const recipes = await req.app.locals.db.collection('recipes').find(filter).toArray();
    res.json(recipes);
  }),
);

// ═══════════════════════════════════════════════════
// 6. POST /api/availability — Kiểm tra chỗ trống chế độ Read-only (BR-C07)
// ═══════════════════════════════════════════════════
router.post(
  '/availability',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const spaceId = str(req.body.spaceId);
      const packageId = str(req.body.packageId);

      // Bước 1 (UC-04): Khám phá chỗ trống theo Ngày, Giờ bắt đầu và Số khách
      if (!spaceId && !packageId) {
        const spaces = await searchAvailableSpaces(db, {
          zoneId: str(req.body.zoneId) || null,
          startAt: req.body.startAt,
          endAt: req.body.endAt || null,
          hours: req.body.hours !== undefined ? Number(req.body.hours) : null,
          guestCount: Number(req.body.guestCount ?? req.body.guests ?? 1),
          spaceType: str(req.body.spaceType) || null,
          bookingMode: str(req.body.bookingMode) || null,
          minCapacity: req.body.minCapacity !== undefined ? Number(req.body.minCapacity) : null,
          maxPrice: req.body.maxPrice !== undefined ? Number(req.body.maxPrice) : null,
        });
        return res.json({
          ok: spaces.some((s) => s.isAvailable),
          spaces,
        });
      }

      if (!ObjectId.isValid(spaceId) || !ObjectId.isValid(packageId)) {
        return fail(res, 400, 'INVALID_INPUT', 'Thiếu spaceId hoặc packageId hợp lệ');
      }
      const [space, pkg] = await Promise.all([
        db.collection('spaces').findOne({ _id: new ObjectId(spaceId), status: 'ACTIVE' }),
        db.collection('packages').findOne({ _id: new ObjectId(packageId), is_active: true }),
      ]);
      if (!space) return fail(res, 404, 'SPACE_NOT_AVAILABLE', 'Không gian không khả dụng');
      if (!pkg) return fail(res, 404, 'PACKAGE_NOT_FOUND', 'Gói dịch vụ không tồn tại');

      const guests = Number(req.body.guestCount ?? req.body.guests ?? 1);
      if (!Number.isInteger(guests) || guests < space.min_guests || guests > space.max_guests) {
        return fail(
          res,
          422,
          'INVALID_GUEST_COUNT',
          `Số lượng khách phải từ ${space.min_guests} đến ${space.max_guests}`,
        );
      }

      const tw = resolveTimeWindow({
        space,
        pkg,
        startAt: req.body.startAt,
        endAt: req.body.endAt,
        hours: req.body.hours,
      });

      const avail = await evaluateSpaceAvailability(db, {
        space,
        startAt: tw.startAt,
        endAt: tw.endAt,
        guests,
      });

      res.json({
        ok: avail.ok,
        reason: avail.reason,
        remainingCapacity: avail.remainingCapacity,
        startAt: tw.startAt,
        endAt: tw.endAt,
        blockedUntil: tw.blockedUntil,
        durationHours: tw.durationHours,
      });
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

module.exports = router;

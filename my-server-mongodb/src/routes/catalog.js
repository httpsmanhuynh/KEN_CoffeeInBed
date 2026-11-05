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
const { wrap, fail, str } = require('../utils/http');
const {
  BookingError,
  resolveTimeWindow,
  evaluateSpaceAvailability,
  searchAvailableSpaces,
} = require('../services/bookingService');

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
  if (err instanceof BookingError) {
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

      const filter = { status: str(req.query.status) || 'ACTIVE' };
      const zoneId = str(req.query.zoneId);
      if (zoneId && ObjectId.isValid(zoneId)) filter.zone_id = new ObjectId(zoneId);
      const spaceType = str(req.query.spaceType);
      if (spaceType) filter.space_type = spaceType;
      const bookingMode = str(req.query.bookingMode);
      if (bookingMode) filter.booking_mode = bookingMode;
      const minCap = Number(req.query.minCapacity);
      if (Number.isInteger(minCap) && minCap > 0) filter.capacity = { $gte: minCap };

      const spaces = await db.collection('spaces').find(filter).toArray();
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
    const pkgCode =
      str(req.body.packageCode || req.body.package_code).toUpperCase() ||
      `PKG_${Date.now().toString(36).toUpperCase()}`;

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

    const { insertedId } = await req.app.locals.db.collection('packages').insertOne(doc);
    res.status(201).json({ id: String(insertedId), package: doc });
  }),
);

// PATCH /api/packages/:id [ADMIN]
router.patch(
  '/packages/:id',
  ...ADMIN,
  wrap(async (req, res) => {
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
    ]);
    if ('name' in set) set.name = str(set.name).slice(0, 100);
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    if ('minHours' in set) {
      set.min_hours = Number(set.minHours);
      delete set.minHours;
    }
    if ('durationHours' in set) {
      set.duration_hours = set.durationHours === null ? null : Number(set.durationHours);
      delete set.durationHours;
    }
    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    const r = await req.app.locals.db.collection('packages').updateOne({ _id: oid(id) }, { $set: set });
    if (!r.matchedCount) return notFound(res, 'Package');
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
    const doc = {
      _id: new ObjectId(),
      package_id: oid(packageId),
      space_id: oid(spaceId),
      price,
    };
    const { insertedId } = await req.app.locals.db.collection('package_prices').insertOne(doc);
    res.status(201).json({ id: String(insertedId), packagePrice: doc });
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
// GET /api/products — Menu đồ uống & bánh (13 món F&B KÉN Kết Nối & chọn món Inclusion)
router.get(
  '/products',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    const category = str(req.query.category).toUpperCase();
    if (category) filter.category = category;
    const products = await db.collection('products').find(filter).toArray();
    res.json(products);
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

    const itemCode =
      str(req.body.itemCode || req.body.item_code).toUpperCase() ||
      `PRD_${Date.now().toString(36).toUpperCase()}`;
    const doc = {
      _id: new ObjectId(),
      item_code: itemCode.slice(0, 50),
      name: name.slice(0, 100),
      category,
      sub_category: req.body.subCategory ? str(req.body.subCategory) : null,
      variants: Array.isArray(req.body.variants) ? req.body.variants : [],
      price,
      image_url: str(req.body.imageUrl || req.body.image_url) || '/images/products/default.jpg',
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
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const set = pick(req.body, [
      'name',
      'price',
      'unitPrice',
      'category',
      'description',
      'is_active',
      'isActive',
      'variants',
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
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    const r = await req.app.locals.db.collection('products').updateOne({ _id: oid(id) }, { $set: set });
    if (!r.matchedCount) return notFound(res, 'Product');
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
    const filter = req.session?.user?.role === 'ADMIN' && req.query.all === 'true' ? {} : { is_active: true };
    const addons = await db.collection('addons').find(filter).toArray();
    res.json(addons);
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

    const doc = {
      _id: new ObjectId(),
      product_id: validId(req.body.productId) ? oid(req.body.productId) : null,
      name: name.slice(0, 100),
      variants: Array.isArray(req.body.variants) ? req.body.variants : [],
      price,
      unit,
      operation_note: req.body.description || req.body.operation_note ? str(req.body.description || req.body.operation_note) : null,
      image_url: str(req.body.imageUrl || req.body.image_url) || '/images/addons/default.jpg',
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
    const { id } = req.params;
    if (!validId(id)) return badId(res);
    const set = pick(req.body, [
      'name',
      'price',
      'unitPrice',
      'unit',
      'operation_note',
      'is_active',
      'isActive',
      'variants',
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
    if ('isActive' in set) {
      set.is_active = Boolean(set.isActive);
      delete set.isActive;
    }
    if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
    const r = await req.app.locals.db.collection('addons').updateOne({ _id: oid(id) }, { $set: set });
    if (!r.matchedCount) return notFound(res, 'Addon');
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
    res.json(vouchers);
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
    const { insertedId } = await req.app.locals.db.collection('vouchers').insertOne(doc);
    res.status(201).json({ id: String(insertedId), voucher: doc });
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
      'min_order_value',
      'usage_limit',
      'status',
    ]);
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

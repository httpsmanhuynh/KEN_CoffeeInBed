'use strict';
// Danh mục & Khám phá chỗ trống theo quy trình BR-D01:
// Bước 1 (UC-04): Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách — Read-only BR-C07)
// → Bước 2 (UC-05): Chọn Không gian (Space) & Gói dịch vụ (Package)
// → Bước 3 (UC-06): Danh mục món trong gói (Inclusion) & Dịch vụ mua thêm (Add-on)
// → Bước 4 (UC-07): Danh mục Voucher áp dụng tại Checkout.
const express = require('express');
const { ObjectId } = require('mongodb');
const { wrap, fail, str } = require('../utils/http');
const {
  BookingError,
  resolveTimeWindow,
  evaluateSpaceAvailability,
  searchAvailableSpaces,
} = require('../services/bookingService');

const router = express.Router();

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

// GET /api/zones — Danh sách khu vực (KÉN Kết Nối, KÉN Tập Trung, KÉN Tái Tạo — UC-04 Bước 1)
router.get(
  '/zones',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = { is_active: true };
    if (req.query.bookable === 'true') filter.is_bookable = true;
    const zones = await db.collection('zones').find(filter).toArray();
    res.json(zones);
  }),
);

// GET /api/spaces — Bước 1 (UC-04): Khám phá danh sách không gian & Kiểm tra chỗ trống theo Ngày, Giờ bắt đầu, Số khách (Read-only BR-C07)
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

// GET /api/packages — Danh sách gói dịch vụ
router.get(
  '/packages',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = { is_active: true };
    const zoneId = str(req.query.zoneId);
    if (zoneId && ObjectId.isValid(zoneId)) filter.zone_id = new ObjectId(zoneId);
    const packages = await db.collection('packages').find(filter).toArray();
    res.json(packages);
  }),
);

// GET /api/products — Menu đồ uống & bánh (KÉN Kết Nối & chọn món trong gói Inclusion ở Bước 3 UC-06)
router.get(
  '/products',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = { is_active: true };
    const category = str(req.query.category).toUpperCase();
    if (category) filter.category = category;
    const products = await db.collection('products').find(filter).toArray();
    res.json(products);
  }),
);

// GET /api/addons — Danh sách dịch vụ mua thêm (Bước 3 UC-06)
router.get(
  '/addons',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const addons = await db.collection('addons').find({ is_active: true }).toArray();
    res.json(addons);
  }),
);

// GET /api/vouchers — Danh sách mã ưu đãi đang hoạt động (Bước 4 UC-07)
router.get(
  '/vouchers',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const vouchers = await db.collection('vouchers').find({ status: 'ACTIVE' }).toArray();
    res.json(vouchers);
  }),
);

// POST /api/availability — Kiểm tra chỗ trống chế độ Read-only (BR-C07):
// - Bước 1 (UC-04): truyền { startAt, guestCount, zoneId?, ... } → trả danh sách Space khả dụng kèm Package tương thích
// - Bước 2 (UC-05): truyền { spaceId, packageId, startAt, guestCount, hours? } → kiểm tra khung giờ cụ thể của Space + Package
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

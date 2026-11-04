'use strict';
// Các API Đặt không gian theo chuẩn BR-D01:
// Bước 1 (UC-04): Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách) -> xem catalog.js
// Bước 2 (UC-05): Chọn Không gian (Space) & Gói dịch vụ (Package) + Book Now qua Auth Guard (POST /api/bookings/select-package)
// Bước 3 (UC-06): Chọn món trong gói (Inclusion) & Dịch vụ mua thêm (Add-on) (POST /api/bookings/quote)
// Bước 4 (UC-07, UC-08): Checkout — Áp dụng Voucher, Xem Booking Summary & Xác nhận giữ chỗ 15 phút (POST /api/bookings)
// Bước 5 (UC-09, UC-10, UC-25, UC-26): Payment -> Confirmation -> Check-in -> Sử dụng -> Check-out.
const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole } = require('../middleware/auth');
const { wrap, fail } = require('../utils/http');
const {
  BookingError,
  selectSpaceAndPackage,
  buildBookingQuote,
  createBooking,
  payBooking,
  cancelBooking,
  rescheduleBooking,
  checkInBooking,
  checkOutBooking,
  markNoShowBooking,
  expirePendingBookings,
  reconcileRefund,
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

// POST /api/bookings/select-package — Bước 2 (UC-05, BR-A04): Chọn Space & Package và nhấn Book Now (qua Auth Guard)
router.post(
  '/select-package',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const sel = await selectSpaceAndPackage(db, {
        spaceId: req.body.spaceId,
        packageId: req.body.packageId,
        startAt: req.body.startAt,
        endAt: req.body.endAt,
        hours: req.body.hours,
        guestCount: req.body.guestCount ?? req.body.guests,
      });
      res.json({
        ok: true,
        spaceId: String(sel.space._id),
        spaceName: sel.space.name,
        zoneId: String(sel.zone._id),
        zoneName: sel.zone.name,
        packageId: String(sel.pkg._id),
        packageName: sel.pkg.name,
        packageType: sel.pkg.package_type,
        pricingUnit: sel.pkg.pricing_unit,
        guestCount: sel.guestCount,
        startAt: sel.startAt,
        endAt: sel.endAt,
        blockedUntil: sel.blockedUntil,
        durationHours: sel.durationHours,
        remainingCapacity: sel.remainingCapacity,
        baseUnitPrice: sel.baseUnitPrice,
        packagePrice: sel.packagePrice,
        fixedInclusionsSnapshot: sel.fixedInclusionsSnapshot,
        selectableInclusions: sel.selectableInclusions,
      });
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/quote — Bước 3 & Bước 4 (UC-06, UC-07): Chọn Inclusion & Add-on, áp dụng Voucher và xem Booking Summary
router.post(
  '/quote',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      let user = null;
      if (req.session && req.session.user && ObjectId.isValid(req.session.user.id)) {
        user = await db
          .collection('users')
          .findOne({ _id: new ObjectId(req.session.user.id), status: 'ACTIVE' });
      }
      const quote = await buildBookingQuote(db, {
        spaceId: req.body.spaceId,
        packageId: req.body.packageId,
        startAt: req.body.startAt,
        endAt: req.body.endAt,
        hours: req.body.hours,
        guestCount: req.body.guestCount ?? req.body.guests,
        inclusions: req.body.inclusions,
        addons: req.body.addons,
        voucherCode: req.body.voucherCode,
        user,
      });
      res.json({
        spaceId: String(quote.space._id),
        spaceName: quote.space.name,
        packageId: String(quote.pkg._id),
        packageName: quote.pkg.name,
        startAt: quote.timeWindow.startAt,
        endAt: quote.timeWindow.endAt,
        blockedUntil: quote.timeWindow.blockedUntil,
        durationHours: quote.timeWindow.durationHours,
        guestCount: quote.guests,
        fixedInclusionsSnapshot: quote.fixedInclusionsSnapshot,
        inclusions: quote.inclusionDocs,
        addons: quote.addonDocs,
        voucherCode: quote.voucherDoc ? quote.voucherDoc.code : null,
        tierCode: quote.tierCode,
        tierRate: quote.tierRate,
        pricing: quote.pricing,
      });
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings — Bước 4 (UC-08): Checkout — Xác nhận Booking Summary, tạo đơn PENDING_PAYMENT giữ chỗ 15 phút
router.post(
  '/',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const booking = await createBooking(db, {
        user: req.user,
        spaceId: req.body.spaceId,
        packageId: req.body.packageId,
        startAt: req.body.startAt,
        endAt: req.body.endAt,
        hours: req.body.hours,
        guestCount: req.body.guestCount ?? req.body.guests,
        inclusions: req.body.inclusions,
        addons: req.body.addons,
        voucherCode: req.body.voucherCode,
        expectedFinalAmount: req.body.expectedFinalAmount,
      });
      res.status(201).json(booking);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// GET /api/bookings/me — Lịch sử đặt chỗ của khách đang đăng nhập (UC-11)
router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const filter = { user_id: req.user._id };
    if (typeof req.query.status === 'string' && req.query.status.trim()) {
      filter.status = req.query.status.trim().toUpperCase();
    }
    const bookings = await db
      .collection('bookings')
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();
    res.json(bookings);
  }),
);

// POST /api/bookings/expire-holds — Quét & chuyển các đơn giữ chỗ quá hạn sang EXPIRED (UC-36)
router.post(
  '/expire-holds',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const result = await expirePendingBookings(db);
    res.json(result);
  }),
);

// GET /api/bookings/:id — Chi tiết đơn đặt chỗ kèm Inclusions, Add-ons, Giao dịch thanh toán
router.get(
  '/:id',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const id = req.params.id;
    if (!ObjectId.isValid(id) || id.length !== 24) {
      return fail(res, 400, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
    }
    const bOid = new ObjectId(id);
    const booking = await db.collection('bookings').findOne({ _id: bOid });
    if (!booking) return fail(res, 404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
    if (req.user.role !== 'ADMIN' && String(booking.user_id) !== String(req.user._id)) {
      return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xem đơn này');
    }

    const [inclusions, addons, transactions] = await Promise.all([
      db.collection('booking_inclusions').find({ booking_id: bOid }).toArray(),
      db.collection('booking_addons').find({ booking_id: bOid }).toArray(),
      db
        .collection('payment_transactions')
        .find({ booking_id: bOid })
        .sort({ created_at: 1 })
        .toArray(),
    ]);

    res.json({ ...booking, inclusions, addons, transactions });
  }),
);

// POST /api/bookings/:id/pay — Thanh toán đơn giữ chỗ (Bước 5, UC-09, UC-10)
router.post(
  '/:id/pay',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const out = await payBooking(db, {
        bookingId: req.params.id,
        user: req.user,
        result: req.body.result || 'SUCCESS',
      });
      res.json(out);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/:id/cancel — Khách hàng hủy đơn (UC-12, UC-14)
router.post(
  '/:id/cancel',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const out = await cancelBooking(db, {
        bookingId: req.params.id,
        user: req.user,
        refundResult: req.body.refundResult || 'SUCCESS',
      });
      res.json(out);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/:id/reschedule — Khách hàng đổi giờ đặt chỗ (UC-13, UC-15)
router.post(
  '/:id/reschedule',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const updated = await rescheduleBooking(db, {
        bookingId: req.params.id,
        user: req.user,
        newStartAt: req.body.newStartAt || req.body.startAt,
      });
      res.json(updated);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/:id/check-in — Admin Check-in tại quầy (UC-25)
router.post(
  '/:id/check-in',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const updated = await checkInBooking(db, { bookingId: req.params.id });
      res.json(updated);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/:id/check-out — Admin Check-out & cộng điểm thưởng (UC-26)
router.post(
  '/:id/check-out',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const updated = await checkOutBooking(db, { bookingId: req.params.id });
      res.json(updated);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/:id/no-show — Admin đánh dấu No-show (UC-27)
router.post(
  '/:id/no-show',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const updated = await markNoShowBooking(db, { bookingId: req.params.id });
      res.json(updated);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/bookings/:id/refund-reconcile — Admin xử lý hoàn tiền lỗi (UC-28)
router.post(
  '/:id/refund-reconcile',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const updated = await reconcileRefund(db, {
        bookingId: req.params.id,
        adminUser: req.user,
        note: req.body.note,
      });
      res.json(updated);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

module.exports = router;

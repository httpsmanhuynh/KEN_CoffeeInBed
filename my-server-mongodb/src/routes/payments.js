'use strict';
// Routes: Thanh toán (payment_transactions)
// BR-E01/E02/E03: amount khớp, trong hạn hold, booking PENDING_PAYMENT.
// Idempotent: cùng idempotencyKey → trả lại transaction cũ, không tạo mới.
// Collections: payment_transactions, bookings.
const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { wrap, fail, str } = require('../utils/http');
const {
  PAYMENT_STATUSES, PAYMENT_METHODS, validatePayment, bookingStatusAfterPayment,
} = require('../domain/payment');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

// ─── POST /api/payments — tạo giao dịch thanh toán ───
// Body: { bookingId, amount, method, idempotencyKey, status? }
// status mặc định SUCCESS (đồ án: giả lập cổng thanh toán trả kết quả liền).
router.post(
  '/',
  requireAuth,
  limiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const bookingId  = str(req.body.bookingId);
    const iKey       = str(req.body.idempotencyKey); // unique string do client tự sinh
    const method     = str(req.body.method).toUpperCase();
    const amount     = req.body.amount;
    const payStatus  = str(req.body.status || 'SUCCESS').toUpperCase();

    // ── Validate cơ bản ──
    if (!bookingId || !ObjectId.isValid(bookingId))
      return fail(res, 422, 'VALIDATION_ERROR', 'bookingId không hợp lệ');
    if (!iKey || iKey.length > 128)
      return fail(res, 422, 'VALIDATION_ERROR', 'idempotencyKey bắt buộc (tối đa 128 ký tự)');
    if (!PAYMENT_METHODS.includes(method))
      return fail(res, 422, 'VALIDATION_ERROR', `method phải là: ${PAYMENT_METHODS.join(', ')}`);
    if (!Object.values(PAYMENT_STATUSES).includes(payStatus))
      return fail(res, 422, 'VALIDATION_ERROR', 'status không hợp lệ');

    // ── Idempotency: trả lại giao dịch cũ nếu cùng key ──
    const existing = await db.collection('payment_transactions').findOne({ idempotency_key: iKey });
    if (existing) {
      // Nếu key khớp nhưng bookingId khác → 409 conflict
      if (String(existing.booking_id) !== String(new ObjectId(bookingId)))
        return fail(res, 409, 'IDEMPOTENCY_CONFLICT', 'idempotencyKey đã dùng cho booking khác');
      return res.status(200).json({ idempotent: true, transaction: fmt(existing) });
    }

    // ── Lấy booking + validate ──
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(bookingId) });

    // Chỉ user sở hữu booking hoặc ADMIN mới được thanh toán
    const actorId = req.session.user.id;
    const isAdmin = req.session.user.role === 'ADMIN';
    if (!isAdmin && booking && String(booking.user_id) !== actorId)
      return fail(res, 403, 'FORBIDDEN', 'Không có quyền thanh toán đơn này');

    const check = validatePayment({ booking, amount, now: Date.now() });
    if (!check.ok) {
      const statusMap = {
        BOOKING_NOT_FOUND:  [404, 'NOT_FOUND'],
        BOOKING_NOT_PAYABLE:[422, 'BOOKING_NOT_PAYABLE'],
        HOLD_EXPIRED:       [422, 'HOLD_EXPIRED'],
        INVALID_AMOUNT:     [422, 'VALIDATION_ERROR'],
        AMOUNT_MISMATCH:    [422, 'AMOUNT_MISMATCH'],
      };
      const [httpStatus, code] = statusMap[check.reason] || [422, check.reason];
      return fail(res, httpStatus, code, check.reason);
    }

    const now = new Date();

    // ── Ghi payment_transaction ──
    const txDoc = {
      booking_id:      new ObjectId(bookingId),
      user_id:         new ObjectId(actorId),
      idempotency_key: iKey,
      method,
      amount,
      status:          payStatus,
      created_at:      now,
      updated_at:      now,
    };
    const { insertedId } = await db.collection('payment_transactions').insertOne(txDoc);

    // ── Cập nhật booking nếu SUCCESS ──
    if (payStatus === PAYMENT_STATUSES.SUCCESS) {
      const newBookingStatus = bookingStatusAfterPayment(payStatus); // 'CONFIRMED'
      await db.collection('bookings').updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { status: newBookingStatus, paid_at: now, updated_at: now } },
      );
    }

    res.status(201).json({ transaction: fmt({ ...txDoc, _id: insertedId }) });
  }),
);

// ─── POST /api/payments/:id/cancel — huỷ giao dịch PENDING ───
router.post(
  '/:id/cancel',
  requireAuth,
  limiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return fail(res, 422, 'VALIDATION_ERROR', 'id không hợp lệ');

    const tx = await db.collection('payment_transactions').findOne({ _id: new ObjectId(id) });
    if (!tx) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy giao dịch');

    const isAdmin = req.session.user.role === 'ADMIN';
    if (!isAdmin && String(tx.user_id) !== req.session.user.id)
      return fail(res, 403, 'FORBIDDEN', 'Không có quyền huỷ giao dịch này');

    if (tx.status !== PAYMENT_STATUSES.PENDING)
      return fail(res, 422, 'NOT_CANCELLABLE', `Giao dịch ở trạng thái ${tx.status}, không thể huỷ`);

    const now = new Date();
    await db.collection('payment_transactions').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: PAYMENT_STATUSES.CANCELLED, updated_at: now } },
    );
    res.json({ status: PAYMENT_STATUSES.CANCELLED });
  }),
);

// ─── GET /api/payments/booking/:bookingId — lịch sử thanh toán của 1 đơn ───
router.get(
  '/booking/:bookingId',
  requireAuth,
  limiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const { bookingId } = req.params;
    if (!ObjectId.isValid(bookingId))
      return fail(res, 422, 'VALIDATION_ERROR', 'bookingId không hợp lệ');

    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(bookingId) });
    const isAdmin = req.session.user.role === 'ADMIN';
    if (!isAdmin && booking && String(booking.user_id) !== req.session.user.id)
      return fail(res, 403, 'FORBIDDEN', 'Không có quyền xem đơn này');

    const transactions = await db
      .collection('payment_transactions')
      .find({ booking_id: new ObjectId(bookingId) })
      .sort({ created_at: -1 })
      .toArray();

    res.json({ transactions: transactions.map(fmt) });
  }),
);

// ─── GET /api/payments — ADMIN: danh sách giao dịch (paginated) ───
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  limiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 200);
    const page   = Math.max(parseInt(req.query.page,   10) || 1,  1);
    const skip   = (page - 1) * limit;
    const status = str(req.query.status).toUpperCase() || undefined;

    const filter = status && Object.values(PAYMENT_STATUSES).includes(status)
      ? { status } : {};

    const [transactions, total] = await Promise.all([
      db.collection('payment_transactions')
        .find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('payment_transactions').countDocuments(filter),
    ]);

    res.json({ transactions: transactions.map(fmt), total, page, limit });
  }),
);

// ─── Helper ───
function fmt(tx) {
  return {
    id:             String(tx._id),
    bookingId:      String(tx.booking_id),
    userId:         String(tx.user_id),
    idempotencyKey: tx.idempotency_key,
    method:         tx.method,
    amount:         tx.amount,
    status:         tx.status,
    createdAt:      tx.created_at,
    updatedAt:      tx.updated_at,
  };
}

module.exports = router;

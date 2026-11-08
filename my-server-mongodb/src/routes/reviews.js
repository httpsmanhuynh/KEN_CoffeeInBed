'use strict';
// Routes: Quản lý Đánh giá (Review Management — Module 10, UC-16, BR-H01, BR-F03, BR-D06, FR-4.3).
// - POST /api/reviews: Tạo đánh giá mới (kiểm tra đơn chính chủ + CHECKED_OUT + chặn trùng 01 đánh giá/Booking trong Transaction).
// - GET  /api/reviews/me: Danh sách đánh giá của khách đang đăng nhập + danh sách lời nhắc đánh giá (pendingReminders).
// - GET  /api/reviews/booking/:bookingId: Kiểm tra điều kiện đánh giá & xem đánh giá của 01 Booking (chế độ chỉ xem nếu đã đánh giá).
// - GET  /api/reviews/space/:spaceId: Xem danh sách đánh giá, điểm trung bình & phân bố sao theo Không gian (Space).
// - GET  /api/reviews: Xem danh sách đánh giá (lọc theo spaceId, bookingId, userId, rating).
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { wrap, str } = require('../utils/http');
const { BookingError } = require('../services/bookingService');
const {
  getBookingReviewStatus,
  createReview,
  listMyReviewsAndReminders,
  listSpaceReviews,
  listReviews,
} = require('../services/reviewService');

const router = express.Router();
const reviewWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: (req) => `review:${req.session?.user?.id || req.ip}`,
});

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

// GET /api/reviews/me — Xem đánh giá đã gửi & danh sách lời nhắc đánh giá của khách đang đăng nhập
router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const result = await listMyReviewsAndReminders(db, { user: req.user });
      res.json(result);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// GET /api/reviews/booking/:bookingId — Kiểm tra điều kiện đánh giá & xem đánh giá của 1 Booking (UC-16 bước 2–4, AF1, AF2)
router.get(
  '/booking/:bookingId',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const status = await getBookingReviewStatus(db, {
        user: req.user,
        bookingId: req.params.bookingId,
      });
      res.json(status);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// GET /api/reviews/space/:spaceId — Xem đánh giá & thống kê sao của 1 Không gian (Public)
router.get(
  '/space/:spaceId',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const result = await listSpaceReviews(db, { spaceId: req.params.spaceId });
      res.json(result);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// GET /api/reviews — Danh sách đánh giá (lọc theo spaceId, bookingId, userId, rating)
router.get(
  '/',
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const result = await listReviews(db, {
        spaceId: str(req.query.spaceId) || null,
        bookingId: str(req.query.bookingId) || null,
        userId: str(req.query.userId) || null,
        rating: req.query.rating !== undefined ? req.query.rating : null,
      });
      res.json(result);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

// POST /api/reviews — Tạo đánh giá mới cho Booking chính chủ đã CHECKED_OUT (UC-16, BR-H01)
router.post(
  '/',
  requireAuth,
  reviewWriteLimiter,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    try {
      const review = await createReview(db, {
        user: req.user,
        bookingId: req.body.bookingId || req.body.booking_id,
        rating: req.body.rating,
        comment: req.body.comment,
      });
      res.status(201).json(review);
    } catch (err) {
      return handleErr(res, err);
    }
  }),
);

module.exports = router;

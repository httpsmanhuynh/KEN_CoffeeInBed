'use strict';

/**
 * Module 12 — Recommendation & Forecast API.
 * - Top Trending (không phân role):
 *     GET /api/recommendations
 *     GET /api/recommendations/top-trending
 * - Booking Menu Recommendation (phân theo nhóm khách hàng ML trong luồng Booking — Inclusion & Add-ons):
 *     GET /api/recommendations/booking
 *     (đồng thời có alias GET /api/bookings/recommendations trong routes/bookings.js)
 * - Admin Forecast Routes:
 *     GET  /api/admin/forecast
 *     GET  /api/admin/forecast/ingredients
 *     GET  /api/admin/forecast/ingredients/:id
 *     POST /api/admin/forecast/ingredients/:id/movements
 *     GET  /api/admin/forecast/trends
 *     GET  /api/admin/forecast/alerts
 *     PATCH /api/admin/forecast/alerts/:id
 */

const express = require('express');
const { ObjectId } = require('mongodb');
const { requireRole } = require('../middleware/auth');
const { AdminError } = require('../domain/adminError');
const forecastSvc = require('../services/forecastService');

let adminLimit = (_req, _res, next) => next();
try {
  const rl = require('../middleware/rateLimit');
  if (typeof rl.adminLimit === 'function') adminLimit = rl.adminLimit;
} catch (_) {
  /* không có rateLimit: bỏ qua */
}

function getDb(req) {
  return req.app.locals.db || req.db || req.app.get('db');
}

function sendError(res, err) {
  if (err instanceof AdminError) {
    return res.status(err.status).json({
      code: err.code,
      error: err.code,
      message: err.message,
    });
  }
  throw err;
}

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req, getDb(req));
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

/**
 * Giải mã user từ session nếu đã đăng nhập (Optional Auth cho luồng Booking Recommendation).
 * Nếu session/DB lỗi bất ngờ -> trả null để tự động fallback sang xu hướng chung.
 */
async function resolveOptionalUser(req) {
  try {
    if (req.user) return req.user;
    const sessUser = req.session && req.session.user;
    if (!sessUser || !sessUser.id) return null;
    const db = getDb(req);
    if (!db || !ObjectId.isValid(String(sessUser.id))) return null;
    const user = await db.collection('users').findOne({ _id: new ObjectId(String(sessUser.id)) });
    if (!user || user.status !== 'ACTIVE') return null;
    return user;
  } catch (_) {
    return null;
  }
}

/* ---- Router 1: Recommendations (/api/recommendations*) ---- */
const recommendationRouter = express.Router();

// Top Trending cho Pop-up (không phân role)
recommendationRouter.get(
  '/recommendations',
  handle((req, db) => forecastSvc.getTopTrendingRecommendations(db, req.query, 6)),
);

// Trang Top Trending (gắn trên footer, không phân role)
recommendationRouter.get(
  '/recommendations/top-trending',
  handle((req, db) => forecastSvc.getTopTrendingRecommendations(db, req.query, 12)),
);

// Recommend phân theo nhóm khách hàng (ml_cluster_id) trong luồng Booking (menu Inclusion & Add-ons)
recommendationRouter.get(
  '/recommendations/booking',
  handle(async (req, db) => {
    const user = await resolveOptionalUser(req);
    return forecastSvc.getBookingMenuRecommendations(db, req.query, user);
  }),
);

/* ---- Router 2: Admin Forecast (/api/admin/forecast/*) ---- */
const adminForecastRouter = express.Router();
const guard = [requireRole('ADMIN'), adminLimit];

adminForecastRouter.get(
  '/',
  guard,
  handle((req, db) => forecastSvc.listIngredientForecasts(db, req.query)),
);

adminForecastRouter.get(
  '/ingredients',
  guard,
  handle((req, db) => forecastSvc.listIngredientForecasts(db, req.query)),
);

adminForecastRouter.get(
  '/ingredients/:id',
  guard,
  handle((req, db) => forecastSvc.getIngredientForecastDetail(db, req.params.id, req.query)),
);

adminForecastRouter.post(
  '/ingredients/:id/movements',
  guard,
  handle(async (req, db) => {
    return forecastSvc.createIngredientMovement(db, req.params.id, req.body, req.user);
  }),
);

adminForecastRouter.get(
  '/trends',
  guard,
  handle((req, db) => forecastSvc.getForecastTrends(db, req.query)),
);

adminForecastRouter.get(
  '/alerts',
  guard,
  handle((req, db) => forecastSvc.listInventoryAlerts(db, req.query)),
);

adminForecastRouter.patch(
  '/alerts/:id',
  guard,
  handle((req, db) => forecastSvc.updateInventoryAlertStatus(db, req.params.id, req.body, req.user)),
);

module.exports = {
  recommendationRouter,
  adminForecastRouter,
  resolveOptionalUser,
};

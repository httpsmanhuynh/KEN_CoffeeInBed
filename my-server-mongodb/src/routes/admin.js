'use strict';

/**
 * Module 11 — Admin Management & Dashboard (mount: app.use('/api/admin', require('./src/routes/admin'))).
 * Toàn bộ route yêu cầu ADMIN; requireRole('ADMIN') đã đọc lại DB (BR-A05).
 */

const express = require('express');
const { requireRole } = require('../middleware/auth');
const { AdminError } = require('../domain/adminError');
const svc = require('../services/adminService');

let adminLimit = (_req, _res, next) => next();
try {
  const rl = require('../middleware/rateLimit');
  if (typeof rl.adminLimit === 'function') adminLimit = rl.adminLimit;
} catch (_) { /* không có rateLimit: bỏ qua giới hạn */ }

const router = express.Router();
const guard = [requireRole('ADMIN'), adminLimit];

/** Lấy db — chỉnh đúng 1 chỗ này nếu dự án truyền db theo cách khác. */
function getDb(req) {
  return req.app.locals.db || req.db || req.app.get('db');
}

function sendError(res, err) {
  if (err instanceof AdminError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  throw err; // lỗi không lường trước -> error handler chung của index.js
}

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, getDb(req)));
  } catch (err) {
    sendError(res, err);
  }
};

/* ---- Khách hàng ---- */
router.get('/users', guard, handle((req, db) => svc.listUsers(db, req.query)));
router.get('/users/:id', guard, handle((req, db) => svc.getUserProfile(db, req.params.id)));
router.get('/users/:id/bookings', guard, handle((req, db) => svc.listUserBookings(db, req.params.id, req.query)));
router.post('/users/:id/lock', guard, handle(async (req, db) => ({
  user: await svc.setUserStatus(db, { actor: req.user, targetId: req.params.id, action: 'lock' }),
})));
router.post('/users/:id/unlock', guard, handle(async (req, db) => ({
  user: await svc.setUserStatus(db, { actor: req.user, targetId: req.params.id, action: 'unlock' }),
})));

/* ---- Dashboard ---- */
router.get('/dashboard', guard, handle((req, db) => svc.getDashboard(db, req.query)));

module.exports = router;

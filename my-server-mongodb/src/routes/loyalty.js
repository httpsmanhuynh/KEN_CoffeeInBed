'use strict';
// Routes loyalty: ghi nhận điểm khi checkout, đổi Coins / đổi Voucher, xem lịch sử, cuối năm rollover.
// Collections dùng: users, membership_tiers, loyalty_transactions, vouchers, user_vouchers
// (tuân thủ chặt chẽ loyalty_transactions.validator.json và user_vouchers.validator.json).
const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TIERS, applyEarn, redeemCoins, yearRollover } = require('../domain/loyalty');
const { wrap, fail, str } = require('../utils/http');

const router = express.Router();

// ─── Public: bảng hạng thành viên (BR-H04) ───
router.get('/tiers', (_req, res) => res.json(TIERS));

// ─── POST /api/loyalty/earn — gọi khi Check-out (BR-H03, BR-H04) ───
// Body: { bookingId }. Admin hoặc system gọi sau khi chuyển trạng thái CHECKED_OUT (idempotent).
router.post(
  '/earn',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const bookingId = str(req.body.bookingId);
    if (!bookingId || !ObjectId.isValid(bookingId)) {
      return fail(res, 422, 'VALIDATION_ERROR', 'bookingId không hợp lệ');
    }

    const bOid = new ObjectId(bookingId);
    const booking = await db.collection('bookings').findOne({ _id: bOid });
    if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
    if (booking.status !== 'CHECKED_OUT') {
      return fail(res, 422, 'INVALID_STATUS', 'Đơn chưa ở trạng thái CHECKED_OUT');
    }

    // Chống cộng điểm hai lần (idempotent): kiểm tra loyalty_transactions đã có bản ghi EARN cho booking này chưa
    const existing = await db.collection('loyalty_transactions').findOne({
      booking_id: bOid,
      type: 'EARN',
    });
    if (existing) {
      return fail(res, 409, 'ALREADY_EARNED', 'Đơn này đã được ghi nhận điểm');
    }

    const user = await db.collection('users').findOne({ _id: booking.user_id });
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');

    const tierDoc = user.tier_id
      ? await db.collection('membership_tiers').findOne({ _id: user.tier_id })
      : null;
    const currentTierCode = tierDoc ? tierDoc.code : 'BASIC';

    const account = {
      tier: currentTierCode,
      tierPoints: Number(user.tier_points || 0),
      coins: Number(user.coin_balance || 0),
    };
    const result = applyEarn(account, Number(booking.final_amount || 0));

    const newTierDoc = await db.collection('membership_tiers').findOne({ code: result.tier });
    if (!newTierDoc) return fail(res, 500, 'TIER_NOT_FOUND', 'Không tìm thấy hạng thành viên');

    const now = new Date();
    const tierChanged = result.tier !== currentTierCode;

    // Ghi loyalty_transactions theo đúng schema loyalty_transactions.validator.json
    await db.collection('loyalty_transactions').insertOne({
      _id: new ObjectId(),
      user_id: user._id,
      booking_id: bOid,
      type: 'EARN',
      points_delta: result.earned.points,
      coins_delta: result.earned.coins,
      points_after: result.tierPoints,
      coins_after: result.coins,
      note: `Cộng điểm đơn #${booking.booking_code || bookingId}`,
      created_at: now,
    });

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          tier_id: newTierDoc._id,
          tier_points: result.tierPoints,
          coin_balance: result.coins,
          updated_at: now,
        },
      },
    );

    res.json({
      earned: result.earned,
      tierPoints: result.tierPoints,
      coins: result.coins,
      tier: result.tier,
      tierChanged,
      previousTier: currentTierCode,
    });
  }),
);

// ─── POST /api/loyalty/redeem — đổi KÉN Coins lấy Voucher hoặc trừ Coins (UC-17, BR-H06, BR-I04) ───
// Body: { voucherId } hoặc { cost, voucherId?, description? }. Chỉ trừ Coins, không đụng Điểm/hạng.
router.post(
  '/redeem',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const user = req.user;
    const voucherIdRaw = str(req.body.voucherId);
    let cost = req.body.cost;
    let voucher = null;

    const now = new Date();
    if (voucherIdRaw) {
      if (!ObjectId.isValid(voucherIdRaw)) {
        return fail(res, 422, 'VALIDATION_ERROR', 'voucherId không hợp lệ');
      }
      voucher = await db.collection('vouchers').findOne({ _id: new ObjectId(voucherIdRaw) });
      if (!voucher || voucher.status !== 'ACTIVE' || !(voucher.coins_cost > 0)) {
        return fail(res, 404, 'VOUCHER_NOT_REDEEMABLE', 'Voucher không tồn tại hoặc không hỗ trợ đổi bằng Coins');
      }
      if (voucher.redeem_valid_to && now > new Date(voucher.redeem_valid_to)) {
        return fail(res, 422, 'VOUCHER_REDEEM_EXPIRED', 'Voucher đã hết thời hạn đổi Coins');
      }
      if (voucher.redeem_limit > 0 && voucher.redeem_count >= voucher.redeem_limit) {
        return fail(res, 409, 'VOUCHER_REDEEM_EXHAUSTED', 'Voucher đã hết lượt đổi bằng Coins');
      }
      cost = Number(voucher.coins_cost);
    }

    if (!Number.isInteger(cost) || cost <= 0) {
      return fail(res, 422, 'VALIDATION_ERROR', 'Số Coins phải là số nguyên dương');
    }

    const account = { coins: Number(user.coin_balance || 0) };
    const result = redeemCoins(account, cost);
    if (!result.ok) {
      return fail(res, 422, 'INSUFFICIENT_COINS', 'Không đủ Coins');
    }

    const vOid = voucher ? voucher._id : new ObjectId();
    const note = str(req.body.description) || (voucher ? `Đổi mã ${voucher.code}` : 'Đổi Coins');

    if (voucher) {
      const upd = await db.collection('vouchers').updateOne(
        {
          _id: voucher._id,
          status: 'ACTIVE',
          redeem_count: { $lt: voucher.redeem_limit },
        },
        { $inc: { redeem_count: 1 }, $set: { updated_at: now } },
      );
      if (upd.modifiedCount !== 1) {
        return fail(res, 409, 'VOUCHER_REDEEM_EXHAUSTED', 'Voucher đã hết lượt đổi bằng Coins');
      }
      await db.collection('user_vouchers').insertOne({
        _id: new ObjectId(),
        user_id: user._id,
        voucher_id: voucher._id,
        coins_spent: cost,
        redeemed_at: now,
      });
    }

    await db.collection('loyalty_transactions').insertOne({
      _id: new ObjectId(),
      user_id: user._id,
      voucher_id: vOid,
      type: 'REDEEM',
      points_delta: 0,
      coins_delta: -cost,
      points_after: Number(user.tier_points || 0),
      coins_after: result.coins,
      note: note.slice(0, 200),
      created_at: now,
    });

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { coin_balance: result.coins, updated_at: now } },
    );

    res.json({
      coins: result.coins,
      redeemed: cost,
      ...(voucher ? { voucherCode: voucher.code, voucherId: String(voucher._id) } : {}),
    });
  }),
);

// ─── GET /api/loyalty/my-vouchers — ví Voucher đã đổi bằng Coins của khách hàng ───
router.get(
  '/my-vouchers',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const wallet = await db
      .collection('user_vouchers')
      .find({ user_id: req.user._id })
      .sort({ redeemed_at: -1 })
      .toArray();
    res.json({ vouchers: wallet });
  }),
);

// ─── GET /api/loyalty/history — lịch sử loyalty của user đang đăng nhập (UC-16) ───
router.get(
  '/history',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db
        .collection('loyalty_transactions')
        .find({ user_id: userId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('loyalty_transactions').countDocuments({ user_id: userId }),
    ]);

    res.json({ transactions, total, page, limit });
  }),
);

// ─── POST /api/loyalty/year-rollover — cuối năm hạ 1 bậc hạng + reset Coins (UC-37, BR-H04, BR-H05) ───
router.post(
  '/year-rollover',
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const users = await db.collection('users').find({ role: 'CUSTOMER' }).toArray();
    const now = new Date();
    const year = Number(req.body.year) || now.getFullYear();
    let processed = 0;

    for (const user of users) {
      const tierDoc = user.tier_id
        ? await db.collection('membership_tiers').findOne({ _id: user.tier_id })
        : null;
      const tierCode = tierDoc ? tierDoc.code : 'BASIC';
      const account = {
        tier: tierCode,
        tierPoints: Number(user.tier_points || 0),
        coins: Number(user.coin_balance || 0),
      };

      const result = yearRollover(account);
      const newTierDoc = await db.collection('membership_tiers').findOne({ code: result.tier });
      if (!newTierDoc) continue;

      await db.collection('loyalty_transactions').insertOne({
        _id: new ObjectId(),
        user_id: user._id,
        type: 'YEAR_RESET',
        year,
        points_delta: result.tierPoints - account.tierPoints,
        coins_delta: -result.coinsExpired,
        points_after: result.tierPoints,
        coins_after: result.coins,
        note: `Reset hạng & Coins đầu năm ${year} (${tierCode} -> ${result.tier})`,
        created_at: now,
      });

      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            tier_id: newTierDoc._id,
            tier_points: result.tierPoints,
            coin_balance: result.coins,
            updated_at: now,
          },
        },
      );
      processed++;
    }

    res.json({ processed, year, timestamp: now.toISOString() });
  }),
);

module.exports = router;

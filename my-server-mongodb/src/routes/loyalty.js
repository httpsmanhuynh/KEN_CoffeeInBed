'use strict';
// Routes loyalty: ghi nhận điểm khi checkout, đổi Coins, xem lịch sử, cuối năm rollover.
// Collections dùng: users, membership_tiers, loyalty_transactions, loyalty_histories.
const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole } = require('../middleware/auth');
const { TIERS, applyEarn, redeemCoins, yearRollover } = require('../domain/loyalty');
const { wrap, fail } = require('../utils/http');

const router = express.Router();

// ─── Public: bảng hạng thành viên (BR-H04) ───
router.get('/tiers', (_req, res) => res.json(TIERS));

// ─── POST /api/loyalty/earn — gọi khi Check-out (BR-H03, BR-H04) ───
// Body: { bookingId }. Admin hoặc system gọi sau khi chuyển trạng thái CHECKED_OUT.
router.post(
  '/earn',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const bookingId = req.body.bookingId;
    if (!bookingId || !ObjectId.isValid(bookingId))
      return fail(res, 422, 'VALIDATION_ERROR', 'bookingId không hợp lệ');

    // Tìm booking đã CHECKED_OUT
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(bookingId) });
    if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
    if (booking.status !== 'CHECKED_OUT')
      return fail(res, 422, 'INVALID_STATUS', 'Đơn chưa ở trạng thái CHECKED_OUT');

    // Chống cộng điểm hai lần (idempotent): kiểm tra loyalty_transactions đã có bản ghi EARN cho booking này chưa
    const existing = await db.collection('loyalty_transactions').findOne({
      booking_id: new ObjectId(bookingId),
      type: 'EARN',
    });
    if (existing)
      return fail(res, 409, 'ALREADY_EARNED', 'Đơn này đã được ghi nhận điểm');

    // Lấy user
    const user = await db.collection('users').findOne({ _id: booking.user_id });
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');

    // Tìm tier hiện tại
    const tierDoc = await db.collection('membership_tiers').findOne({ _id: user.tier_id });
    const currentTierCode = tierDoc ? tierDoc.code : 'BASIC';

    // Tính toán loyalty
    const account = {
      tier: currentTierCode,
      tierPoints: user.tier_points || 0,
      coins: user.coin_balance || 0,
    };
    const result = applyEarn(account, booking.final_amount || 0);

    // Tìm tier mới trong DB (membership_tiers)
    const newTierDoc = await db.collection('membership_tiers').findOne({ code: result.tier });
    if (!newTierDoc) return fail(res, 500, 'TIER_NOT_FOUND', 'Không tìm thấy hạng thành viên');

    const now = new Date();

    // Ghi loyalty_transactions (bản ghi giao dịch)
    await db.collection('loyalty_transactions').insertOne({
      user_id: user._id,
      booking_id: new ObjectId(bookingId),
      type: 'EARN',
      points: result.earned.points,
      coins: result.earned.coins,
      amount: booking.final_amount || 0,
      description: `Cộng điểm đơn #${bookingId}`,
      created_at: now,
    });

    // Ghi loyalty_histories (lịch sử thay đổi hạng/điểm)
    const tierChanged = result.tier !== currentTierCode;
    await db.collection('loyalty_histories').insertOne({
      user_id: user._id,
      booking_id: new ObjectId(bookingId),
      action: 'EARN',
      points_before: account.tierPoints,
      points_after: result.tierPoints,
      coins_before: account.coins,
      coins_after: result.coins,
      tier_before: currentTierCode,
      tier_after: result.tier,
      tier_changed: tierChanged,
      created_at: now,
    });

    // Cập nhật user
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

// ─── POST /api/loyalty/redeem — đổi Coins (BR-H06) ───
// Body: { cost, description? }. Chỉ trừ Coins, không đụng Điểm/hạng.
router.post(
  '/redeem',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.user.id;
    const cost = req.body.cost;
    const description = req.body.description || 'Đổi Coins';

    if (!Number.isInteger(cost) || cost <= 0)
      return fail(res, 422, 'VALIDATION_ERROR', 'Số Coins phải là số nguyên dương');

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');

    const account = { coins: user.coin_balance || 0 };
    const result = redeemCoins(account, cost);
    if (!result.ok)
      return fail(res, 422, 'INSUFFICIENT_COINS', 'Không đủ Coins');

    const now = new Date();

    // Ghi loyalty_transactions
    await db.collection('loyalty_transactions').insertOne({
      user_id: user._id,
      type: 'REDEEM',
      points: 0,
      coins: -cost,
      description,
      created_at: now,
    });

    // Ghi loyalty_histories — hạng không đổi
    const tierDoc = await db.collection('membership_tiers').findOne({ _id: user.tier_id });
    const tierCode = tierDoc ? tierDoc.code : 'BASIC';
    await db.collection('loyalty_histories').insertOne({
      user_id: user._id,
      action: 'REDEEM',
      points_before: user.tier_points,
      points_after: user.tier_points, // không đổi điểm
      coins_before: user.coin_balance,
      coins_after: result.coins,
      tier_before: tierCode,
      tier_after: tierCode, // không đổi hạng
      tier_changed: false,
      created_at: now,
    });

    // Cập nhật user — chỉ trừ Coins
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { coin_balance: result.coins, updated_at: now } },
    );

    res.json({ coins: result.coins, redeemed: cost });
  }),
);

// ─── GET /api/loyalty/history — lịch sử loyalty của user đang đăng nhập ───
router.get(
  '/history',
  requireAuth,
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const userId = req.session.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      db
        .collection('loyalty_transactions')
        .find({ user_id: new ObjectId(userId) })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('loyalty_transactions').countDocuments({ user_id: new ObjectId(userId) }),
    ]);

    res.json({ transactions, total, page, limit });
  }),
);

// ─── POST /api/loyalty/year-rollover — cuối năm hạ hạng + reset Coins (BR-H04, H05) ───
// Admin-only hoặc cron job gọi.
router.post(
  '/year-rollover',
  requireAuth,
  requireRole('ADMIN'),
  wrap(async (req, res) => {
    const db = req.app.locals.db;
    const users = await db.collection('users').find({ role: 'CUSTOMER' }).toArray();
    const now = new Date();
    let processed = 0;

    for (const user of users) {
      const tierDoc = await db.collection('membership_tiers').findOne({ _id: user.tier_id });
      const tierCode = tierDoc ? tierDoc.code : 'BASIC';
      const account = {
        tier: tierCode,
        tierPoints: user.tier_points || 0,
        coins: user.coin_balance || 0,
      };

      const result = yearRollover(account);
      const newTierDoc = await db.collection('membership_tiers').findOne({ code: result.tier });
      if (!newTierDoc) continue;

      // Ghi loyalty_transactions nếu có Coins bị expire
      if (result.coinsExpired > 0) {
        await db.collection('loyalty_transactions').insertOne({
          user_id: user._id,
          type: 'EXPIRE',
          points: 0,
          coins: -result.coinsExpired,
          description: `Coins hết hạn cuối năm ${now.getFullYear()}`,
          created_at: now,
        });
      }

      // Ghi loyalty_histories
      await db.collection('loyalty_histories').insertOne({
        user_id: user._id,
        action: 'YEAR_ROLLOVER',
        points_before: account.tierPoints,
        points_after: result.tierPoints,
        coins_before: account.coins,
        coins_after: result.coins,
        tier_before: tierCode,
        tier_after: result.tier,
        tier_changed: result.tier !== tierCode,
        created_at: now,
      });

      // Cập nhật user
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

    res.json({ processed, timestamp: now.toISOString() });
  }),
);

module.exports = router;

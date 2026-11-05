'use strict';
// Test hệ thống Loyalty: domain logic + route integration (mock DB in-memory).
// Chạy: node --test test/loyalty.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const L = require('../src/domain/loyalty');

// ═══════════════════════════════════════════════════
// 1. Domain-level tests (pure functions, no DB)
// ═══════════════════════════════════════════════════

test('earnFromAmount: 10.000đ = 1 Điểm + 1 Coin (BR-H03)', () => {
  assert.deepEqual(L.earnFromAmount(10000), { points: 1, coins: 1 });
  assert.deepEqual(L.earnFromAmount(55000), { points: 5, coins: 5 });
  assert.deepEqual(L.earnFromAmount(100000), { points: 10, coins: 10 });
});

test('earnFromAmount: dưới 10.000đ không cộng gì', () => {
  assert.deepEqual(L.earnFromAmount(0), { points: 0, coins: 0 });
  assert.deepEqual(L.earnFromAmount(9999), { points: 0, coins: 0 });
});

test('earnFromAmount: số lẻ làm tròn xuống', () => {
  assert.deepEqual(L.earnFromAmount(15000), { points: 1, coins: 1 });
  assert.deepEqual(L.earnFromAmount(99999), { points: 9, coins: 9 });
});

test('earnFromAmount: reject số âm và số thập phân', () => {
  assert.throws(() => L.earnFromAmount(-1), RangeError);
  assert.throws(() => L.earnFromAmount(100.5), RangeError);
});

test('applyEarn: BASIC → SILVER khi đạt 1.000 điểm (BR-H04)', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 10000000);
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.tierPoints, 1000);
  assert.equal(r.coins, 1000);
});

test('applyEarn: BASIC → GOLD nhảy nhiều hạng khi đạt 5.000 điểm', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 50000000);
  assert.equal(r.tier, 'GOLD');
  assert.equal(r.tierPoints, 5000);
  assert.equal(r.coins, 5000);
});

test('applyEarn: BASIC → DIAMOND nhảy hết khi đạt 10.000 điểm', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 100000000);
  assert.equal(r.tier, 'DIAMOND');
  assert.equal(r.tierPoints, 10000);
  assert.equal(r.coins, 10000);
});

test('applyEarn: tích lũy dần, BASIC 900 + 200 → SILVER', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 900, coins: 50 }, 2000000);
  assert.equal(r.tierPoints, 1100);
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.coins, 250);
});

test('applyEarn: không hạ hạng giữa năm dù điểm thấp', () => {
  const r = L.applyEarn({ tier: 'GOLD', tierPoints: 5000, coins: 100 }, 10000);
  assert.equal(r.tier, 'GOLD');
  assert.equal(r.tierPoints, 5001);
});

test('applyEarn: GOLD không xuống SILVER khi chỉ có 1 điểm mới', () => {
  const r = L.applyEarn({ tier: 'GOLD', tierPoints: 3000, coins: 0 }, 10000);
  assert.equal(r.tier, 'GOLD');
});

test('applyEarn: DIAMOND giữ DIAMOND khi thêm điểm', () => {
  const r = L.applyEarn({ tier: 'DIAMOND', tierPoints: 12000, coins: 500 }, 10000000);
  assert.equal(r.tier, 'DIAMOND');
  assert.equal(r.tierPoints, 13000);
  assert.equal(r.coins, 1500);
});

test('applyEarn: 0đ → 0 điểm, giữ nguyên', () => {
  const r = L.applyEarn({ tier: 'SILVER', tierPoints: 2000, coins: 100 }, 0);
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.tierPoints, 2000);
  assert.equal(r.coins, 100);
  assert.deepEqual(r.earned, { points: 0, coins: 0 });
});

test('yearRollover: DIAMOND → GOLD, Coins về 0 (BR-H04, H05)', () => {
  const r = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 500 });
  assert.equal(r.tier, 'GOLD');
  assert.equal(r.tierPoints, 5000);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 500);
});

test('yearRollover: GOLD → SILVER', () => {
  const r = L.yearRollover({ tier: 'GOLD', tierPoints: 9000, coins: 40 });
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.tierPoints, 1000);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 40);
});

test('yearRollover: SILVER → BASIC', () => {
  const r = L.yearRollover({ tier: 'SILVER', tierPoints: 3000, coins: 10 });
  assert.equal(r.tier, 'BASIC');
  assert.equal(r.tierPoints, 0);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 10);
});

test('yearRollover: BASIC giữ nguyên điểm, Coins về 0', () => {
  const r = L.yearRollover({ tier: 'BASIC', tierPoints: 700, coins: 7 });
  assert.equal(r.tier, 'BASIC');
  assert.equal(r.tierPoints, 700);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 7);
});

test('yearRollover: BASIC không Coins → coinsExpired = 0', () => {
  const r = L.yearRollover({ tier: 'BASIC', tierPoints: 300, coins: 0 });
  assert.equal(r.coinsExpired, 0);
});

test('redeemCoins: trừ đúng số Coins (BR-H06)', () => {
  const r = L.redeemCoins({ coins: 100 }, 30);
  assert.equal(r.ok, true);
  assert.equal(r.coins, 70);
});

test('redeemCoins: trừ toàn bộ Coins', () => {
  const r = L.redeemCoins({ coins: 50 }, 50);
  assert.equal(r.ok, true);
  assert.equal(r.coins, 0);
});

test('redeemCoins: không đủ Coins', () => {
  const r = L.redeemCoins({ coins: 10 }, 30);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'INSUFFICIENT_COINS');
});

test('redeemCoins: reject cost <= 0', () => {
  assert.throws(() => L.redeemCoins({ coins: 100 }, 0), RangeError);
  assert.throws(() => L.redeemCoins({ coins: 100 }, -5), RangeError);
});

test('redeemCoins: reject cost không nguyên', () => {
  assert.throws(() => L.redeemCoins({ coins: 100 }, 10.5), RangeError);
});

test('tierForPoints: đúng 4 mốc 0/1000/5000/10000', () => {
  assert.equal(L.tierForPoints(0).code, 'BASIC');
  assert.equal(L.tierForPoints(999).code, 'BASIC');
  assert.equal(L.tierForPoints(1000).code, 'SILVER');
  assert.equal(L.tierForPoints(4999).code, 'SILVER');
  assert.equal(L.tierForPoints(5000).code, 'GOLD');
  assert.equal(L.tierForPoints(9999).code, 'GOLD');
  assert.equal(L.tierForPoints(10000).code, 'DIAMOND');
  assert.equal(L.tierForPoints(99999).code, 'DIAMOND');
});

// ═══════════════════════════════════════════════════
// 2. Integration-style tests (tuân thủ loyalty_transactions.validator.json)
// ═══════════════════════════════════════════════════

function createMockCollection(initialDocs = []) {
  const docs = [...initialDocs];
  return {
    _docs: docs,
    findOne(query) {
      return Promise.resolve(
        docs.find((d) => {
          for (const [k, v] of Object.entries(query)) {
            if (v instanceof ObjectId) {
              if (String(d[k]) !== String(v)) return false;
            } else if (typeof v === 'object' && v !== null && '$exists' in v) {
              if (v.$exists && !(k in d)) return false;
              if (!v.$exists && k in d) return false;
            } else if (d[k] !== v) {
              return false;
            }
          }
          return true;
        }) || null,
      );
    },
    insertOne(doc) {
      if (doc.booking_id && doc.type) {
        const dup = docs.find(
          (d) => String(d.booking_id) === String(doc.booking_id) && d.type === doc.type,
        );
        if (dup) {
          const err = new Error('duplicate key');
          err.code = 11000;
          return Promise.reject(err);
        }
      }
      docs.push({ ...doc });
      return Promise.resolve({ insertedId: doc._id || new ObjectId() });
    },
    updateOne(filter, update) {
      const d = docs.find((x) => String(x._id) === String(filter._id));
      if (d && update.$set) Object.assign(d, update.$set);
      return Promise.resolve({ matchedCount: d ? 1 : 0 });
    },
  };
}

test('integration: ghi nhận loyalty khi checkout — earn flow chuẩn schema loyalty_transactions', async () => {
  const userId = new ObjectId();
  const bookingId = new ObjectId();
  const basicTierId = new ObjectId();
  const silverTierId = new ObjectId();

  const user = {
    _id: userId,
    tier_id: basicTierId,
    tier_points: 900,
    coin_balance: 50,
    role: 'CUSTOMER',
  };

  const booking = {
    _id: bookingId,
    user_id: userId,
    status: 'CHECKED_OUT',
    final_amount: 2000000,
  };

  const tiers = [
    { _id: basicTierId, code: 'BASIC', minPoints: 0 },
    { _id: silverTierId, code: 'SILVER', minPoints: 1000 },
  ];

  const loyaltyTxs = createMockCollection();
  const existingEarn = await loyaltyTxs.findOne({ booking_id: bookingId, type: 'EARN' });
  assert.equal(existingEarn, null);

  const currentTier = tiers.find((t) => String(t._id) === String(user.tier_id));
  const account = { tier: currentTier.code, tierPoints: user.tier_points, coins: user.coin_balance };
  const result = L.applyEarn(account, booking.final_amount);

  assert.equal(result.earned.points, 200);
  assert.equal(result.earned.coins, 200);
  assert.equal(result.tierPoints, 1100);
  assert.equal(result.tier, 'SILVER');
  assert.equal(result.coins, 250);

  await loyaltyTxs.insertOne({
    _id: new ObjectId(),
    user_id: userId,
    booking_id: bookingId,
    type: 'EARN',
    points_delta: result.earned.points,
    coins_delta: result.earned.coins,
    points_after: result.tierPoints,
    coins_after: result.coins,
    created_at: new Date(),
  });

  assert.equal(loyaltyTxs._docs.length, 1);
  assert.equal(loyaltyTxs._docs[0].type, 'EARN');
  assert.equal(loyaltyTxs._docs[0].points_delta, 200);
  assert.equal(loyaltyTxs._docs[0].points_after, 1100);
});

test('integration: không cộng điểm hai lần cho một đơn (idempotent)', async () => {
  const bookingId = new ObjectId();
  const loyaltyTxs = createMockCollection();

  await loyaltyTxs.insertOne({
    _id: new ObjectId(),
    user_id: new ObjectId(),
    booking_id: bookingId,
    type: 'EARN',
    points_delta: 100,
    coins_delta: 100,
    points_after: 100,
    coins_after: 100,
    created_at: new Date(),
  });

  const existing = await loyaltyTxs.findOne({ booking_id: bookingId, type: 'EARN' });
  assert.notEqual(existing, null);

  await assert.rejects(
    () =>
      loyaltyTxs.insertOne({
        _id: new ObjectId(),
        user_id: new ObjectId(),
        booking_id: bookingId,
        type: 'EARN',
        points_delta: 100,
        coins_delta: 100,
        points_after: 100,
        coins_after: 100,
        created_at: new Date(),
      }),
    (err) => err.code === 11000,
  );
});

test('integration: đổi Coins không làm tụt hạng', () => {
  const account = { tier: 'GOLD', tierPoints: 5500, coins: 300 };
  const redeemResult = L.redeemCoins(account, 200);
  assert.equal(redeemResult.ok, true);
  assert.equal(redeemResult.coins, 100);
  assert.equal(account.tierPoints, 5500);
  assert.equal(account.tier, 'GOLD');
});

test('integration: year rollover ghi đúng loyalty_transactions (YEAR_RESET)', async () => {
  const userId = new ObjectId();
  const loyaltyTxs = createMockCollection();

  const account = { tier: 'DIAMOND', tierPoints: 15000, coins: 500 };
  const result = L.yearRollover(account);

  assert.equal(result.tier, 'GOLD');
  assert.equal(result.tierPoints, 5000);
  assert.equal(result.coins, 0);
  assert.equal(result.coinsExpired, 500);

  await loyaltyTxs.insertOne({
    _id: new ObjectId(),
    user_id: userId,
    type: 'YEAR_RESET',
    year: 2027,
    points_delta: result.tierPoints - account.tierPoints,
    coins_delta: -result.coinsExpired,
    points_after: result.tierPoints,
    coins_after: result.coins,
    note: 'Reset hạng & Coins đầu năm 2027',
    created_at: new Date(),
  });

  assert.equal(loyaltyTxs._docs.length, 1);
  assert.equal(loyaltyTxs._docs[0].type, 'YEAR_RESET');
  assert.equal(loyaltyTxs._docs[0].coins_delta, -500);
  assert.equal(loyaltyTxs._docs[0].points_after, 5000);
});

test('integration: rollover 2 năm liên tiếp DIAMOND → GOLD → SILVER', () => {
  const r1 = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 100 });
  assert.equal(r1.tier, 'GOLD');
  assert.equal(r1.tierPoints, 5000);

  const r2 = L.yearRollover({ tier: r1.tier, tierPoints: r1.tierPoints, coins: 0 });
  assert.equal(r2.tier, 'SILVER');
  assert.equal(r2.tierPoints, 1000);
});

test('integration: earn sau rollover — lên lại hạng', () => {
  const rolled = L.yearRollover({ tier: 'GOLD', tierPoints: 8000, coins: 30 });
  assert.equal(rolled.tier, 'SILVER');
  assert.equal(rolled.tierPoints, 1000);

  const afterEarn = L.applyEarn(
    { tier: rolled.tier, tierPoints: rolled.tierPoints, coins: rolled.coins },
    40000000,
  );
  assert.equal(afterEarn.tier, 'GOLD');
  assert.equal(afterEarn.tierPoints, 5000);
});

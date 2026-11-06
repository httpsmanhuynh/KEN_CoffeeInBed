'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const L = require('../../src/domain/loyalty');

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

test('TC-LOY-INT-01\tAUTO-LOY-INT-01: integration: ghi nhận loyalty khi checkout — earn flow chuẩn schema loyalty_transactions', async () => {
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

test('TC-LOY-INT-02\tAUTO-LOY-INT-02: integration: không cộng điểm hai lần cho một đơn (idempotent)', async () => {
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

test('TC-LOY-INT-03\tAUTO-LOY-INT-03: integration: đổi Coins không làm tụt hạng', () => {
  const account = { tier: 'GOLD', tierPoints: 5500, coins: 300 };
  const redeemResult = L.redeemCoins(account, 200);
  assert.equal(redeemResult.ok, true);
  assert.equal(redeemResult.coins, 100);
  assert.equal(account.tierPoints, 5500);
  assert.equal(account.tier, 'GOLD');
});

test('TC-LOY-INT-04\tAUTO-LOY-INT-04: integration: year rollover ghi đúng loyalty_transactions (YEAR_RESET)', async () => {
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

test('TC-LOY-INT-05\tAUTO-LOY-INT-05: integration: rollover 2 năm liên tiếp DIAMOND → GOLD → SILVER', () => {
  const r1 = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 100 });
  assert.equal(r1.tier, 'GOLD');
  assert.equal(r1.tierPoints, 5000);

  const r2 = L.yearRollover({ tier: r1.tier, tierPoints: r1.tierPoints, coins: 0 });
  assert.equal(r2.tier, 'SILVER');
  assert.equal(r2.tierPoints, 1000);
});

test('TC-LOY-INT-06\tAUTO-LOY-INT-06: integration: earn sau rollover — lên lại hạng', () => {
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

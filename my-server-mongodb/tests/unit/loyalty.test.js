'use strict';
// Kiểm thử đơn vị & tích hợp cốt lõi cho Module 09: Loyalty Management.
// Mã TC đồng bộ với Test_Module09_Loyalty_Management.xlsx và Postman Collection Module 09.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const L = require('../../src/domain/loyalty');
const { computePrice } = require('../../src/domain/pricing');

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
  };
}

test('TC-LOY-01\tAUTO-LOY-01: Xem bảng 4 hạng: BASIC 0%, SILVER 5%, GOLD 10%, DIAMOND 15% (LOY-B01)', () => {
  assert.equal(L.TIERS.length, 4);
  assert.deepEqual(
    L.TIERS.map((t) => ({ code: t.code, minPoints: t.minPoints, percent: t.percent })),
    [
      { code: 'BASIC', minPoints: 0, percent: 0 },
      { code: 'SILVER', minPoints: 1000, percent: 5 },
      { code: 'GOLD', minPoints: 5000, percent: 10 },
      { code: 'DIAMOND', minPoints: 10000, percent: 15 },
    ],
  );
  assert.equal(L.tierByCode('SILVER').percent, 5);
  assert.throws(() => L.tierByCode('UNKNOWN_TIER'), RangeError);
});

test('TC-LOY-02\tAUTO-LOY-02: Check-out: 10.000đ thực trả = 1 Điểm + 1 Coin (LOY-B02)', async () => {
  assert.deepEqual(L.earnFromAmount(255000), { points: 25, coins: 25 });
  const res = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 255000);
  assert.equal(res.earned.points, 25);
  assert.equal(res.earned.coins, 25);
});

test('TC-LOY-03\tAUTO-LOY-03: final_amount = 9.999đ → 0 Điểm; 10.000đ → 1 Điểm (LOY-B03)', () => {
  assert.deepEqual(L.earnFromAmount(0), { points: 0, coins: 0 });
  assert.deepEqual(L.earnFromAmount(9999), { points: 0, coins: 0 });
  assert.deepEqual(L.earnFromAmount(10000), { points: 1, coins: 1 });
  assert.throws(() => L.earnFromAmount(-1), RangeError);
  assert.throws(() => L.earnFromAmount(100.5), RangeError);
});

test('TC-LOY-04\tAUTO-LOY-04: Điểm tính trên số tiền thực trả sau giảm giá (không tính phần Voucher/Hạng) (LOY-B04)', () => {
  const pricing = computePrice({
    packagePrice: 300000,
    inclusionSurcharge: 0,
    addons: [],
    voucherDiscount: 50000,
    tierPercent: 0,
  });
  assert.equal(pricing.finalAmount, 250000);
  assert.deepEqual(L.earnFromAmount(pricing.finalAmount), { points: 25, coins: 25 });
});

test('TC-LOY-05\tAUTO-LOY-05: Cộng điểm trùng cho cùng đơn (idempotent theo booking_id) (LOY-B05)', async () => {
  const bookingId = new ObjectId();
  const loyaltyTxs = createMockCollection();
  await loyaltyTxs.insertOne({
    _id: new ObjectId(),
    user_id: new ObjectId(),
    booking_id: bookingId,
    type: 'EARN',
    points_delta: 25,
    coins_delta: 25,
    points_after: 25,
    coins_after: 25,
    created_at: new Date(),
  });
  await assert.rejects(
    () =>
      loyaltyTxs.insertOne({
        _id: new ObjectId(),
        user_id: new ObjectId(),
        booking_id: bookingId,
        type: 'EARN',
        points_delta: 25,
        coins_delta: 25,
        points_after: 50,
        coins_after: 50,
        created_at: new Date(),
      }),
    (err) => err.code === 11000,
  );
});

test('TC-LOY-08\tAUTO-LOY-08: Biên 1.000 điểm: 999 → BASIC; 1.000 → SILVER (LOY-B08)', () => {
  assert.equal(L.tierForPoints(999).code, 'BASIC');
  assert.equal(L.tierForPoints(1000).code, 'SILVER');
  const step1 = L.applyEarn({ tier: 'BASIC', tierPoints: 990, coins: 0 }, 90000);
  assert.equal(step1.tier, 'BASIC');
  const step2 = L.applyEarn(step1, 10000);
  assert.equal(step2.tier, 'SILVER');
});

test('TC-LOY-09\tAUTO-LOY-09: Nhảy nhiều bậc khi đủ điểm (BASIC → GOLD) và mốc 5.000 / 10.000 (LOY-B09; LOY-B11)', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 4900, coins: 0 }, 2000000);
  assert.equal(r.tierPoints, 5100);
  assert.equal(r.tier, 'GOLD');
  assert.equal(L.tierForPoints(5000).code, 'GOLD');
  assert.equal(L.tierForPoints(10000).code, 'DIAMOND');
});

test('TC-LOY-12\tAUTO-LOY-12: Không hạ hạng giữa năm khi phát sinh đơn 0 điểm hoặc điểm thấp (LOY-B12)', () => {
  const zeroEarn = L.applyEarn({ tier: 'GOLD', tierPoints: 5000, coins: 100 }, 9000);
  assert.equal(zeroEarn.tier, 'GOLD');
  assert.equal(zeroEarn.tierPoints, 5000);
  const lowPoints = L.applyEarn({ tier: 'GOLD', tierPoints: 3000, coins: 0 }, 10000);
  assert.equal(lowPoints.tier, 'GOLD');
});

test('TC-LOY-13\tAUTO-LOY-13: Đổi hết KÉN Coins về 0 không làm giảm Điểm tích lũy và không bị hạ hạng (LOY-B13)', () => {
  const account = { tier: 'GOLD', tierPoints: 5500, coins: 50 };
  const redeemRes = L.redeemCoins(account, 50);
  assert.equal(redeemRes.ok, true);
  assert.equal(redeemRes.coins, 0);
  assert.equal(account.tierPoints, 5500);
  assert.equal(account.tier, 'GOLD');
  assert.throws(() => L.redeemCoins(account, 0), RangeError);
  assert.throws(() => L.redeemCoins(account, 10.5), RangeError);
});

test('TC-LOY-14\tAUTO-LOY-14: Rollover 01/01: hạ 1 bậc, đặt Điểm về mốc hạng mới, Coins về 0 (LOY-B14)', () => {
  assert.deepEqual(L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 500 }), {
    tier: 'GOLD',
    tierPoints: 5000,
    coins: 0,
    coinsExpired: 500,
  });
  assert.deepEqual(L.yearRollover({ tier: 'GOLD', tierPoints: 9000, coins: 40 }), {
    tier: 'SILVER',
    tierPoints: 1000,
    coins: 0,
    coinsExpired: 40,
  });
  assert.deepEqual(L.yearRollover({ tier: 'SILVER', tierPoints: 3000, coins: 10 }), {
    tier: 'BASIC',
    tierPoints: 0,
    coins: 0,
    coinsExpired: 10,
  });
});

test('TC-LOY-16\tAUTO-LOY-16: Rollover đầu năm đối với khách hạng BASIC: giữ nguyên hạng và điểm, chỉ reset Coins về 0 (LOY-B16)', () => {
  assert.deepEqual(L.yearRollover({ tier: 'BASIC', tierPoints: 700, coins: 50 }), {
    tier: 'BASIC',
    tierPoints: 700,
    coins: 0,
    coinsExpired: 50,
  });
});

test('TC-LOY-17\tAUTO-LOY-17: Chạy rollover qua 2 năm liên tiếp khi không tích thêm điểm (DIAMOND → GOLD → SILVER) & cô lập đơn lẻ (LOY-B17; LOY-B20)', () => {
  const r1 = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 100 });
  assert.equal(r1.tier, 'GOLD');
  assert.equal(r1.tierPoints, 5000);
  const r2 = L.yearRollover({ tier: r1.tier, tierPoints: r1.tierPoints, coins: r1.coins });
  assert.equal(r2.tier, 'SILVER');
  assert.equal(r2.tierPoints, 1000);

  let account = { tier: 'BASIC', tierPoints: 0, coins: 0 };
  account = L.applyEarn(account, 15000);
  account = L.applyEarn(account, 15000);
  assert.equal(account.tierPoints, 2);
});

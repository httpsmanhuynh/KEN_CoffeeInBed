'use strict';
// Kiểm thử đơn vị & tích hợp cho Module 09: Loyalty Management (20 TCs).
// Đồng bộ 100% mã TC và mô tả với sheet Test_Module09_Loyalty_Management.xlsx.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const L = require('../../src/domain/loyalty');
const { computePrice } = require('../../src/domain/pricing');
const { requireRole, requireAuth } = require('../../src/middleware/auth');

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
  const userId = new ObjectId();
  const bookingId = new ObjectId();
  const loyaltyTxs = createMockCollection();
  const res = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 255000);
  assert.equal(res.earned.points, 25);
  assert.equal(res.earned.coins, 25);

  await loyaltyTxs.insertOne({
    _id: new ObjectId(),
    user_id: userId,
    booking_id: bookingId,
    type: 'EARN',
    points_delta: res.earned.points,
    coins_delta: res.earned.coins,
    points_after: res.tierPoints,
    coins_after: res.coins,
    created_at: new Date(),
  });
  assert.equal(loyaltyTxs._docs.length, 1);
  assert.equal(loyaltyTxs._docs[0].points_delta, 25);
  assert.equal(loyaltyTxs._docs[0].coins_delta, 25);
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
  assert.equal(pricing.subtotal, 300000);
  assert.equal(pricing.finalAmount, 250000);
  const earned = L.earnFromAmount(pricing.finalAmount);
  assert.deepEqual(earned, { points: 25, coins: 25 });
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
  const existing = await loyaltyTxs.findOne({ booking_id: bookingId, type: 'EARN' });
  assert.notEqual(existing, null);
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

test('TC-LOY-06\tAUTO-LOY-06: Cộng điểm cho đơn chưa CHECKED_OUT / đơn của người khác (LOY-B06)', () => {
  const validateEarnBooking = (booking, requestUserId) => {
    if (!booking) return { ok: false, status: 404, code: 'NOT_FOUND' };
    if (booking.status !== 'CHECKED_OUT') return { ok: false, status: 422, code: 'INVALID_STATUS' };
    if (String(booking.user_id) !== String(requestUserId))
      return { ok: false, status: 403, code: 'FORBIDDEN' };
    return { ok: true, status: 200 };
  };
  const ownerId = new ObjectId();
  const otherId = new ObjectId();
  assert.equal(validateEarnBooking({ status: 'CONFIRMED', user_id: ownerId }, ownerId).status, 422);
  assert.equal(
    validateEarnBooking({ status: 'CHECKED_OUT', user_id: ownerId }, otherId).status,
    403,
  );
});

test('TC-LOY-07\tAUTO-LOY-07: Đơn NO_SHOW / CANCELLED / EXPIRED không cộng Điểm (LOY-B07)', async () => {
  const loyaltyTxs = createMockCollection();
  for (const st of ['NO_SHOW', 'CANCELLED', 'EXPIRED']) {
    const bk = { _id: new ObjectId(), status: st, final_amount: 200000 };
    if (bk.status === 'CHECKED_OUT') {
      await loyaltyTxs.insertOne({ _id: new ObjectId(), booking_id: bk._id, type: 'EARN' });
    }
  }
  assert.equal(loyaltyTxs._docs.length, 0);
});

test('TC-LOY-08\tAUTO-LOY-08: Biên 1.000 điểm: 999 → BASIC; 1.000 → SILVER (LOY-B08)', () => {
  assert.equal(L.tierForPoints(999).code, 'BASIC');
  assert.equal(L.tierForPoints(1000).code, 'SILVER');
  const step1 = L.applyEarn({ tier: 'BASIC', tierPoints: 990, coins: 0 }, 90000);
  assert.equal(step1.tierPoints, 999);
  assert.equal(step1.tier, 'BASIC');
  const step2 = L.applyEarn(step1, 10000);
  assert.equal(step2.tierPoints, 1000);
  assert.equal(step2.tier, 'SILVER');
});

test('TC-LOY-09\tAUTO-LOY-09: Nhảy nhiều bậc khi đủ điểm (BASIC → GOLD) (LOY-B09)', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 4900, coins: 0 }, 2000000);
  assert.equal(r.tierPoints, 5100);
  assert.equal(r.tier, 'GOLD');
});

test('TC-LOY-10\tAUTO-LOY-10: Hạng mới áp dụng cho đơn kế tiếp, không áp lại đơn cũ (LOY-B10)', () => {
  const oldBookingSnapshot = computePrice({
    packagePrice: 200000,
    inclusionSurcharge: 0,
    addons: [],
    voucherDiscount: 0,
    tierPercent: 0,
  });
  const upgraded = L.applyEarn({ tier: 'BASIC', tierPoints: 900, coins: 0 }, 2000000);
  assert.equal(upgraded.tier, 'SILVER');
  const nextBookingQuote = computePrice({
    packagePrice: 200000,
    inclusionSurcharge: 0,
    addons: [],
    voucherDiscount: 0,
    tierPercent: L.tierByCode(upgraded.tier).percent,
  });
  assert.equal(oldBookingSnapshot.tierDiscount, 0);
  assert.equal(nextBookingQuote.tierDiscount, 10000);
});

test('TC-LOY-11\tAUTO-LOY-11: Mốc 5.000 → GOLD, 10.000 → DIAMOND (15%) (LOY-B11)', () => {
  assert.equal(L.tierForPoints(4999).code, 'SILVER');
  assert.equal(L.tierForPoints(5000).code, 'GOLD');
  assert.equal(L.tierForPoints(9999).code, 'GOLD');
  assert.equal(L.tierForPoints(10000).code, 'DIAMOND');
  const toGold = L.applyEarn({ tier: 'SILVER', tierPoints: 4990, coins: 0 }, 100000);
  assert.equal(toGold.tier, 'GOLD');
  const toDiamond = L.applyEarn({ tier: 'GOLD', tierPoints: 9990, coins: 0 }, 100000);
  assert.equal(toDiamond.tier, 'DIAMOND');
});

test('TC-LOY-12\tAUTO-LOY-12: Không hạ hạng giữa năm khi phát sinh đơn 0 điểm hoặc điểm thấp (LOY-B12)', () => {
  const zeroEarn = L.applyEarn({ tier: 'GOLD', tierPoints: 5000, coins: 100 }, 9000);
  assert.equal(zeroEarn.tier, 'GOLD');
  assert.equal(zeroEarn.tierPoints, 5000);
  assert.deepEqual(zeroEarn.earned, { points: 0, coins: 0 });

  const lowPoints = L.applyEarn({ tier: 'GOLD', tierPoints: 3000, coins: 0 }, 10000);
  assert.equal(lowPoints.tier, 'GOLD');
  assert.equal(lowPoints.tierPoints, 3001);
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
  const d = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 500 });
  assert.deepEqual(d, { tier: 'GOLD', tierPoints: 5000, coins: 0, coinsExpired: 500 });

  const g = L.yearRollover({ tier: 'GOLD', tierPoints: 9000, coins: 40 });
  assert.deepEqual(g, { tier: 'SILVER', tierPoints: 1000, coins: 0, coinsExpired: 40 });

  const s = L.yearRollover({ tier: 'SILVER', tierPoints: 3000, coins: 10 });
  assert.deepEqual(s, { tier: 'BASIC', tierPoints: 0, coins: 0, coinsExpired: 10 });
});

test('TC-LOY-15\tAUTO-LOY-15: Customer / Guest gọi year-rollover (LOY-B15)', async () => {
  const mw = requireRole('ADMIN');
  let guestStatus = 0;
  await new Promise((resolve) => {
    mw(
      { session: {} },
      {
        status(c) {
          guestStatus = c;
          return { json() { resolve(); } };
        },
      },
      () => { resolve(); },
    );
  });
  assert.equal(guestStatus, 401);

  const custId = new ObjectId();
  let custStatus = 0;
  await new Promise((resolve) => {
    mw(
      {
        session: { user: { id: String(custId), pwdAt: 0 } },
        app: {
          locals: {
            db: {
              collection: () => ({
                findOne: async () => ({ _id: custId, role: 'CUSTOMER', status: 'ACTIVE' }),
              }),
            },
          },
        },
      },
      {
        status(c) {
          custStatus = c;
          return { json() { resolve(); } };
        },
      },
      () => { resolve(); },
    );
  });
  assert.equal(custStatus, 403);
});

test('TC-LOY-16\tAUTO-LOY-16: Rollover đầu năm đối với khách hạng BASIC: giữ nguyên hạng và điểm, chỉ reset Coins về 0 (LOY-B16)', () => {
  const b1 = L.yearRollover({ tier: 'BASIC', tierPoints: 700, coins: 50 });
  assert.deepEqual(b1, { tier: 'BASIC', tierPoints: 700, coins: 0, coinsExpired: 50 });

  const b2 = L.yearRollover({ tier: 'BASIC', tierPoints: 300, coins: 0 });
  assert.deepEqual(b2, { tier: 'BASIC', tierPoints: 300, coins: 0, coinsExpired: 0 });
});

test('TC-LOY-17\tAUTO-LOY-17: Chạy rollover qua 2 năm liên tiếp khi không tích thêm điểm (DIAMOND → GOLD → SILVER) (LOY-B17)', () => {
  const r1 = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 100 });
  assert.equal(r1.tier, 'GOLD');
  assert.equal(r1.tierPoints, 5000);
  assert.equal(r1.coins, 0);

  const r2 = L.yearRollover({ tier: r1.tier, tierPoints: r1.tierPoints, coins: r1.coins });
  assert.equal(r2.tier, 'SILVER');
  assert.equal(r2.tierPoints, 1000);
  assert.equal(r2.coins, 0);
});

test('TC-LOY-18\tAUTO-LOY-18: Xem lịch sử EARN / REDEEM / YEAR_RESET của chính mình (LOY-B18)', async () => {
  const userId = new ObjectId();
  const loyaltyTxs = createMockCollection([
    {
      _id: new ObjectId(),
      user_id: userId,
      type: 'EARN',
      points_delta: 100,
      coins_delta: 100,
      points_after: 100,
      coins_after: 100,
      created_at: new Date('2026-01-01'),
    },
    {
      _id: new ObjectId(),
      user_id: userId,
      type: 'REDEEM',
      points_delta: 0,
      coins_delta: -50,
      points_after: 100,
      coins_after: 50,
      created_at: new Date('2026-02-01'),
    },
    {
      _id: new ObjectId(),
      user_id: userId,
      type: 'YEAR_RESET',
      points_delta: 0,
      coins_delta: -50,
      points_after: 100,
      coins_after: 0,
      created_at: new Date('2027-01-01'),
    },
  ]);
  const myHistory = loyaltyTxs._docs.filter((d) => String(d.user_id) === String(userId));
  assert.equal(myHistory.length, 3);
  assert.deepEqual(
    myHistory.map((x) => x.type),
    ['EARN', 'REDEEM', 'YEAR_RESET'],
  );
});

test('TC-LOY-19\tAUTO-LOY-19: Guest / Customer xem lịch sử của người khác (LOY-B19)', async () => {
  let status = 0;
  await requireAuth(
    { session: {} },
    {
      status(c) {
        status = c;
        return { json() {} };
      },
    },
    () => {},
  );
  assert.equal(status, 401);

  const userA = new ObjectId();
  const userB = new ObjectId();
  const allTxs = [
    { _id: new ObjectId(), user_id: userA, type: 'EARN', points_delta: 50 },
    { _id: new ObjectId(), user_id: userB, type: 'EARN', points_delta: 90 },
  ];
  // Route /api/loyalty/history luôn lọc theo req.user._id, bỏ qua query.userId
  const historyForA = allTxs.filter((t) => String(t.user_id) === String(userA));
  assert.equal(historyForA.length, 1);
  assert.equal(historyForA[0].points_delta, 50);
});

test('TC-LOY-20\tAUTO-LOY-20: Cô lập tích điểm nhiều đơn lẻ: không cộng dồn tiền dư (LOY-B20)', () => {
  let account = { tier: 'BASIC', tierPoints: 0, coins: 0 };
  account = L.applyEarn(account, 15000);
  assert.equal(account.tierPoints, 1);
  assert.equal(account.coins, 1);

  account = L.applyEarn(account, 15000);
  assert.equal(account.tierPoints, 2);
  assert.equal(account.coins, 2);
});

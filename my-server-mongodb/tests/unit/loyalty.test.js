'use strict';
// Test hệ thống Loyalty: domain logic + route integration (mock DB in-memory).
// Chạy: node --test test/loyalty.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const L = require('../../src/domain/loyalty');

// ═══════════════════════════════════════════════════
// 1. Domain-level tests (pure functions, no DB)
// ═══════════════════════════════════════════════════

test('TC-LOY-01\tAUTO-LOY-01: earnFromAmount: 10.000đ = 1 Điểm + 1 Coin (BR-H03)', () => {
  assert.deepEqual(L.earnFromAmount(10000), { points: 1, coins: 1 });
  assert.deepEqual(L.earnFromAmount(55000), { points: 5, coins: 5 });
  assert.deepEqual(L.earnFromAmount(100000), { points: 10, coins: 10 });
});

test('TC-LOY-02\tAUTO-LOY-02: earnFromAmount: dưới 10.000đ không cộng gì', () => {
  assert.deepEqual(L.earnFromAmount(0), { points: 0, coins: 0 });
  assert.deepEqual(L.earnFromAmount(9999), { points: 0, coins: 0 });
});

test('TC-LOY-03\tAUTO-LOY-03: earnFromAmount: số lẻ làm tròn xuống', () => {
  assert.deepEqual(L.earnFromAmount(15000), { points: 1, coins: 1 });
  assert.deepEqual(L.earnFromAmount(99999), { points: 9, coins: 9 });
});

test('TC-LOY-04\tAUTO-LOY-04: earnFromAmount: reject số âm và số thập phân', () => {
  assert.throws(() => L.earnFromAmount(-1), RangeError);
  assert.throws(() => L.earnFromAmount(100.5), RangeError);
});

test('TC-LOY-05\tAUTO-LOY-05: applyEarn: BASIC → SILVER khi đạt 1.000 điểm (BR-H04)', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 10000000);
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.tierPoints, 1000);
  assert.equal(r.coins, 1000);
});

test('TC-LOY-06\tAUTO-LOY-06: applyEarn: BASIC → GOLD nhảy nhiều hạng khi đạt 5.000 điểm', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 50000000);
  assert.equal(r.tier, 'GOLD');
  assert.equal(r.tierPoints, 5000);
  assert.equal(r.coins, 5000);
});

test('TC-LOY-07\tAUTO-LOY-07: applyEarn: BASIC → DIAMOND nhảy hết khi đạt 10.000 điểm', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 100000000);
  assert.equal(r.tier, 'DIAMOND');
  assert.equal(r.tierPoints, 10000);
  assert.equal(r.coins, 10000);
});

test('TC-LOY-08\tAUTO-LOY-08: applyEarn: tích lũy dần, BASIC 900 + 200 → SILVER', () => {
  const r = L.applyEarn({ tier: 'BASIC', tierPoints: 900, coins: 50 }, 2000000);
  assert.equal(r.tierPoints, 1100);
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.coins, 250);
});

test('TC-LOY-09\tAUTO-LOY-09: applyEarn: không hạ hạng giữa năm dù điểm thấp', () => {
  const r = L.applyEarn({ tier: 'GOLD', tierPoints: 5000, coins: 100 }, 10000);
  assert.equal(r.tier, 'GOLD');
  assert.equal(r.tierPoints, 5001);
});

test('TC-LOY-10\tAUTO-LOY-10: applyEarn: GOLD không xuống SILVER khi chỉ có 1 điểm mới', () => {
  const r = L.applyEarn({ tier: 'GOLD', tierPoints: 3000, coins: 0 }, 10000);
  assert.equal(r.tier, 'GOLD');
});

test('TC-LOY-11\tAUTO-LOY-11: applyEarn: DIAMOND giữ DIAMOND khi thêm điểm', () => {
  const r = L.applyEarn({ tier: 'DIAMOND', tierPoints: 12000, coins: 500 }, 10000000);
  assert.equal(r.tier, 'DIAMOND');
  assert.equal(r.tierPoints, 13000);
  assert.equal(r.coins, 1500);
});

test('TC-LOY-12\tAUTO-LOY-12: applyEarn: 0đ → 0 điểm, giữ nguyên', () => {
  const r = L.applyEarn({ tier: 'SILVER', tierPoints: 2000, coins: 100 }, 0);
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.tierPoints, 2000);
  assert.equal(r.coins, 100);
  assert.deepEqual(r.earned, { points: 0, coins: 0 });
});

test('TC-LOY-13\tAUTO-LOY-13: yearRollover: DIAMOND → GOLD, Coins về 0 (BR-H04, H05)', () => {
  const r = L.yearRollover({ tier: 'DIAMOND', tierPoints: 15000, coins: 500 });
  assert.equal(r.tier, 'GOLD');
  assert.equal(r.tierPoints, 5000);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 500);
});

test('TC-LOY-14\tAUTO-LOY-14: yearRollover: GOLD → SILVER', () => {
  const r = L.yearRollover({ tier: 'GOLD', tierPoints: 9000, coins: 40 });
  assert.equal(r.tier, 'SILVER');
  assert.equal(r.tierPoints, 1000);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 40);
});

test('TC-LOY-15\tAUTO-LOY-15: yearRollover: SILVER → BASIC', () => {
  const r = L.yearRollover({ tier: 'SILVER', tierPoints: 3000, coins: 10 });
  assert.equal(r.tier, 'BASIC');
  assert.equal(r.tierPoints, 0);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 10);
});

test('TC-LOY-16\tAUTO-LOY-16: yearRollover: BASIC giữ nguyên điểm, Coins về 0', () => {
  const r = L.yearRollover({ tier: 'BASIC', tierPoints: 700, coins: 7 });
  assert.equal(r.tier, 'BASIC');
  assert.equal(r.tierPoints, 700);
  assert.equal(r.coins, 0);
  assert.equal(r.coinsExpired, 7);
});

test('TC-LOY-17\tAUTO-LOY-17: yearRollover: BASIC không Coins → coinsExpired = 0', () => {
  const r = L.yearRollover({ tier: 'BASIC', tierPoints: 300, coins: 0 });
  assert.equal(r.coinsExpired, 0);
});

test('TC-LOY-18\tAUTO-LOY-18: redeemCoins: trừ đúng số Coins (BR-H06)', () => {
  const r = L.redeemCoins({ coins: 100 }, 30);
  assert.equal(r.ok, true);
  assert.equal(r.coins, 70);
});

test('TC-LOY-19\tAUTO-LOY-19: redeemCoins: trừ toàn bộ Coins', () => {
  const r = L.redeemCoins({ coins: 50 }, 50);
  assert.equal(r.ok, true);
  assert.equal(r.coins, 0);
});

test('TC-LOY-20\tAUTO-LOY-20: redeemCoins: không đủ Coins', () => {
  const r = L.redeemCoins({ coins: 10 }, 30);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'INSUFFICIENT_COINS');
});

test('TC-LOY-21\tAUTO-LOY-21: redeemCoins: reject cost <= 0', () => {
  assert.throws(() => L.redeemCoins({ coins: 100 }, 0), RangeError);
  assert.throws(() => L.redeemCoins({ coins: 100 }, -5), RangeError);
});

test('TC-LOY-22\tAUTO-LOY-22: redeemCoins: reject cost không nguyên', () => {
  assert.throws(() => L.redeemCoins({ coins: 100 }, 10.5), RangeError);
});

test('TC-LOY-23\tAUTO-LOY-23: tierForPoints: đúng 4 mốc 0/1000/5000/10000', () => {
  assert.equal(L.tierForPoints(0).code, 'BASIC');
  assert.equal(L.tierForPoints(999).code, 'BASIC');
  assert.equal(L.tierForPoints(1000).code, 'SILVER');
  assert.equal(L.tierForPoints(4999).code, 'SILVER');
  assert.equal(L.tierForPoints(5000).code, 'GOLD');
  assert.equal(L.tierForPoints(9999).code, 'GOLD');
  assert.equal(L.tierForPoints(10000).code, 'DIAMOND');
  assert.equal(L.tierForPoints(99999).code, 'DIAMOND');
});


test('TC-LOY-24\tAUTO-LOY-24: loyalty domain: nhảy nhiều hạng, không hạ giữa năm (BR-H04)', () => {
  const a = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 6000000);
  assert.equal(a.tier, 'BASIC');
  const b = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 50000000);
  assert.equal(b.tier, 'GOLD');
  assert.equal(b.coins, 5000);
  assert.equal(L.applyEarn({ tier: 'GOLD', tierPoints: 5000, coins: 0 }, 10000).tier, 'GOLD');
});
test('TC-LOY-25\tAUTO-LOY-25: loyalty domain: qua năm hạ 1 bậc, Coins về 0', () => {
  assert.deepEqual(L.yearRollover({ tier: 'GOLD', tierPoints: 9000, coins: 40 }), {
    tier: 'SILVER',
    tierPoints: 1000,
    coins: 0,
    coinsExpired: 40,
  });
  assert.equal(L.yearRollover({ tier: 'SILVER', tierPoints: 3000, coins: 0 }).tierPoints, 0);
  assert.equal(L.yearRollover({ tier: 'BASIC', tierPoints: 700, coins: 7 }).tierPoints, 700);
});
test('TC-LOY-26\tAUTO-LOY-26: loyalty domain: đổi Coins không đụng Điểm', () => {
  assert.deepEqual(L.redeemCoins({ coins: 100 }, 30), { ok: true, coins: 70 });
  assert.equal(L.redeemCoins({ coins: 10 }, 30).ok, false);
});

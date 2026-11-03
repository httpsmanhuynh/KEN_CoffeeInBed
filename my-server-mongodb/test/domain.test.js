'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computePrice } = require('../src/domain/pricing');
const L = require('../src/domain/loyalty');
const { STATUS: S, canTransition } = require('../src/domain/bookingStateMachine');
const { checkAvailability } = require('../src/domain/availability');

const M = 60000,
  H = 60 * M;

test('pricing: voucher trước, hạng sau, làm tròn xuống (BR-B03)', () => {
  const r = computePrice({
    packagePrice: 100000,
    inclusionSurcharge: 5000,
    addons: [{ unitPrice: 20000, qty: 2 }],
    voucherDiscount: 15000,
    tierPercent: 5,
  });
  assert.equal(r.subtotal, 145000);
  assert.equal(r.tierDiscount, Math.floor((130000 * 5) / 100));
  assert.equal(r.finalAmount, 145000 - 15000 - 6500);
});
test('pricing: voucher không vượt tạm tính; tiền phải là số nguyên', () => {
  assert.equal(
    computePrice({ packagePrice: 50000, voucherDiscount: 99999, tierPercent: 15 }).finalAmount,
    0,
  );
  assert.throws(() => computePrice({ packagePrice: 100.5 }), RangeError);
});

test('loyalty: nhảy nhiều hạng, không hạ giữa năm (BR-H04)', () => {
  const a = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 6000000);
  assert.equal(a.tier, 'BASIC');
  const b = L.applyEarn({ tier: 'BASIC', tierPoints: 0, coins: 0 }, 50000000);
  assert.equal(b.tier, 'GOLD');
  assert.equal(b.coins, 5000);
  assert.equal(L.applyEarn({ tier: 'GOLD', tierPoints: 5000, coins: 0 }, 10000).tier, 'GOLD');
});
test('loyalty: qua năm hạ 1 bậc, Coins về 0', () => {
  assert.deepEqual(L.yearRollover({ tier: 'GOLD', tierPoints: 9000, coins: 40 }), {
    tier: 'SILVER',
    tierPoints: 1000,
    coins: 0,
    coinsExpired: 40,
  });
  assert.equal(L.yearRollover({ tier: 'SILVER', tierPoints: 3000, coins: 0 }).tierPoints, 0);
  assert.equal(L.yearRollover({ tier: 'BASIC', tierPoints: 700, coins: 7 }).tierPoints, 700);
});
test('loyalty: đổi Coins không đụng Điểm', () => {
  assert.deepEqual(L.redeemCoins({ coins: 100 }, 30), { ok: true, coins: 70 });
  assert.equal(L.redeemCoins({ coins: 10 }, 30).ok, false);
});

test('state machine: chặn chuyển sai, sai actor, quá hạn', () => {
  const now = 1_000_000_000_000;
  const p = { status: S.PENDING_PAYMENT, paymentExpiresAt: now + 15 * M, startAt: now + 5 * H };
  assert.equal(canTransition(p, S.CONFIRMED, 'PAYMENT', now).ok, true);
  assert.equal(canTransition(p, S.CONFIRMED, 'PAYMENT', now + 16 * M).reason, 'HOLD_EXPIRED');
  assert.equal(canTransition(p, S.CHECKED_IN, 'ADMIN', now).reason, 'INVALID_TRANSITION');
  assert.equal(canTransition(p, S.EXPIRED, 'CUSTOMER', now + 16 * M).reason, 'FORBIDDEN_ACTOR');
  const c = { status: S.CONFIRMED, startAt: now + H };
  assert.equal(canTransition(c, S.CANCELLED, 'CUSTOMER', now).reason, 'PAST_CUTOFF');
  assert.equal(
    canTransition({ ...c, startAt: now + 3 * H }, S.CANCELLED, 'CUSTOMER', now).ok,
    true,
  );
  assert.equal(canTransition(c, S.CHECKED_IN, 'ADMIN', now + 50 * M).ok, true);
  assert.equal(canTransition(c, S.CHECKED_IN, 'ADMIN', now + 40 * M).reason, 'TOO_EARLY');
  assert.equal(
    canTransition({ ...c, startAt: now + 2 * H }, S.CHECKED_IN, 'ADMIN', now).reason,
    'TOO_EARLY',
  );
  assert.equal(canTransition(c, S.NO_SHOW, 'ADMIN', now + 91 * M).ok, true);
  assert.equal(
    canTransition({ status: S.CHECKED_OUT }, S.CANCELLED, 'CUSTOMER', now).reason,
    'INVALID_TRANSITION',
  );
});

test('availability: EXCLUSIVE chống trùng + buffer; SHARED theo capacity', () => {
  const now = 1_700_000_000_000,
    open = now,
    close = now + 12 * H;
  const base = { now, openAt: open, closeAt: close, guests: 2 };
  const ex = { status: 'ACTIVE', minGuests: 1, maxGuests: 6, capacity: 6, bufferMinutes: 15 };
  const existing = [{ start: now + 2 * H, end: now + 4 * H, guests: 2 }];
  assert.equal(
    checkAvailability({
      ...base,
      mode: 'EXCLUSIVE',
      space: ex,
      existing,
      start: now + 4 * H + 10 * M,
      end: now + 6 * H,
    }).reason,
    'OVERLAP',
  );
  assert.equal(
    checkAvailability({
      ...base,
      mode: 'EXCLUSIVE',
      space: ex,
      existing,
      start: now + 4 * H + 15 * M,
      end: now + 6 * H,
    }).ok,
    true,
  );
  const sh = { status: 'ACTIVE', minGuests: 1, maxGuests: 4, capacity: 5 };
  const ex2 = [{ start: now + H, end: now + 3 * H, guests: 4 }];
  assert.equal(
    checkAvailability({
      ...base,
      mode: 'SHARED',
      space: sh,
      existing: ex2,
      start: now + H,
      end: now + 2 * H,
      guests: 2,
    }).reason,
    'CAPACITY_EXCEEDED',
  );
  assert.equal(
    checkAvailability({
      ...base,
      mode: 'SHARED',
      space: sh,
      existing: ex2,
      start: now + H,
      end: now + 2 * H,
      guests: 1,
    }).ok,
    true,
  );
  assert.equal(
    checkAvailability({
      ...base,
      mode: 'SHARED',
      space: sh,
      existing: [],
      start: now + 10 * M,
      end: now + H,
    }).reason,
    'TOO_SOON',
  );
  assert.equal(
    checkAvailability({
      ...base,
      mode: 'SHARED',
      space: { ...sh, status: 'MAINTENANCE' },
      existing: [],
      start: now + H,
      end: now + 2 * H,
    }).reason,
    'SPACE_UNAVAILABLE',
  );
});

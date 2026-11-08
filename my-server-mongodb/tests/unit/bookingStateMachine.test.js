'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { STATUS: S, canTransition } = require('../../src/domain/bookingStateMachine');

const M = 60000, H = 60 * M;

test('TC-BSM-01\tAUTO-BSM-01: state machine: chặn chuyển sai, sai actor, quá hạn (7 trạng thái)', () => {
  const now = 1_000_000_000_000;
  const p = { status: S.PENDING_PAYMENT, paymentExpiresAt: now + 15 * M, startAt: now + 5 * H };
  assert.equal(canTransition(p, S.CONFIRMED, 'PAYMENT', now).ok, true);
  assert.equal(canTransition(p, S.CONFIRMED, 'PAYMENT', now + 16 * M).reason, 'HOLD_EXPIRED');
  assert.equal(canTransition(p, S.CHECKED_IN, 'ADMIN', now).reason, 'INVALID_TRANSITION');
  assert.equal(canTransition(p, S.EXPIRED, 'CUSTOMER', now + 16 * M).reason, 'FORBIDDEN_ACTOR');
  // BR-D05: hủy khi còn hạn giữ chỗ -> CANCELLED; quá hạn thì chặn (để job chuyển EXPIRED)
  assert.equal(canTransition(p, S.CANCELLED, 'CUSTOMER', now + 10 * M).ok, true);
  assert.equal(canTransition(p, S.CANCELLED, 'CUSTOMER', now + 15 * M).reason, 'HOLD_EXPIRED');
  assert.equal(canTransition(p, S.EXPIRED, 'SYSTEM', now + 15 * M).ok, true);
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
  // BR-F01: check-in tới start+30' (= now+90'); sau đó chỉ còn NO_SHOW
  assert.equal(canTransition(c, S.CHECKED_IN, 'ADMIN', now + 90 * M).ok, true);
  assert.equal(canTransition(c, S.CHECKED_IN, 'ADMIN', now + 91 * M).reason, 'TOO_LATE');
  assert.equal(canTransition(c, S.NO_SHOW, 'ADMIN', now + 90 * M).reason, 'NOT_NO_SHOW_YET');
  assert.equal(canTransition(c, S.NO_SHOW, 'ADMIN', now + 91 * M).ok, true);
  assert.equal(
    canTransition({ status: S.CHECKED_OUT }, S.CANCELLED, 'CUSTOMER', now).reason,
    'INVALID_TRANSITION',
  );
});

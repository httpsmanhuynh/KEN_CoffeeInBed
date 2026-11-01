'use strict';
const C = require('../config/constants');

const S = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT', CONFIRMED: 'CONFIRMED', CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED', NO_SHOW: 'NO_SHOW',
});

// Ma trận hợp lệ duy nhất (BR-F04). Actor theo FR-3.2.
const TRANSITIONS = Object.freeze({
  [S.PENDING_PAYMENT]: { CONFIRMED: ['PAYMENT'], EXPIRED: ['SYSTEM'], CANCELLED: ['CUSTOMER'] },
  [S.CONFIRMED]: { CHECKED_IN: ['ADMIN'], NO_SHOW: ['ADMIN'], CANCELLED: ['CUSTOMER'] },
  [S.CHECKED_IN]: { CHECKED_OUT: ['ADMIN'] },
  [S.CHECKED_OUT]: {}, [S.EXPIRED]: {}, [S.CANCELLED]: {}, [S.NO_SHOW]: {},
});

const min = (n) => n * 60000;

// booking: { status, startAt(ms), paymentExpiresAt(ms) }; trả { ok, reason }
function canTransition(booking, to, actor, now) {
  const allowed = TRANSITIONS[booking.status] && TRANSITIONS[booking.status][to];
  if (!allowed) return { ok: false, reason: 'INVALID_TRANSITION' };
  if (!allowed.includes(actor)) return { ok: false, reason: 'FORBIDDEN_ACTOR' };

  if (booking.status === S.PENDING_PAYMENT) {
    if (to === S.CONFIRMED && now >= booking.paymentExpiresAt) return { ok: false, reason: 'HOLD_EXPIRED' };       // BR-E03
    if (to === S.EXPIRED && now < booking.paymentExpiresAt) return { ok: false, reason: 'NOT_YET_EXPIRED' };       // BR-D04
  }
  if (booking.status === S.CONFIRMED) {
    if (to === S.CHECKED_IN && now < booking.startAt - min(C.CHECKIN_EARLY_MINUTES)) return { ok: false, reason: 'TOO_EARLY' };       // BR-F01
    if (to === S.NO_SHOW && now <= booking.startAt + min(C.NO_SHOW_AFTER_MINUTES)) return { ok: false, reason: 'NOT_NO_SHOW_YET' }; // BR-F01
    if (to === S.CANCELLED && now > booking.startAt - min(C.CANCEL_CUTOFF_MINUTES)) return { ok: false, reason: 'PAST_CUTOFF' };     // BR-G01
  }
  return { ok: true };
}

module.exports = { STATUS: S, TRANSITIONS, canTransition };

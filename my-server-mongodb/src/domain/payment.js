'use strict';
// Domain: Payment — kiểm tra/xử lý thanh toán thuần tuý (không gọi DB).
// BR-E01: booking PENDING_PAYMENT → CONFIRMED sau thanh toán thành công.
// BR-E02: số tiền thanh toán phải khớp đúng booking.final_amount.
// BR-E03: thanh toán trong thời hạn hold (paymentExpiresAt / payment_expires_at).

const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'PENDING', // chưa xử lý
  SUCCESS: 'SUCCESS', // thanh toán thành công
  FAILED: 'FAILED', // thất bại (lỗi cổng, từ chối thẻ…)
  CANCELLED: 'CANCELLED', // khách huỷ chủ động
  REFUNDED: 'REFUNDED', // đã hoàn tiền
});

const PAYMENT_METHODS = Object.freeze([
  'SIMULATION',
  'MANUAL',
  'CASH',
  'BANK_TRANSFER',
  'MOMO',
  'VNPAY',
  'ZALOPAY',
  'CARD',
]);

/**
 * Validate một yêu cầu thanh toán trước khi ghi DB.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validatePayment({ booking, amount, now = Date.now() }) {
  if (!booking) return { ok: false, reason: 'BOOKING_NOT_FOUND' };
  if (booking.status !== 'PENDING_PAYMENT') {
    return { ok: false, reason: 'BOOKING_NOT_PAYABLE' };
  }

  // BR-E03: hết hạn hold (hỗ trợ cả camelCase paymentExpiresAt và snake_case payment_expires_at)
  const rawExpires = booking.paymentExpiresAt ?? booking.payment_expires_at;
  const expiresAt =
    rawExpires instanceof Date ? rawExpires.getTime() : Number(rawExpires);
  if (now >= expiresAt) return { ok: false, reason: 'HOLD_EXPIRED' };

  // BR-E02: số tiền phải khớp
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, reason: 'INVALID_AMOUNT' };
  }
  if (amount !== booking.final_amount) {
    return { ok: false, reason: 'AMOUNT_MISMATCH' };
  }

  return { ok: true };
}

/**
 * Quyết định trạng thái booking sau kết quả thanh toán.
 * - SUCCESS  → booking CONFIRMED
 * - FAILED / CANCELLED → booking vẫn PENDING_PAYMENT (có thể thử lại)
 */
function bookingStatusAfterPayment(paymentStatus) {
  if (paymentStatus === PAYMENT_STATUSES.SUCCESS) return 'CONFIRMED';
  return 'PENDING_PAYMENT'; // giữ nguyên để customer thử lại
}

module.exports = {
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  validatePayment,
  bookingStatusAfterPayment,
};

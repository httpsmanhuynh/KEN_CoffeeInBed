'use strict';
const C = require('../config/constants');
const min = (n) => n * 60000;

// Mọi mốc thời gian là ms epoch. existing: [{ start, end, guests }] của booking còn giữ chỗ
// (PENDING_PAYMENT chưa hết hạn, CONFIRMED, CHECKED_IN). Chỉ để kiểm tra, không giữ chỗ (BR-C07).
function checkAvailability(q) {
  const { mode, start, end, guests, now, openAt, closeAt, space, existing = [] } = q;
  if (space.status === 'MAINTENANCE' || space.status === 'INACTIVE') return { ok: false, reason: 'SPACE_UNAVAILABLE' }; // B01
  if (!(end > start)) return { ok: false, reason: 'INVALID_RANGE' };                                    // C03
  if (start < openAt || end > closeAt) return { ok: false, reason: 'OUTSIDE_OPENING_HOURS' };           // C03
  if (start - now < min(C.MIN_LEAD_MINUTES)) return { ok: false, reason: 'TOO_SOON' };                  // C06
  if (guests < space.minGuests || guests > space.maxGuests) return { ok: false, reason: 'GUEST_COUNT' }; // C02

  if (mode === 'EXCLUSIVE') {
    const buf = min(space.bufferMinutes ?? C.BUFFER_MINUTES);                                            // C04
    const clash = existing.some((b) => start < b.end + buf && b.start < end + buf);
    return clash ? { ok: false, reason: 'OVERLAP' } : { ok: true };                                      // C01
  }
  // SHARED: tại mọi thời điểm, tổng khách trùng giờ ≤ capacity (quét theo điểm bắt đầu)
  const overlapping = existing.filter((b) => start < b.end && b.start < end);
  const points = [start, ...overlapping.map((b) => b.start).filter((t) => t > start && t < end)];
  for (const t of points) {
    const load = overlapping.filter((b) => b.start <= t && t < b.end).reduce((s, b) => s + b.guests, 0);
    if (load + guests > space.capacity) return { ok: false, reason: 'CAPACITY_EXCEEDED' };               // C01
  }
  return { ok: true };
}

module.exports = { checkAvailability };

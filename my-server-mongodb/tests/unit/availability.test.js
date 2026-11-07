'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAvailability } = require('../../src/domain/availability');

const M = 60000, H = 60 * M;

test('TC-AVAIL-01\tAUTO-AVAIL-01: availability: EXCLUSIVE chống trùng + buffer; SHARED theo capacity', () => {
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

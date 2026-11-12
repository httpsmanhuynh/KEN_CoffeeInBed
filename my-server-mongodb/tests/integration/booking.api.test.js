'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  searchAvailableSpaces,
  selectSpaceAndPackage,
  buildBookingQuote,
  createBooking,
  payBooking,
  cancelBooking,
  rescheduleBooking,
  checkInBooking,
  checkOutBooking,
  markNoShowBooking,
  expirePendingBookings,
  reconcileRefund,
} = require('../../src/services/bookingService');
const { cloneDoc, matchFilter, createMockDb, IDS, buildSeedDb } = require('../helpers/mockDb');

test('TC-BKG-23..27\tTC-BK-02\tAUTO-BK-02: Hủy đơn CONFIRMED trước Cut-off Time, hoàn trả Voucher và đối soát hoàn tiền', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const now = new Date('2026-05-12T01:00:00Z');
  const startAt = new Date('2026-05-12T05:00:00Z'); // cách now 4 tiếng (> 120p cut-off)

  const booking = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    voucherCode: 'WELCOME10',
    now,
  });
  assert.equal((await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome })).usage_count, 1);

  await payBooking(db, {
    bookingId: booking._id,
    user: user1,
    result: 'SUCCESS',
    now: new Date(now.getTime() + 60000),
  });

  // Đổi giờ sang 06:00Z (13:00 VN -> 17:00 VN) trước Cut-off Time
  const newStart = new Date('2026-05-12T06:00:00Z');
  const rescheduled = await rescheduleBooking(db, {
    bookingId: booking._id,
    user: user1,
    newStartAt: newStart,
    now: new Date('2026-05-12T02:00:00Z'),
  });
  assert.equal(rescheduled.start_at.toISOString(), '2026-05-12T06:00:00.000Z');
  assert.equal(rescheduled.end_at.toISOString(), '2026-05-12T10:00:00.000Z');
  assert.equal(rescheduled.blocked_until.toISOString(), '2026-05-12T10:15:00.000Z');

  // Hủy đơn với giả lập cổng hoàn tiền lỗi (FAILED) -> sau đó Admin xử lý thủ công (MANUALLY_RESOLVED)
  const cancelled = await cancelBooking(db, {
    bookingId: booking._id,
    user: user1,
    refundResult: 'FAILED',
    now: new Date('2026-05-12T03:00:00Z'),
  });
  assert.equal(cancelled.booking.status, 'CANCELLED');
  assert.equal(cancelled.booking.refund_status, 'FAILED');
  assert.equal(cancelled.booking.voucher_usage_released, true);
  assert.equal((await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome })).usage_count, 0);

  const reconciled = await reconcileRefund(db, {
    bookingId: booking._id,
    adminUser: { _id: IDS.admin },
    note: 'Đã chuyển khoản hoàn tiền thủ công',
    now: new Date('2026-05-12T03:30:00Z'),
  });
  assert.equal(reconciled.refund_status, 'MANUALLY_RESOLVED');
});

test('TC-BKG-31..33\tTC-BK-03\tAUTO-BK-03: Cronjob thu hồi đơn PENDING_PAYMENT quá hạn 15 phút và giải phóng khung giờ', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const now = new Date('2026-05-15T01:00:00Z');
  const startAt = new Date('2026-05-15T03:00:00Z');

  const b1 = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    voucherCode: 'WELCOME10',
    now,
  });

  // Sau 16 phút: khách không thể tự hủy (HOLD_EXPIRED), cronjob chuyển sang EXPIRED
  const after16m = new Date(now.getTime() + 16 * 60000);
  await assert.rejects(
    () => cancelBooking(db, { bookingId: b1._id, user: user1, now: after16m }),
    (err) => err.code === 'HOLD_EXPIRED',
  );

  const expRes = await expirePendingBookings(db, { now: after16m });
  assert.equal(expRes.expiredCount, 1);
  const expiredDoc = await db.collection('bookings').findOne({ _id: b1._id });
  assert.equal(expiredDoc.status, 'EXPIRED');
  assert.equal(expiredDoc.voucher_usage_released, true);
});

// ---------- 3. TEST SONG SONG (Concurrency / Race Condition — NFR-02) ----------
test('TC-BKG-01,19\tTC-BK-04\tAUTO-BK-04: TEST SONG SONG (EXCLUSIVE): Hai người đặt cùng một khung giờ thì chỉ một người thành công', async () => {
  const db = buildSeedDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);

  const now = new Date('2026-05-20T01:00:00Z');
  const sameSlotStart = new Date('2026-05-20T03:00:00Z'); // 10:00 - 14:00 VN

  // Hai người dùng gửi yêu cầu đặt cùng một phòng Focus Pod (EXCLUSIVE) tại cùng một thời điểm
  const results = await Promise.allSettled([
    createBooking(db, {
      user: user1,
      spaceId: IDS.spaceFocusPod,
      packageId: IDS.pkgFpHalf,
      startAt: sameSlotStart,
      guestCount: 1,
      now,
    }),
    createBooking(db, {
      user: user2,
      spaceId: IDS.spaceFocusPod,
      packageId: IDS.pkgFpHalf,
      startAt: sameSlotStart,
      guestCount: 1,
      now,
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  // Bắt buộc chỉ đúng 1 người thành công, 1 người bị từ chối với lỗi 409 OVERLAP
  assert.equal(fulfilled.length, 1, 'Chỉ đúng 1 người được tạo đơn giữ chỗ thành công');
  assert.equal(rejected.length, 1, 'Người thứ hai phải bị từ chối');
  assert.equal(rejected[0].reason.status, 409);
  assert.equal(rejected[0].reason.code, 'OVERLAP');

  // Kiểm tra trong DB chỉ có đúng 1 đơn giữ chỗ và lock_version của Space đã tăng
  const allBookings = await db.collection('bookings').find({}).toArray();
  assert.equal(allBookings.length, 1);
  const spaceAfter = await db.collection('spaces').findOne({ _id: IDS.spaceFocusPod });
  assert.equal(spaceAfter.lock_version, 1);
});

test('TC-BKG-03,20\tTC-BK-05\tAUTO-BK-05: TEST SONG SONG (SHARED): Hai nhóm khách cùng đặt vượt sức chứa còn lại thì chỉ một nhóm thành công', async () => {
  const db = buildSeedDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);

  const now = new Date('2026-05-21T01:00:00Z');
  const startAt = new Date('2026-05-21T03:00:00Z');

  // Giả sử Work Lounge (SHARED, sức chứa 20 người) đã có sẵn 15 khách đặt trước
  await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceWorkLounge,
    packageId: IDS.pkgWlFlex,
    startAt,
    hours: 2,
    guestCount: 15,
    now,
  });

  // Còn trống 5 chỗ: hai người cùng lúc đặt mỗi đơn 4 khách (4 + 4 = 8 > 5)
  const results = await Promise.allSettled([
    createBooking(db, {
      user: user1,
      spaceId: IDS.spaceWorkLounge,
      packageId: IDS.pkgWlFlex,
      startAt,
      hours: 2,
      guestCount: 4,
      now,
    }),
    createBooking(db, {
      user: user2,
      spaceId: IDS.spaceWorkLounge,
      packageId: IDS.pkgWlFlex,
      startAt,
      hours: 2,
      guestCount: 4,
      now,
    }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Chỉ đúng 1 nhóm 4 khách đặt thành công (15 + 4 = 19 <= 20)');
  assert.equal(rejected.length, 1, 'Nhóm thứ hai vượt sức chứa 20 phải bị từ chối');
  assert.equal(rejected[0].reason.status, 409);
  assert.equal(rejected[0].reason.code, 'CAPACITY_EXCEEDED');
});

// ---------- 4. Kiểm thử chi tiết các nhánh ngoại lệ & biên nghiệp vụ (Full Coverage) ----------
test('TC-BKG-05,06\tTC-BK-06\tAUTO-BK-06: Kiểm tra khung giờ (FIXED, HOURLY, is_full_day) và bộ lọc searchAvailableSpaces / selectSpaceAndPackage', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const now = new Date('2026-05-22T01:00:00Z');
  const startAt = new Date('2026-05-22T03:00:00Z'); // 10:00 VN

  // Thêm gói Cả ngày (is_full_day) cho Focus Pod
  const pkgFullDayId = new ObjectId();
  await db.collection('packages').insertOne({
    _id: pkgFullDayId,
    zone_id: IDS.zoneTapTrung,
    package_code: 'PKG_FP_FULL',
    name: 'Gói Cả ngày',
    package_type: 'FIXED',
    pricing_unit: 'PER_PERSON',
    duration_hours: 14,
    is_full_day: true,
    min_hours: 1,
    is_active: true,
  });
  await db.collection('package_prices').insertOne({
    _id: new ObjectId(),
    package_id: pkgFullDayId,
    space_id: IDS.spaceFocusPod,
    price: 250000,
  });

  // Lọc searchAvailableSpaces với đủ tiêu chí (spaceType, bookingMode, minCapacity, maxPrice, endAt)
  const filtered = await searchAvailableSpaces(db, {
    zoneId: String(IDS.zoneTapTrung),
    startAt,
    endAt: new Date('2026-05-22T07:00:00Z'),
    guestCount: 1,
    spaceType: 'FOCUS_POD',
    bookingMode: 'EXCLUSIVE',
    minCapacity: 1,
    maxPrice: 200000,
    now,
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].packages.length, 1); // Gói 250k bị lọc bởi maxPrice = 200k

  // Gói Cả ngày: kết thúc đúng 22:00 VN (15:00Z)
  const fullDaySel = await selectSpaceAndPackage(db, {
    spaceId: IDS.spaceFocusPod,
    packageId: pkgFullDayId,
    startAt,
    guestCount: 1,
    now,
  });
  assert.equal(fullDaySel.endAt.toISOString(), '2026-05-22T15:00:00.000Z');
  assert.equal(fullDaySel.packagePrice, 250000);

  // Gói HOURLY truyền qua endAt thay vì hours (PER_SPACE & PER_PERSON)
  const pkgHourlySpaceId = new ObjectId();
  await db.collection('packages').insertOne({
    _id: pkgHourlySpaceId,
    zone_id: IDS.zoneTapTrung,
    package_code: 'PKG_FP_HOURLY',
    name: 'Theo giờ phòng riêng',
    package_type: 'HOURLY',
    pricing_unit: 'PER_SPACE',
    duration_hours: null,
    is_full_day: false,
    min_hours: 2,
    is_active: true,
  });
  await db.collection('package_prices').insertOne({
    _id: new ObjectId(),
    package_id: pkgHourlySpaceId,
    space_id: IDS.spaceFocusPod,
    price: 45000,
  });
  const hourlySel = await selectSpaceAndPackage(db, {
    spaceId: IDS.spaceFocusPod,
    packageId: pkgHourlySpaceId,
    startAt,
    endAt: new Date('2026-05-22T05:00:00Z'), // 2 giờ
    guestCount: 1,
    now,
  });
  assert.equal(hourlySel.packagePrice, 90000);

  // Các lỗi biên của searchAvailableSpaces và resolveTimeWindow
  await assert.rejects(
    () => searchAvailableSpaces(db, { startAt: 'invalid-date', guestCount: 1 }),
    { code: 'INVALID_START_TIME' },
  );
  await assert.rejects(
    () => searchAvailableSpaces(db, { startAt, guestCount: 0 }),
    { code: 'INVALID_GUEST_COUNT' },
  );
  await assert.rejects(
    () => searchAvailableSpaces(db, { startAt: new Date('2026-05-22T00:00:00Z'), guestCount: 1 }),
    { code: 'OUTSIDE_OPERATING_HOURS' },
  );
  await assert.rejects(
    () =>
      selectSpaceAndPackage(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: 'bad',
        guestCount: 1,
      }),
    { code: 'INVALID_START_TIME' },
  );
  await assert.rejects(
    () =>
      selectSpaceAndPackage(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        endAt: new Date('2026-05-22T05:00:00Z'), // sai 4 giờ cố định
        guestCount: 1,
      }),
    { code: 'INVALID_DURATION' },
  );
  await assert.rejects(
    () =>
      selectSpaceAndPackage(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: pkgHourlySpaceId,
        startAt,
        hours: 1, // < min_hours (2)
        guestCount: 1,
      }),
    { code: 'INVALID_DURATION' },
  );
  await assert.rejects(
    () =>
      selectSpaceAndPackage(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: new Date('2026-05-22T13:00:00Z'), // 20:00 VN + 4h = 24:00 > 22:00
        guestCount: 1,
      }),
    { code: 'OUTSIDE_OPERATING_HOURS' },
  );

  // Khi phòng đã có đơn giữ chỗ -> selectSpaceAndPackage báo 409 OVERLAP
  await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    now,
  });
  await assert.rejects(
    () =>
      selectSpaceAndPackage(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        now,
      }),
    { code: 'OVERLAP' },
  );
});

test('TC-BKG-09..12\tTC-BK-07\tAUTO-BK-07: Kiểm tra ngoại lệ báo giá (Inclusion, Add-on, Variant, Voucher Coins) và điều kiện Checkout', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const now = new Date('2026-05-25T01:00:00Z');
  const startAt = new Date('2026-05-25T03:00:00Z');

  // ID không hợp lệ
  await assert.rejects(
    () => buildBookingQuote(db, { spaceId: 'bad-id', packageId: IDS.pkgFpHalf, startAt, guestCount: 1 }),
    { code: 'INVALID_SPACE_ID' },
  );
  // Space không tồn tại
  await assert.rejects(
    () => buildBookingQuote(db, { spaceId: new ObjectId(), packageId: IDS.pkgFpHalf, startAt, guestCount: 1 }),
    { code: 'SPACE_NOT_AVAILABLE' },
  );
  // Package không tương thích
  await assert.rejects(
    () => buildBookingQuote(db, { spaceId: IDS.spaceFocusPod, packageId: IDS.pkgWlFlex, startAt, guestCount: 1 }),
    { code: 'PACKAGE_INCOMPATIBLE' },
  );
  // Số khách vượt max_guests
  await assert.rejects(
    () => buildBookingQuote(db, { spaceId: IDS.spaceFocusPod, packageId: IDS.pkgFpHalf, startAt, guestCount: 5 }),
    { code: 'INVALID_GUEST_COUNT' },
  );

  // Lỗi Inclusion: số lượng <= 0, sai slot, vượt định mức, món không tồn tại, sai category, sai variant
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        inclusions: [{ packageInclusionId: IDS.incFpDrink, productId: IDS.prodMatcha, quantity: 0 }],
      }),
    { code: 'INVALID_INCLUSION_QTY' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        inclusions: [{ packageInclusionId: new ObjectId(), productId: IDS.prodMatcha, quantity: 1 }],
      }),
    { code: 'INCLUSION_NOT_IN_PACKAGE' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        inclusions: [{ packageInclusionId: IDS.incFpDrink, productId: IDS.prodMatcha, quantity: 2 }],
      }),
    { code: 'INCLUSION_QUOTA_EXCEEDED' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        inclusions: [{ packageInclusionId: IDS.incFpDrink, productId: new ObjectId(), quantity: 1 }],
      }),
    { code: 'PRODUCT_NOT_FOUND' },
  );
  const pastryId = new ObjectId();
  await db.collection('products').insertOne({
    _id: pastryId,
    name: 'Croissant',
    category: 'PASTRY',
    price: 35000,
    variants: [],
    is_active: true,
  });
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        inclusions: [{ packageInclusionId: IDS.incFpDrink, productId: pastryId, quantity: 1 }],
      }),
    { code: 'INCLUSION_CATEGORY_MISMATCH' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        inclusions: [
          { packageInclusionId: IDS.incFpDrink, productId: IDS.prodMatcha, variant: 'Sai size', quantity: 1 },
        ],
      }),
    { code: 'INVALID_PRODUCT_VARIANT' },
  );

  // Lỗi Add-on: số lượng <= 0, không tồn tại, sai variant
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        addons: [{ addonId: IDS.addonMonitor, quantity: 0 }],
      }),
    { code: 'INVALID_ADDON_QTY' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        addons: [{ addonId: new ObjectId(), quantity: 1 }],
      }),
    { code: 'ADDON_NOT_FOUND' },
  );
  // AUTO-PRICING-017 / TC-PRICING-024: Add-on PER_BOOKING cho phép số lượng > 1 (50.000đ x 2 = 100.000đ)
  const quoteWithMonitor = await buildBookingQuote(db, {
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    addons: [{ addonId: IDS.addonMonitor, quantity: 2 }],
  });
  assert.strictEqual(quoteWithMonitor.pricing.addonTotal, 100000);
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        addons: [{ addonId: IDS.addonMonitor, variant: 'Không có', quantity: 1 }],
      }),
    { code: 'INVALID_ADDON_VARIANT' },
  );

  // Lỗi Voucher: mã sai, hết hạn, hết lượt, chưa đủ min_order_value, voucher đổi bằng Coins
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        voucherCode: 'NOTFOUND',
        now,
      }),
    { code: 'VOUCHER_INVALID' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        voucherCode: 'WELCOME10',
        now: new Date('2025-01-01T00:00:00Z'),
      }),
    { code: 'VOUCHER_EXPIRED' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceWorkLounge,
        packageId: IDS.pkgWlFlex,
        startAt,
        hours: 2,
        guestCount: 1, // 60.000đ < min_order_value 100.000đ
        voucherCode: 'WELCOME10',
        now,
      }),
    { code: 'VOUCHER_MIN_ORDER' },
  );

  // Voucher đổi bằng KÉN Coins (FIXED discount)
  const coinVoucherId = new ObjectId();
  await db.collection('vouchers').insertOne({
    _id: coinVoucherId,
    code: 'COIN50K',
    discount_type: 'FIXED',
    discount_value: 50000,
    min_order_value: 100000,
    valid_from: new Date('2026-01-01T00:00:00Z'),
    valid_to: new Date('2026-12-31T23:59:59Z'),
    usage_limit: 10,
    usage_count: 0,
    redeem_limit: 10,
    redeem_count: 1,
    coins_cost: 50,
    status: 'ACTIVE',
  });
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        voucherCode: 'COIN50K',
        user: null,
        now,
      }),
    { code: 'UNAUTHENTICATED' },
  );
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        voucherCode: 'COIN50K',
        user: user1,
        now,
      }),
    { code: 'VOUCHER_NOT_OWNED' },
  );

  // Cấp quyền sở hữu user_vouchers và tạo đơn thành công
  const uvId = new ObjectId();
  await db.collection('user_vouchers').insertOne({
    _id: uvId,
    user_id: user1._id,
    voucher_id: coinVoucherId,
    redeemed_at: now,
    used_booking_id: null,
    used_at: null,
  });

  // Kiểm tra lỗi createBooking: UNAUTHENTICATED, SPACE_NOT_AVAILABLE, LEAD_TIME_VIOLATION, PRICE_CHANGED
  await assert.rejects(
    () =>
      createBooking(db, {
        user: null,
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        now,
      }),
    { code: 'UNAUTHENTICATED' },
  );
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: new ObjectId(),
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        now,
      }),
    { code: 'SPACE_NOT_AVAILABLE' },
  );

  // Kiểm tra ZONE_NOT_BOOKABLE, Add-on có variant hợp lệ và VOUCHER_USAGE_LIMIT
  const unbookableSpaceId = new ObjectId();
  await db.collection('spaces').insertOne({
    _id: unbookableSpaceId,
    zone_id: IDS.zoneKetNoi,
    space_code: 'KN-01',
    name: 'Bàn Kết Nối',
    space_type: 'TABLE',
    booking_mode: 'SHARED',
    capacity: 4,
    min_guests: 1,
    max_guests: 4,
    open_time: '08:00',
    close_time: '22:00',
    buffer_minutes: 0,
    status: 'ACTIVE',
    lock_version: 0,
  });
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: unbookableSpaceId,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
      }),
    { code: 'ZONE_NOT_BOOKABLE' },
  );

  const addonWithVarId = new ObjectId();
  await db.collection('addons').insertOne({
    _id: addonWithVarId,
    name: 'Bánh ngọt dùng thêm',
    unit: 'PER_ITEM',
    price: 35000,
    variants: [{ name: 'Sốt dâu', price: 40000 }],
    is_active: true,
  });

  const createdWithCoinVoucher = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    addons: [{ addonId: addonWithVarId, variant: 'Sốt dâu', quantity: 1 }],
    voucherCode: 'COIN50K',
    now,
  });
  assert.equal(createdWithCoinVoucher.addon_total, 40000);
  assert.equal(createdWithCoinVoucher.voucher_discount, 50000);
  const uvAfter = await db.collection('user_vouchers').findOne({ _id: uvId });
  assert.equal(String(uvAfter.used_booking_id), String(createdWithCoinVoucher._id));

  // Khi voucher đã hết lượt usage_limit -> báo VOUCHER_USAGE_LIMIT
  await db.collection('vouchers').updateOne({ _id: coinVoucherId }, { $set: { usage_count: 10 } });
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        voucherCode: 'COIN50K',
        user: user1,
        now,
      }),
    { code: 'VOUCHER_USAGE_LIMIT' },
  );

  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: new Date(now.getTime() + 10 * 60000), // < 30p
        guestCount: 1,
        now,
      }),
    { code: 'LEAD_TIME_VIOLATION' },
  );
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceWorkLounge,
        packageId: IDS.pkgWlFlex,
        startAt,
        hours: 2,
        guestCount: 1,
        expectedFinalAmount: 999999,
        now,
      }),
    { code: 'PRICE_CHANGED' },
  );
});

test('TC-BKG-08,28..30\tTC-BK-08\tAUTO-BK-08: Kiểm tra các nhánh vận hành: Đơn 0đ, No-show, lỗi phân quyền & đổi lịch gói Cả ngày', async () => {
  const db = buildSeedDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);
  const now = new Date('2026-05-26T01:00:00Z');
  const startAt = new Date('2026-05-26T03:00:00Z');

  // Voucher giảm 100% tạo đơn 0đ -> payBooking dùng method = 'NONE'
  await db.collection('vouchers').insertOne({
    _id: new ObjectId(),
    code: 'FREE100',
    discount_type: 'PERCENT',
    discount_value: 100,
    min_order_value: 0,
    valid_from: new Date('2026-01-01T00:00:00Z'),
    valid_to: new Date('2026-12-31T23:59:59Z'),
    usage_limit: 5,
    usage_count: 0,
    redeem_limit: 0,
    redeem_count: 0,
    coins_cost: 0,
    status: 'ACTIVE',
  });

  const freeBooking = await createBooking(db, {
    user: user2,
    spaceId: IDS.spaceWorkLounge,
    packageId: IDS.pkgWlFlex,
    startAt,
    hours: 2,
    guestCount: 2,
    voucherCode: 'FREE100',
    now,
  });
  assert.equal(freeBooking.final_amount, 0);
  assert.equal(freeBooking.fixed_inclusions_snapshot.length, 1); // 2 bình nước suối

  // user1 không được thanh toán hoặc hủy đơn của user2 (FORBIDDEN)
  await assert.rejects(
    () => payBooking(db, { bookingId: freeBooking._id, user: user1, now }),
    { code: 'FORBIDDEN' },
  );
  await assert.rejects(
    () => cancelBooking(db, { bookingId: freeBooking._id, user: user1, now }),
    { code: 'FORBIDDEN' },
  );

  const freePay = await payBooking(db, {
    bookingId: freeBooking._id,
    user: user2,
    now,
  });
  assert.equal(freePay.transaction.method, 'NONE');
  assert.equal(freePay.booking.status, 'CONFIRMED');

  // Không thể thanh toán lại đơn đã CONFIRMED
  await assert.rejects(
    () => payBooking(db, { bookingId: freeBooking._id, user: user2, now }),
    { code: 'INVALID_TRANSITION' },
  );

  // Kiểm tra lỗi rescheduleBooking: FORBIDDEN, PAST_CUTOFF, INVALID_START_TIME, LEAD_TIME_VIOLATION, OUTSIDE_OPERATING_HOURS
  await assert.rejects(
    () => rescheduleBooking(db, { bookingId: freeBooking._id, user: user1, newStartAt: startAt, now }),
    { code: 'FORBIDDEN' },
  );
  await assert.rejects(
    () =>
      rescheduleBooking(db, {
        bookingId: freeBooking._id,
        user: user2,
        newStartAt: 'bad-date',
        now,
      }),
    { code: 'INVALID_START_TIME' },
  );
  await assert.rejects(
    () =>
      rescheduleBooking(db, {
        bookingId: freeBooking._id,
        user: user2,
        newStartAt: new Date(now.getTime() + 10 * 60000),
        now,
      }),
    { code: 'LEAD_TIME_VIOLATION' },
  );
  await assert.rejects(
    () =>
      rescheduleBooking(db, {
        bookingId: freeBooking._id,
        user: user2,
        newStartAt: new Date('2026-05-26T14:30:00Z'), // 21:30 VN + 2h > 22:00 VN
        now,
      }),
    { code: 'OUTSIDE_OPERATING_HOURS' },
  );
  await assert.rejects(
    () =>
      rescheduleBooking(db, {
        bookingId: freeBooking._id,
        user: user2,
        newStartAt: new Date('2026-05-26T05:00:00Z'),
        now: new Date(startAt.getTime() - 60 * 60000), // chỉ còn 60p < 120p cut-off
      }),
    { code: 'PAST_CUTOFF' },
  );

  // Tạo thêm 1 đơn lấp đầy 19 chỗ lúc 06:00Z -> đổi lịch freeBooking (2 khách) sang 06:00Z bị từ chối CAPACITY_EXCEEDED
  await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceWorkLounge,
    packageId: IDS.pkgWlFlex,
    startAt: new Date('2026-05-26T06:00:00Z'),
    hours: 2,
    guestCount: 19,
    now,
  });
  await assert.rejects(
    () =>
      rescheduleBooking(db, {
        bookingId: freeBooking._id,
        user: user2,
        newStartAt: new Date('2026-05-26T06:00:00Z'),
        now,
      }),
    { code: 'CAPACITY_EXCEEDED' },
  );

  // Kiểm tra Check-in quá sớm / quá trễ và đánh dấu No-show (UC-27)
  await assert.rejects(
    () => checkInBooking(db, { bookingId: freeBooking._id, now: new Date(startAt.getTime() - 20 * 60000) }),
    { code: 'TOO_EARLY' },
  );
  await assert.rejects(
    () => markNoShowBooking(db, { bookingId: freeBooking._id, now: new Date(startAt.getTime() + 10 * 60000) }),
    { code: 'NOT_NO_SHOW_YET' },
  );
  await assert.rejects(
    () => checkOutBooking(db, { bookingId: freeBooking._id, now }),
    { code: 'INVALID_TRANSITION' },
  );

  // Sau startAt + 31 phút: đánh dấu NO_SHOW thành công
  const noShowDoc = await markNoShowBooking(db, {
    bookingId: freeBooking._id,
    now: new Date(startAt.getTime() + 31 * 60000),
  });
  assert.equal(noShowDoc.status, 'NO_SHOW');

  // Đơn NO_SHOW không thể đổi lịch hoặc đối soát hoàn tiền
  await assert.rejects(
    () => rescheduleBooking(db, { bookingId: freeBooking._id, user: user2, newStartAt: startAt, now }),
    { code: 'INVALID_TRANSITION' },
  );
  await assert.rejects(
    () => reconcileRefund(db, { bookingId: freeBooking._id, adminUser: user1, now }),
    { code: 'INVALID_REFUND_STATE' },
  );
});


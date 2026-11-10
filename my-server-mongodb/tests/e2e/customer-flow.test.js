'use strict';
// Kịch bản kiểm thử End-to-End khách hàng từ đầu đến cuối theo quy trình chuẩn BR-D01
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

test('TC-BKG-07..17\tTC-BK-01\tAUTO-BK-01: Quy trình chuẩn BR-D01: Khám phá & Kiểm tra chỗ trống -> Chọn Space & Package -> Chọn Inclusion & Add-on -> Checkout -> Payment -> Confirmation -> Check-in -> Sử dụng -> Check-out', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const now = new Date('2026-05-10T01:00:00Z'); // 08:00 VN
  const startAt = new Date('2026-05-10T03:00:00Z'); // 10:00 VN (cách now 2 tiếng >= 30p)

  // Bước 1 (UC-04, BR-D01(1), BR-C07): Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách) ở chế độ Read-only
  const discoveredSpaces = await searchAvailableSpaces(db, {
    zoneId: IDS.zoneTapTrung,
    startAt,
    guestCount: 1,
    now,
  });
  assert.equal(discoveredSpaces.length, 2); // Focus Pod & Work Lounge đều trống cho 1 khách lúc 10:00 VN
  const focusPodInfo = discoveredSpaces.find((s) => String(s._id) === String(IDS.spaceFocusPod));
  assert.equal(focusPodInfo.isAvailable, true);
  assert.equal(focusPodInfo.packages.length, 1);
  assert.equal(focusPodInfo.packages[0].base_price, 140000);

  // Bước 2 (UC-05, BR-D01(2), BR-A04): Chọn Không gian (Space) & Gói dịch vụ (Package) + nhấn Book Now
  const selected = await selectSpaceAndPackage(db, {
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    now,
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.packagePrice, 140000);
  assert.equal(selected.selectableInclusions.length, 1);
  assert.equal(selected.selectableInclusions[0].subsidy_limit, 50000);

  // Bước 3 (UC-06, BR-D01(3)): Chọn món trong gói (Inclusion: Matcha Latte 55k -> phụ phí 5k) & Dịch vụ mua thêm (Add-on: Màn hình rời 50k)
  const step3Quote = await buildBookingQuote(db, {
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    inclusions: [
      {
        packageInclusionId: IDS.incFpDrink,
        productId: IDS.prodMatcha,
        variant: 'Lạnh, M (500 ml)',
        quantity: 1,
      },
    ],
    addons: [{ addonId: IDS.addonMonitor, quantity: 1 }],
    user: user1,
    now,
  });
  assert.equal(step3Quote.pricing.packagePrice, 140000);
  assert.equal(step3Quote.pricing.inclusionSurcharge, 5000);
  assert.equal(step3Quote.pricing.addonTotal, 50000);
  assert.equal(step3Quote.pricing.subtotal, 195000);

  // Bước 4 (UC-07 & UC-08, BR-D01(4)): Checkout — Áp dụng mã Voucher WELCOME10 (-19.500đ) + Hạng SILVER 5% (-8.775đ) -> Xác nhận Booking Summary
  const quote = await buildBookingQuote(db, {
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    inclusions: [
      {
        packageInclusionId: IDS.incFpDrink,
        productId: IDS.prodMatcha,
        variant: 'Lạnh, M (500 ml)',
        quantity: 1,
      },
    ],
    addons: [{ addonId: IDS.addonMonitor, quantity: 1 }],
    voucherCode: 'WELCOME10',
    user: user1,
    now,
  });

  assert.equal(quote.pricing.voucherDiscount, 19500);
  assert.equal(quote.pricing.tierDiscount, 8775);
  assert.equal(quote.pricing.finalAmount, 166725);

  // Xác nhận Checkout (UC-08) -> Tạo đơn giữ chỗ PENDING_PAYMENT 15 phút trong ACID Transaction
  const booking = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt,
    guestCount: 1,
    inclusions: [
      {
        packageInclusionId: IDS.incFpDrink,
        productId: IDS.prodMatcha,
        variant: 'Lạnh, M (500 ml)',
        quantity: 1,
      },
    ],
    addons: [{ addonId: IDS.addonMonitor, quantity: 1 }],
    voucherCode: 'WELCOME10',
    expectedFinalAmount: 166725,
    now,
  });

  assert.equal(booking.status, 'PENDING_PAYMENT');
  assert.equal(booking.final_amount, 166725);
  // Focus Pod EXCLUSIVE có buffer 15 phút: end_at = 07:00Z, blocked_until = 07:15Z
  assert.equal(booking.end_at.toISOString(), '2026-05-10T07:00:00.000Z');
  assert.equal(booking.blocked_until.toISOString(), '2026-05-10T07:15:00.000Z');

  // Bước 5 (UC-09, UC-10, BR-E02, BR-E07): Payment -> Confirmation
  // Thử thanh toán thất bại trước (giữ nguyên PENDING_PAYMENT & payment_expires_at)
  const failPay = await payBooking(db, {
    bookingId: booking._id,
    user: user1,
    result: 'FAILED',
    now: new Date(now.getTime() + 2 * 60000),
  });
  assert.equal(failPay.booking.status, 'PENDING_PAYMENT');
  assert.equal(failPay.transaction.status, 'FAILED');

  // Thanh toán lại thành công -> chuyển sang CONFIRMED và trả thông tin Confirmation + SMS mã đặt chỗ
  const okPay = await payBooking(db, {
    bookingId: booking._id,
    user: user1,
    result: 'SUCCESS',
    now: new Date(now.getTime() + 5 * 60000),
  });
  assert.equal(okPay.booking.status, 'CONFIRMED');
  assert.equal(okPay.transaction.status, 'SUCCESS');
  assert.equal(okPay.confirmation.bookingCode, booking.booking_code);
  assert.equal(okPay.confirmation.smsDispatched, true);

  // Check-in tại quầy (UC-25, BR-F01) trong cửa sổ [start - 15p, start + 30p]
  const checkedIn = await checkInBooking(db, {
    bookingId: booking._id,
    now: new Date(startAt.getTime() + 5 * 60000),
  });
  assert.equal(checkedIn.status, 'CHECKED_IN');

  // Sử dụng -> Check-out (UC-26, BR-F02, BR-H01) -> cộng 16 điểm (990 + 16 = 1006 điểm) & 16 Coins (50 + 16 = 66 Coins)
  const checkedOut = await checkOutBooking(db, {
    bookingId: booking._id,
    now: new Date('2026-05-10T06:55:00Z'),
  });
  assert.equal(checkedOut.status, 'CHECKED_OUT');
  const updatedUser = await db.collection('users').findOne({ _id: IDS.user1 });
  assert.equal(updatedUser.tier_points, 1006);
  assert.equal(updatedUser.coin_balance, 66);
});

// ---------- 2. Kiểm thử Hủy đơn, Đổi giờ (Reschedule) và Hết hạn giữ chỗ ----------


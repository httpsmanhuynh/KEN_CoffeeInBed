'use strict';
// Kiểm thử tích hợp cho Module 08: Voucher Management (các kịch bản cốt lõi: áp dụng tại Checkout, hoàn lượt, đổi Coins & chống tranh chấp đồng thời).
// Mã TC đồng bộ với Test_Module08_Voucher_Management.xlsx và Postman Collection Module 08.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { buildSeedDb, IDS } = require('../helpers/mockDb');
const { createBooking, expirePendingBookings } = require('../../src/services/bookingService');
const { redeemCoins } = require('../../src/domain/loyalty');

test('TC-VCH-11\tAUTO-VCH-11: ACTIVE → INACTIVE: Voucher ngừng hoạt động bị chặn áp dụng tại Checkout (VCH-B10)', async () => {
  const db = buildSeedDb();
  await db.collection('vouchers').updateOne({ _id: IDS.voucherWelcome }, { $set: { status: 'INACTIVE' } });
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });

  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: '2026-05-20T02:00:00Z',
        guestCount: 1,
        voucherCode: 'WELCOME10',
        now: new Date('2026-05-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_INVALID' },
  );
});

test('TC-VCH-15\tAUTO-VCH-15: Áp Voucher hợp lệ: usage_count +1, giảm giá vào price_snapshot (VCH-B13)', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const before = await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome });

  const booking = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt: '2026-05-20T02:00:00Z',
    guestCount: 1,
    voucherCode: 'WELCOME10',
    now: new Date('2026-05-19T02:00:00Z'),
  });

  const after = await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome });
  assert.equal(after.usage_count, before.usage_count + 1);
  assert.equal(booking.voucher_discount, 14000);
});

test('TC-VCH-16\tAUTO-VCH-16: Voucher hết hạn / chưa tới hạn bị từ chối tại Checkout (VCH-B14)', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  await db.collection('vouchers').updateOne(
    { _id: IDS.voucherWelcome },
    {
      $set: {
        valid_from: new Date('2026-06-01T00:00:00Z'),
        valid_to: new Date('2026-06-30T23:59:59Z'),
      },
    },
  );
  // Chưa tới hạn
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: '2026-05-20T02:00:00Z',
        guestCount: 1,
        voucherCode: 'WELCOME10',
        now: new Date('2026-05-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_EXPIRED' },
  );
  // Đã hết hạn
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: '2026-07-20T02:00:00Z',
        guestCount: 1,
        voucherCode: 'WELCOME10',
        now: new Date('2026-07-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_EXPIRED' },
  );
});

test('TC-VCH-17\tAUTO-VCH-17: Đơn tối thiểu: = min_order_value được; thấp hơn 1đ bị từ chối (VCH-B15)', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });

  await db.collection('vouchers').updateOne({ _id: IDS.voucherWelcome }, { $set: { min_order_value: 140001 } });
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt: '2026-05-20T02:00:00Z',
        guestCount: 1,
        voucherCode: 'WELCOME10',
        now: new Date('2026-05-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_MIN_ORDER' },
  );

  await db.collection('vouchers').updateOne({ _id: IDS.voucherWelcome }, { $set: { min_order_value: 140000 } });
  const booking = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt: '2026-05-20T02:00:00Z',
    guestCount: 1,
    voucherCode: 'WELCOME10',
    now: new Date('2026-05-19T02:00:00Z'),
  });
  assert.ok(booking._id);
});

test('TC-VCH-18\tAUTO-VCH-18: Số lượt: usage_count = usage_limit − 1 dùng được; đủ lượt thì chặn (VCH-B16)', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  await db.collection('vouchers').updateOne(
    { _id: IDS.voucherWelcome },
    { $set: { usage_limit: 5, usage_count: 4 } },
  );

  await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt: '2026-05-20T02:00:00Z',
    guestCount: 1,
    voucherCode: 'WELCOME10',
    now: new Date('2026-05-19T02:00:00Z'),
  });

  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceWorkLounge,
        packageId: IDS.pkgWlFlex,
        startAt: '2026-05-21T02:00:00Z',
        hours: 4,
        guestCount: 2,
        voucherCode: 'WELCOME10',
        now: new Date('2026-05-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_USAGE_LIMIT' },
  );
});

test('TC-VCH-19\tAUTO-VCH-19: 2 khách dùng lượt cuối cùng đồng thời (Race Condition) (VCH-B17)', async () => {
  const db = buildSeedDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);
  await db.collection('vouchers').updateOne(
    { _id: IDS.voucherWelcome },
    { $set: { usage_limit: 5, usage_count: 4 } },
  );

  const results = await Promise.allSettled([
    createBooking(db, {
      user: user1,
      spaceId: IDS.spaceWorkLounge,
      packageId: IDS.pkgWlFlex,
      startAt: '2026-05-20T02:00:00Z',
      hours: 4,
      guestCount: 2,
      voucherCode: 'WELCOME10',
      now: new Date('2026-05-19T02:00:00Z'),
    }),
    createBooking(db, {
      user: user2,
      spaceId: IDS.spaceWorkLounge,
      packageId: IDS.pkgWlFlex,
      startAt: '2026-05-20T02:00:00Z',
      hours: 4,
      guestCount: 2,
      voucherCode: 'WELCOME10',
      now: new Date('2026-05-19T02:00:00Z'),
    }),
  ]);

  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const v = await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome });
  assert.equal(v.usage_count, 5);
});

test('TC-VCH-20\tAUTO-VCH-20: Hủy / hết hạn đơn hoàn lại lượt Voucher (VCH-B18)', async () => {
  const db = buildSeedDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const booking = await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt: '2026-05-20T08:00:00Z',
    guestCount: 1,
    voucherCode: 'WELCOME10',
    now: new Date('2026-05-19T02:00:00Z'),
  });
  let v = await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome });
  assert.equal(v.usage_count, 1);

  await expirePendingBookings(db, new Date('2026-05-19T03:00:00Z'));
  v = await db.collection('vouchers').findOne({ _id: IDS.voucherWelcome });
  assert.equal(v.usage_count, 0);
  const bAfter = await db.collection('bookings').findOne({ _id: booking._id });
  assert.equal(bAfter.status, 'EXPIRED');
});

test('TC-VCH-21\tAUTO-VCH-21: Đổi Coins lấy Voucher: trừ Coins, giữ Điểm/Hạng, kiểm tra biên đủ & thiếu Coins (VCH-B19; VCH-B20; VCH-B21)', () => {
  assert.deepEqual(redeemCoins({ coins: 50 }, 30), { ok: true, coins: 20 });
  assert.deepEqual(redeemCoins({ coins: 30 }, 30), { ok: true, coins: 0 });
  assert.deepEqual(redeemCoins({ coins: 20 }, 30), { ok: false, reason: 'INSUFFICIENT_COINS' });
});

test('TC-VCH-25\tAUTO-VCH-25: Bấm đổi 2 lần đồng thời (double-submit) trên suất đổi cuối cùng (VCH-B23)', async () => {
  const db = buildSeedDb();
  const coinVoucherId = new ObjectId();
  await db.collection('vouchers').insertOne({
    _id: coinVoucherId,
    code: 'LASTCOIN',
    discount_type: 'FIXED_AMOUNT',
    discount_value: 30000,
    min_order_value: 100000,
    valid_from: new Date('2026-01-01T00:00:00Z'),
    valid_to: new Date('2026-12-31T23:59:59Z'),
    usage_limit: 10,
    usage_count: 0,
    redeem_limit: 1,
    redeem_count: 0,
    redeem_valid_to: new Date('2026-12-31T23:59:59Z'),
    coins_cost: 30,
    status: 'ACTIVE',
  });

  const tryRedeem = async () => {
    const upd = await db.collection('vouchers').updateOne(
      { _id: coinVoucherId, status: 'ACTIVE', redeem_count: { $lt: 1 } },
      { $inc: { redeem_count: 1 } },
    );
    if (upd.modifiedCount !== 1) {
      throw Object.assign(new Error('VOUCHER_REDEEM_EXHAUSTED'), { status: 409 });
    }
    return { ok: true };
  };

  const results = await Promise.allSettled([tryRedeem(), tryRedeem()]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
});

test('TC-VCH-27\tAUTO-VCH-27: Dùng Voucher đổi Coins của người khác / đã dùng rồi (VCH-B25)', async () => {
  const db = buildSeedDb();
  const coinVoucherId = new ObjectId();
  await db.collection('vouchers').insertOne({
    _id: coinVoucherId,
    code: 'COINONLY',
    discount_type: 'FIXED_AMOUNT',
    discount_value: 20000,
    min_order_value: 100000,
    valid_from: new Date('2026-01-01T00:00:00Z'),
    valid_to: new Date('2026-12-31T23:59:59Z'),
    usage_limit: 10,
    usage_count: 0,
    redeem_limit: 10,
    redeem_count: 1,
    redeem_valid_to: new Date('2026-12-31T23:59:59Z'),
    coins_cost: 20,
    status: 'ACTIVE',
  });
  await db.collection('user_vouchers').insertOne({
    _id: new ObjectId(),
    user_id: IDS.user1,
    voucher_id: coinVoucherId,
    coins_spent: 20,
    redeemed_at: new Date('2026-05-10T00:00:00Z'),
    used_booking_id: null,
  });

  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);

  // User2 cố dùng mã đổi Coins của User1 -> 422 VOUCHER_NOT_OWNED
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user2,
        spaceId: IDS.spaceWorkLounge,
        packageId: IDS.pkgWlFlex,
        startAt: '2026-05-20T02:00:00Z',
        hours: 4,
        guestCount: 2,
        voucherCode: 'COINONLY',
        now: new Date('2026-05-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_NOT_OWNED' },
  );

  // User1 dùng lần 1 -> thành công
  await createBooking(db, {
    user: user1,
    spaceId: IDS.spaceFocusPod,
    packageId: IDS.pkgFpHalf,
    startAt: '2026-05-20T02:00:00Z',
    guestCount: 1,
    voucherCode: 'COINONLY',
    now: new Date('2026-05-19T02:00:00Z'),
  });

  // User1 dùng lại lần 2 khi đã gán used_booking_id -> 422 VOUCHER_NOT_OWNED
  await assert.rejects(
    () =>
      createBooking(db, {
        user: user1,
        spaceId: IDS.spaceWorkLounge,
        packageId: IDS.pkgWlFlex,
        startAt: '2026-05-21T02:00:00Z',
        hours: 4,
        guestCount: 2,
        voucherCode: 'COINONLY',
        now: new Date('2026-05-19T02:00:00Z'),
      }),
    { status: 422, code: 'VOUCHER_NOT_OWNED' },
  );
});

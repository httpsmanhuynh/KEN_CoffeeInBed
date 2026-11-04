'use strict';
// Kiểm thử tích hợp Đặt không gian theo chuẩn BR-D01:
// Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách) -> Chọn Không gian (Space) & Gói dịch vụ (Package)
// -> Chọn món trong gói (Inclusion) & Dịch vụ mua thêm (Add-on) -> Checkout (Xác nhận Booking Summary)
// -> Payment -> Confirmation -> Check-in -> Sử dụng -> Check-out, cùng Hủy/Đổi giờ và TEST SONG SONG (NFR-02).
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
} = require('../src/services/bookingService');

// ---------- In-Memory MongoDB Mock hỗ trợ Multi-Document Transaction & WriteConflict (code 112) ----------
function cloneDoc(val) {
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof ObjectId) return new ObjectId(String(val));
  if (val instanceof Date) return new Date(val.getTime());
  if (Array.isArray(val)) return val.map(cloneDoc);
  const out = {};
  for (const [k, v] of Object.entries(val)) out[k] = cloneDoc(v);
  return out;
}

function matchFilter(doc, filter = {}) {
  for (const [k, cond] of Object.entries(filter)) {
    if (k === '$or') {
      if (!cond.some((sub) => matchFilter(doc, sub))) return false;
      continue;
    }
    const val = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
      if ('$in' in cond && !cond.$in.some((x) => String(x) === String(val))) return false;
      if ('$ne' in cond && String(val) === String(cond.$ne)) return false;
      if ('$gt' in cond && !(val > cond.$gt)) return false;
      if ('$gte' in cond && !(val >= cond.$gte)) return false;
      if ('$lt' in cond && !(val < cond.$lt)) return false;
      if ('$lte' in cond && !(val <= cond.$lte)) return false;
    } else if (cond instanceof ObjectId || val instanceof ObjectId) {
      if (String(val) !== String(cond)) return false;
    } else if (val !== cond) {
      return false;
    }
  }
  return true;
}

function createMockDb(seed = {}) {
  const store = new Map();
  for (const [name, docs] of Object.entries(seed)) {
    store.set(
      name,
      docs.map((d) => cloneDoc(d)),
    );
  }

  // Theo dõi khóa ghi (document-level write lock) giữa các Transaction đang mở giống WiredTiger
  const activeWriteLocks = new Map(); // key: `${col}:${_id}` -> sessionId
  let nextSessionId = 1;

  const getCol = (name) => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name);
  };

  const acquireDocLock = (colName, docId, session) => {
    if (!session) return;
    const key = `${colName}:${String(docId)}`;
    const holder = activeWriteLocks.get(key);
    if (holder && holder !== session.id) {
      const err = new Error('WriteConflict during transaction');
      err.code = 112;
      err.errorLabels = ['TransientTransactionError'];
      throw err;
    }
    activeWriteLocks.set(key, session.id);
    session.lockedKeys.add(key);
  };

  const db = {
    client: {
      startSession() {
        const session = {
          id: nextSessionId++,
          lockedKeys: new Set(),
          snapshot: null,
          async withTransaction(fn) {
            // Lưu snapshot của các document mà session này thực sự khóa & sửa để rollback cô lập khi abort
            session.origDocs = new Map();
            session.insertedDocs = [];
            try {
              await fn();
            } catch (err) {
              // Rollback đúng những thay đổi của riêng transaction này
              for (const { colName, id } of session.insertedDocs) {
                const col = getCol(colName);
                const idx = col.findIndex((d) => String(d._id) === String(id));
                if (idx !== -1) col.splice(idx, 1);
              }
              for (const [key, orig] of session.origDocs.entries()) {
                const [colName] = key.split(':');
                const col = getCol(colName);
                const idx = col.findIndex((d) => String(d._id) === String(orig._id));
                if (idx !== -1) col[idx] = cloneDoc(orig);
              }
              throw err;
            } finally {
              for (const k of session.lockedKeys) {
                if (activeWriteLocks.get(k) === session.id) activeWriteLocks.delete(k);
              }
              session.lockedKeys.clear();
            }
          },
          async endSession() {},
        };
        return session;
      },
    },
    collection(name) {
      return {
        find(filter = {}) {
          let results = getCol(name).filter((d) => matchFilter(d, filter));
          const cursor = {
            sort(spec) {
              const [[field, dir]] = Object.entries(spec);
              results = [...results].sort((a, b) => (a[field] < b[field] ? -dir : dir));
              return cursor;
            },
            async toArray() {
              return results.map((d) => cloneDoc(d));
            },
          };
          return cursor;
        },
        async findOne(filter = {}, opts = {}) {
          let list = getCol(name).filter((d) => matchFilter(d, filter));
          if (opts && opts.sort) {
            const [[field, dir]] = Object.entries(opts.sort);
            list.sort((a, b) => (a[field] < b[field] ? -dir : dir));
          }
          return list[0] ? cloneDoc(list[0]) : null;
        },
        async insertOne(doc, opts = {}) {
          const session = opts && opts.session;
          acquireDocLock(name, doc._id, session);
          if (session && session.insertedDocs) {
            session.insertedDocs.push({ colName: name, id: doc._id });
          }
          // Nhường event loop 1 nhịp để mô phỏng độ trễ I/O thực tế khi chạy song song Promise.all
          await new Promise((r) => setImmediate(r));
          getCol(name).push(cloneDoc(doc));
          return { insertedId: doc._id };
        },
        async insertMany(docs, opts = {}) {
          const session = opts && opts.session;
          for (const d of docs) {
            acquireDocLock(name, d._id, session);
            if (session && session.insertedDocs) {
              session.insertedDocs.push({ colName: name, id: d._id });
            }
            getCol(name).push(cloneDoc(d));
          }
          return { insertedCount: docs.length };
        },
        async updateOne(filter, update, opts = {}) {
          const session = opts && opts.session;
          const col = getCol(name);
          const idx = col.findIndex((d) => matchFilter(d, filter));
          if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
          const target = col[idx];
          acquireDocLock(name, target._id, session);
          const lockKey = `${name}:${String(target._id)}`;
          if (session && session.origDocs && !session.origDocs.has(lockKey)) {
            session.origDocs.set(lockKey, cloneDoc(target));
          }
          await new Promise((r) => setImmediate(r));
          // Kiểm tra lại filter sau khi nhường I/O
          if (!matchFilter(target, filter)) return { matchedCount: 0, modifiedCount: 0 };
          if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) {
              target[k] = Number(target[k] || 0) + v;
            }
          }
          if (update.$set) {
            Object.assign(target, cloneDoc(update.$set));
          }
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };
  return db;
}

// ---------- Dữ liệu mẫu chuẩn theo database/data ----------
const IDS = {
  zoneTapTrung: new ObjectId('0e0176a90c9ea9da481da85b'),
  spaceFocusPod: new ObjectId('c7185699b9a4ff8d7d94214d'),
  spaceWorkLounge: new ObjectId('ab6af5c9b01fa33f757de661'),
  pkgFpHalf: new ObjectId('ee70f0a3e502ddc3b760a715'), // FIXED 4h, PER_SPACE, 140k, 1 STANDARD_DRINK
  pkgWlFlex: new ObjectId('ac64f28f5bfd0e11f87bd5f2'), // HOURLY, PER_PERSON, 30k/h, WATER khi >= 2h
  incFpDrink: new ObjectId('789c8cb8ac3b2b88b0d32e5e'),
  incWlWater: new ObjectId('b5da13315a5ae87f5152e394'),
  prodMatcha: new ObjectId('6bf253898080b443d05ccd37'), // 55k (vượt định mức 50k -> phụ phí 5k)
  prodAmericano: new ObjectId('72e8fee2e96c48aa51f97b90'), // 40k (phụ phí 0đ)
  addonMonitor: new ObjectId('4937c361d6efe7b2437044c3'), // PER_BOOKING, 50k
  addonPrint: new ObjectId('b6c5a21170d23bde85fa4346'), // PER_ITEM, 20k
  voucherWelcome: new ObjectId('9ebd4b06b483e0bf0cd57715'), // PERCENT 10%, min 100k
  tierBasic: new ObjectId('ca68ee2efa756bc712052e05'),
  tierSilver: new ObjectId('725404ee13b6372c3e767bb2'),
  tierGold: new ObjectId('2a507cc925dab58fc21b02a7'),
  tierDiamond: new ObjectId('f30ccafea1385bb2264b022f'),
  user1: new ObjectId('450a77f9282618e177a8cd76'),
  user2: new ObjectId('e09f2905e3fd3b50719c28a6'),
  admin: new ObjectId('111111111111111111111111'),
};

function buildSeedDb() {
  return createMockDb({
    zones: [
      {
        _id: IDS.zoneTapTrung,
        zone_code: 'KEN_TAP_TRUNG',
        name: 'KÉN Tập Trung',
        is_bookable: true,
        is_active: true,
      },
    ],
    spaces: [
      {
        _id: IDS.spaceFocusPod,
        zone_id: IDS.zoneTapTrung,
        space_code: 'FP-01',
        name: 'Ô tập trung cá nhân (Focus Pod)',
        space_type: 'FOCUS_POD',
        booking_mode: 'EXCLUSIVE',
        capacity: 1,
        min_guests: 1,
        max_guests: 1,
        open_time: '08:00',
        close_time: '22:00',
        buffer_minutes: 15,
        status: 'ACTIVE',
        lock_version: 0,
      },
      {
        _id: IDS.spaceWorkLounge,
        zone_id: IDS.zoneTapTrung,
        space_code: 'WL-01',
        name: 'Khu làm việc chung (Work Lounge)',
        space_type: 'WORK_LOUNGE',
        booking_mode: 'SHARED',
        capacity: 20,
        min_guests: 1,
        max_guests: 20,
        open_time: '08:00',
        close_time: '22:00',
        buffer_minutes: 0,
        status: 'ACTIVE',
        lock_version: 0,
      },
    ],
    packages: [
      {
        _id: IDS.pkgFpHalf,
        zone_id: IDS.zoneTapTrung,
        package_code: 'PKG_FP_HALF',
        name: 'Tập trung nửa ngày (4 giờ)',
        package_type: 'FIXED',
        pricing_unit: 'PER_SPACE',
        duration_hours: 4,
        is_full_day: false,
        min_hours: 1,
        is_active: true,
      },
      {
        _id: IDS.pkgWlFlex,
        zone_id: IDS.zoneTapTrung,
        package_code: 'PKG_WL_FLEX',
        name: 'Gói Linh hoạt',
        package_type: 'HOURLY',
        pricing_unit: 'PER_PERSON',
        duration_hours: null,
        is_full_day: false,
        min_hours: 1,
        is_active: true,
      },
    ],
    package_prices: [
      { _id: new ObjectId(), package_id: IDS.pkgFpHalf, space_id: IDS.spaceFocusPod, price: 140000 },
      { _id: new ObjectId(), package_id: IDS.pkgWlFlex, space_id: IDS.spaceWorkLounge, price: 30000 },
    ],
    package_inclusions: [
      {
        _id: IDS.incFpDrink,
        package_id: IDS.pkgFpHalf,
        item_type: 'STANDARD_DRINK',
        product_id: null,
        label: 'Đồ uống Menu Tiêu chuẩn',
        quantity: 1,
        quantity_basis: 'PER_BOOKING',
        subsidy_limit: 50000,
        min_hours_required: 0,
        is_active: true,
      },
      {
        _id: IDS.incWlWater,
        package_id: IDS.pkgWlFlex,
        item_type: 'WATER',
        product_id: new ObjectId(),
        label: 'Nước suối',
        quantity: 1,
        quantity_basis: 'PER_GUEST',
        subsidy_limit: null,
        min_hours_required: 2,
        is_active: true,
      },
    ],
    products: [
      {
        _id: IDS.prodMatcha,
        name: 'Matcha Latte',
        category: 'DRINK',
        price: 55000,
        variants: [{ name: 'Lạnh, M (500 ml)', price: 55000 }],
        is_active: true,
      },
      {
        _id: IDS.prodAmericano,
        name: 'Americano',
        category: 'DRINK',
        price: 40000,
        variants: [{ name: 'Lạnh', price: 40000 }],
        is_active: true,
      },
    ],
    addons: [
      {
        _id: IDS.addonMonitor,
        name: 'Thuê màn hình rời 24 inch',
        unit: 'PER_BOOKING',
        price: 50000,
        variants: [],
        is_active: true,
      },
      {
        _id: IDS.addonPrint,
        name: 'In tài liệu dưới 20 trang A4',
        unit: 'PER_ITEM',
        price: 20000,
        variants: [],
        is_active: true,
      },
    ],
    vouchers: [
      {
        _id: IDS.voucherWelcome,
        code: 'WELCOME10',
        discount_type: 'PERCENT',
        discount_value: 10,
        min_order_value: 100000,
        valid_from: new Date('2026-01-01T00:00:00Z'),
        valid_to: new Date('2026-12-31T23:59:59Z'),
        usage_limit: 100,
        usage_count: 0,
        redeem_limit: 0,
        redeem_count: 0,
        coins_cost: 0,
        status: 'ACTIVE',
      },
    ],
    membership_tiers: [
      { _id: IDS.tierBasic, code: 'BASIC', min_points: 0, discount_rate: 0.0 },
      { _id: IDS.tierSilver, code: 'SILVER', min_points: 1000, discount_rate: 0.05 },
      { _id: IDS.tierGold, code: 'GOLD', min_points: 5000, discount_rate: 0.1 },
      { _id: IDS.tierDiamond, code: 'DIAMOND', min_points: 10000, discount_rate: 0.15 },
    ],
    users: [
      {
        _id: IDS.user1,
        full_name: 'Nguyễn Văn A',
        phone: '0901111111',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        tier_id: IDS.tierSilver,
        tier_points: 990,
        coin_balance: 50,
      },
      {
        _id: IDS.user2,
        full_name: 'Trần Thị B',
        phone: '0902222222',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        tier_id: IDS.tierBasic,
        tier_points: 0,
        coin_balance: 0,
      },
    ],
    bookings: [],
    booking_inclusions: [],
    booking_addons: [],
    payment_transactions: [],
    loyalty_transactions: [],
    user_vouchers: [],
  });
}

// ---------- 1. Kiểm thử quy trình chuẩn BR-D01 ----------
test('TC-BK-01 Quy trình chuẩn BR-D01: Khám phá & Kiểm tra chỗ trống -> Chọn Space & Package -> Chọn Inclusion & Add-on -> Checkout -> Payment -> Confirmation -> Check-in -> Sử dụng -> Check-out', async () => {
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
test('TC-BK-02 Hủy đơn CONFIRMED trước Cut-off Time, hoàn trả Voucher và đối soát hoàn tiền', async () => {
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

test('TC-BK-03 Cronjob thu hồi đơn PENDING_PAYMENT quá hạn 15 phút và giải phóng khung giờ', async () => {
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
test('TC-BK-04 TEST SONG SONG (EXCLUSIVE): Hai người đặt cùng một khung giờ thì chỉ một người thành công', async () => {
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

test('TC-BK-05 TEST SONG SONG (SHARED): Hai nhóm khách cùng đặt vượt sức chứa còn lại thì chỉ một nhóm thành công', async () => {
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
test('TC-BK-06 Kiểm tra khung giờ (FIXED, HOURLY, is_full_day) và bộ lọc searchAvailableSpaces / selectSpaceAndPackage', async () => {
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

test('TC-BK-07 Kiểm tra ngoại lệ báo giá (Inclusion, Add-on, Variant, Voucher Coins) và điều kiện Checkout', async () => {
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

  // Lỗi Add-on: số lượng <= 0, không tồn tại, PER_BOOKING > 1, sai variant
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
  await assert.rejects(
    () =>
      buildBookingQuote(db, {
        spaceId: IDS.spaceFocusPod,
        packageId: IDS.pkgFpHalf,
        startAt,
        guestCount: 1,
        addons: [{ addonId: IDS.addonMonitor, quantity: 2 }],
      }),
    { code: 'ADDON_PER_BOOKING_LIMIT' },
  );
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

test('TC-BK-08 Kiểm tra các nhánh vận hành: Đơn 0đ, No-show, lỗi phân quyền & đổi lịch gói Cả ngày', async () => {
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

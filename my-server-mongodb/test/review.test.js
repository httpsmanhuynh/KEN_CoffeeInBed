'use strict';
// Kiểm thử đơn vị & tích hợp cho Module 10: Quản lý Đánh giá (Review Management — UC-16, BR-H01, BR-F03, BR-D06, FR-4.3, NFR-02).
// Bao phủ:
// 1. Kiểm tra điều kiện đơn chính chủ và đã CHECKED_OUT.
// 2. Chặn đánh giá trùng (tối đa 01 đánh giá/Booking — cả tuần tự lẫn đồng thời Race Condition EX-5.6).
// 3. Tạo và Xem đánh giá (theo Booking, theo Space kèm điểm trung bình & phân bố sao, theo User).
// 4. Hiển thị lời nhắc đánh giá (review_reminder / reviewReminder) trong lịch sử đặt chỗ (Booking History).
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  validateReviewInput,
  evaluateReviewEligibility,
  enrichBookingWithReview,
  summarizeReviews,
} = require('../src/domain/review');
const {
  attachReviewsToBookings,
  getBookingReviewStatus,
  createReview,
  listMyReviewsAndReminders,
  listSpaceReviews,
  listReviews,
} = require('../src/services/reviewService');

// ---------- In-Memory MongoDB Mock hỗ trợ Transaction & WriteConflict (code 112) ----------
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
  const activeWriteLocks = new Map();
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
      throw err;
    }
    activeWriteLocks.set(key, session.id);
    session.lockedKeys.add(key);
  };

  return {
    client: {
      startSession() {
        const session = {
          id: nextSessionId++,
          lockedKeys: new Set(),
          async withTransaction(fn) {
            session.origDocs = new Map();
            session.insertedDocs = [];
            try {
              await fn();
            } catch (err) {
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
        async findOne(filter = {}) {
          const found = getCol(name).find((d) => matchFilter(d, filter));
          return found ? cloneDoc(found) : null;
        },
        async insertOne(doc, opts = {}) {
          const session = opts && opts.session;
          acquireDocLock(name, doc._id, session);
          if (name === 'reviews') {
            const dup = getCol('reviews').find((r) => String(r.booking_id) === String(doc.booking_id));
            if (dup) {
              const e = new Error('E11000 duplicate key error collection: reviews index: uq_reviews_booking');
              e.code = 11000;
              throw e;
            }
          }
          if (session && session.insertedDocs) {
            session.insertedDocs.push({ colName: name, id: doc._id });
          }
          await new Promise((r) => setImmediate(r));
          getCol(name).push(cloneDoc(doc));
          return { insertedId: doc._id };
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
          if (!matchFilter(target, filter)) return { matchedCount: 0, modifiedCount: 0 };
          if (update.$set) Object.assign(target, cloneDoc(update.$set));
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };
}

const IDS = {
  user1: new ObjectId('450a77f9282618e177a8cd76'),
  user2: new ObjectId('e09f2905e3fd3b50719c28a6'),
  admin: new ObjectId('111111111111111111111111'),
  spaceFocusPod: new ObjectId('c7185699b9a4ff8d7d94214d'),
  spaceWorkLounge: new ObjectId('ab6af5c9b01fa33f757de661'),
  bookingCheckedOut1: new ObjectId('aaaa00000000000000000001'),
  bookingCheckedOut2: new ObjectId('aaaa00000000000000000002'),
  bookingConfirmed: new ObjectId('aaaa00000000000000000003'),
  bookingPending: new ObjectId('aaaa00000000000000000004'),
  bookingCancelled: new ObjectId('aaaa00000000000000000005'),
};

function buildReviewTestDb() {
  return createMockDb({
    users: [
      { _id: IDS.user1, full_name: 'Nguyễn Văn A', phone: '0901234567', role: 'CUSTOMER', status: 'ACTIVE' },
      { _id: IDS.user2, full_name: 'Trần Thị B', phone: '0909999999', role: 'CUSTOMER', status: 'ACTIVE' },
      { _id: IDS.admin, full_name: 'Quản trị KÉN', phone: '0900000000', role: 'ADMIN', status: 'ACTIVE' },
    ],
    spaces: [
      { _id: IDS.spaceFocusPod, space_code: 'FP-01', name: 'Ô tập trung cá nhân (Focus Pod)', status: 'ACTIVE' },
      { _id: IDS.spaceWorkLounge, space_code: 'WL-01', name: 'Bàn dài (Work Lounge)', status: 'ACTIVE' },
    ],
    bookings: [
      {
        _id: IDS.bookingCheckedOut1,
        booking_code: 'BK260520A1',
        user_id: IDS.user1,
        space_id: IDS.spaceFocusPod,
        space_name: 'Ô tập trung cá nhân (Focus Pod)',
        package_name: 'Gói Nửa Ngày (4 giờ)',
        zone_name: 'KÉN Tập Trung',
        status: 'CHECKED_OUT',
        start_at: new Date('2026-05-20T01:00:00Z'),
        end_at: new Date('2026-05-20T05:00:00Z'),
        checked_out_at: new Date('2026-05-20T05:00:00Z'),
        created_at: new Date('2026-05-19T10:00:00Z'),
        updated_at: new Date('2026-05-20T05:00:00Z'),
      },
      {
        _id: IDS.bookingCheckedOut2,
        booking_code: 'BK260521B2',
        user_id: IDS.user2,
        space_id: IDS.spaceFocusPod,
        space_name: 'Ô tập trung cá nhân (Focus Pod)',
        package_name: 'Gói Theo Giờ',
        zone_name: 'KÉN Tập Trung',
        status: 'CHECKED_OUT',
        start_at: new Date('2026-05-21T01:00:00Z'),
        end_at: new Date('2026-05-21T03:00:00Z'),
        checked_out_at: new Date('2026-05-21T03:00:00Z'),
        created_at: new Date('2026-05-20T12:00:00Z'),
        updated_at: new Date('2026-05-21T03:00:00Z'),
      },
      {
        _id: IDS.bookingConfirmed,
        booking_code: 'BK260522C3',
        user_id: IDS.user1,
        space_id: IDS.spaceFocusPod,
        space_name: 'Ô tập trung cá nhân (Focus Pod)',
        package_name: 'Gói Nửa Ngày (4 giờ)',
        zone_name: 'KÉN Tập Trung',
        status: 'CONFIRMED',
        start_at: new Date('2026-05-22T01:00:00Z'),
        end_at: new Date('2026-05-22T05:00:00Z'),
        checked_out_at: null,
        created_at: new Date('2026-05-21T10:00:00Z'),
        updated_at: new Date('2026-05-21T10:05:00Z'),
      },
      {
        _id: IDS.bookingPending,
        booking_code: 'BK260523D4',
        user_id: IDS.user1,
        space_id: IDS.spaceWorkLounge,
        space_name: 'Bàn dài (Work Lounge)',
        package_name: 'Gói Linh Hoạt',
        zone_name: 'KÉN Tập Trung',
        status: 'PENDING_PAYMENT',
        start_at: new Date('2026-05-23T01:00:00Z'),
        end_at: new Date('2026-05-23T03:00:00Z'),
        checked_out_at: null,
        created_at: new Date('2026-05-22T10:00:00Z'),
        updated_at: new Date('2026-05-22T10:00:00Z'),
      },
      {
        _id: IDS.bookingCancelled,
        booking_code: 'BK260524E5',
        user_id: IDS.user1,
        space_id: IDS.spaceWorkLounge,
        space_name: 'Bàn dài (Work Lounge)',
        package_name: 'Gói Linh Hoạt',
        zone_name: 'KÉN Tập Trung',
        status: 'CANCELLED',
        start_at: new Date('2026-05-24T01:00:00Z'),
        end_at: new Date('2026-05-24T03:00:00Z'),
        checked_out_at: null,
        created_at: new Date('2026-05-23T10:00:00Z'),
        updated_at: new Date('2026-05-23T11:00:00Z'),
      },
    ],
    reviews: [],
  });
}

test('TC-REV-01 Domain: validateReviewInput, evaluateReviewEligibility, enrichBookingWithReview & summarizeReviews', () => {
  // 1. validateReviewInput
  assert.equal(validateReviewInput({ rating: 5, comment: '  Không gian rất yên tĩnh  ' }).ok, true);
  assert.equal(validateReviewInput({ rating: 5, comment: '  Không gian rất yên tĩnh  ' }).comment, 'Không gian rất yên tĩnh');
  assert.equal(validateReviewInput({ rating: 4, comment: '   ' }).comment, null);
  assert.equal(validateReviewInput({ rating: 3 }).comment, null);

  assert.equal(validateReviewInput({ rating: 0 }).code, 'INVALID_RATING');
  assert.equal(validateReviewInput({ rating: 6 }).code, 'INVALID_RATING');
  assert.equal(validateReviewInput({ rating: 4.5 }).code, 'INVALID_RATING');
  assert.equal(validateReviewInput({ rating: null }).code, 'INVALID_RATING');
  assert.equal(validateReviewInput({ rating: true }).code, 'INVALID_RATING');
  assert.equal(validateReviewInput({ rating: 5, comment: 12345 }).code, 'INVALID_COMMENT');
  assert.equal(validateReviewInput({ rating: 5, comment: 'a'.repeat(501) }).code, 'COMMENT_TOO_LONG');

  // 2. evaluateReviewEligibility
  assert.equal(evaluateReviewEligibility({ booking: null, userId: IDS.user1 }).code, 'BOOKING_NOT_FOUND');
  assert.equal(
    evaluateReviewEligibility({
      booking: { _id: IDS.bookingCheckedOut1, user_id: IDS.user1, status: 'CHECKED_OUT' },
      userId: IDS.user2,
    }).code,
    'FORBIDDEN',
  );
  assert.equal(
    evaluateReviewEligibility({
      booking: { _id: IDS.bookingConfirmed, user_id: IDS.user1, status: 'CONFIRMED' },
      userId: IDS.user1,
    }).code,
    'BOOKING_NOT_CHECKED_OUT',
  );
  assert.equal(
    evaluateReviewEligibility({
      booking: { _id: IDS.bookingCheckedOut1, user_id: IDS.user1, status: 'CHECKED_OUT' },
      userId: IDS.user1,
      existingReview: { _id: new ObjectId(), rating: 5 },
    }).code,
    'REVIEW_ALREADY_EXISTS',
  );
  const okElig = evaluateReviewEligibility({
    booking: { _id: IDS.bookingCheckedOut1, user_id: IDS.user1, status: 'CHECKED_OUT' },
    userId: IDS.user1,
  });
  assert.equal(okElig.canReview, true);
  assert.equal(okElig.reviewReminder, true);

  // 3. enrichBookingWithReview & summarizeReviews
  const bEnriched = enrichBookingWithReview({ _id: IDS.bookingCheckedOut1, status: 'CHECKED_OUT' }, null);
  assert.equal(bEnriched.can_review, true);
  assert.equal(bEnriched.review_reminder, true);

  const summary = summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 5 }, { rating: 0 }]);
  assert.equal(summary.totalReviews, 4);
  assert.equal(summary.ratingDistribution[5], 2);
  assert.equal(summary.ratingDistribution[4], 1);
});

test('TC-REV-02 Kiểm tra điều kiện đơn chính chủ & đã CHECKED_OUT: Chặn đơn người khác và đơn chưa CHECKED_OUT', async () => {
  const db = buildReviewTestDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);

  // Chưa đăng nhập hoặc user bị khóa
  await assert.rejects(
    () => createReview(db, { user: null, bookingId: IDS.bookingCheckedOut1, rating: 5 }),
    { status: 401, code: 'UNAUTHENTICATED' },
  );

  // Booking ID không hợp lệ hoặc không tồn tại
  await assert.rejects(
    () => createReview(db, { user: user1, bookingId: 'bad-id', rating: 5 }),
    { status: 400, code: 'INVALID_BOOKING_ID' },
  );
  await assert.rejects(
    () => createReview(db, { user: user1, bookingId: new ObjectId(), rating: 5 }),
    { status: 404, code: 'BOOKING_NOT_FOUND' },
  );

  // User2 cố tình đánh giá đơn CHECKED_OUT của User1 -> 403 FORBIDDEN (kiểm tra chính chủ BR-D06)
  await assert.rejects(
    () =>
      createReview(db, {
        user: user2,
        bookingId: IDS.bookingCheckedOut1,
        rating: 5,
        comment: 'Đánh giá hộ',
      }),
    { status: 403, code: 'FORBIDDEN' },
  );

  // User1 đánh giá đơn của chính mình nhưng đang ở trạng thái CONFIRMED / PENDING_PAYMENT / CANCELLED -> 422 BOOKING_NOT_CHECKED_OUT
  for (const bId of [IDS.bookingConfirmed, IDS.bookingPending, IDS.bookingCancelled]) {
    await assert.rejects(
      () => createReview(db, { user: user1, bookingId: bId, rating: 4 }),
      { status: 422, code: 'BOOKING_NOT_CHECKED_OUT' },
    );
  }

  // Dữ liệu rating sai
  await assert.rejects(
    () => createReview(db, { user: user1, bookingId: IDS.bookingCheckedOut1, rating: 10 }),
    { status: 422, code: 'INVALID_RATING' },
  );
});

test('TC-REV-03 Lời nhắc đánh giá trong lịch sử đặt chỗ, Tạo đánh giá & Chặn đánh giá trùng (tuần tự + đồng thời)', async () => {
  const db = buildReviewTestDb();
  const [user1, user2, admin] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
    db.collection('users').findOne({ _id: IDS.admin }),
  ]);

  // 1. Trước khi đánh giá: Lịch sử đặt chỗ của user1 hiển thị lời nhắc đánh giá cho đơn CHECKED_OUT
  const rawBookingsBefore = await db.collection('bookings').find({ user_id: user1._id }).toArray();
  const historyBefore = await attachReviewsToBookings(db, rawBookingsBefore);
  const checkedOutItemBefore = historyBefore.find(
    (b) => String(b._id) === String(IDS.bookingCheckedOut1),
  );
  const confirmedItemBefore = historyBefore.find(
    (b) => String(b._id) === String(IDS.bookingConfirmed),
  );

  assert.equal(checkedOutItemBefore.has_review, false);
  assert.equal(checkedOutItemBefore.can_review, true);
  assert.equal(checkedOutItemBefore.review_reminder, true);
  assert.equal(checkedOutItemBefore.reviewReminder, true);
  // Đơn CONFIRMED không hiển thị lời nhắc đánh giá
  assert.equal(confirmedItemBefore.can_review, false);
  assert.equal(confirmedItemBefore.review_reminder, false);

  // Kiểm tra trạng thái đánh giá của đơn trước khi gửi
  const statusBefore = await getBookingReviewStatus(db, {
    user: user1,
    bookingId: IDS.bookingCheckedOut1,
  });
  assert.equal(statusBefore.canReview, true);
  assert.equal(statusBefore.reviewReminder, true);
  assert.equal(statusBefore.hasReview, false);

  // 2. Tạo đánh giá hợp lệ (kiểm tra cả điều kiện created_at >= checked_out_at và đúng 6 trường validator)
  const review1 = await createReview(db, {
    user: user1,
    bookingId: IDS.bookingCheckedOut1,
    rating: 5,
    comment: 'Focus Pod cách âm tuyệt vời, Matcha ngon!',
    now: new Date('2026-05-20T04:00:00Z'), // truyền now sớm hơn checked_out_at để kiểm tra tự động kẹp >= checked_out_at
  });

  assert.deepEqual(Object.keys(review1).sort(), [
    '_id',
    'booking_id',
    'comment',
    'created_at',
    'rating',
    'user_id',
  ]);
  assert.equal(review1.rating, 5);
  assert.equal(review1.comment, 'Focus Pod cách âm tuyệt vời, Matcha ngon!');
  assert.equal(review1.created_at.getTime(), new Date('2026-05-20T05:00:00Z').getTime());

  // 3. Sau khi đánh giá: Lịch sử đặt chỗ tự động ẩn lời nhắc đánh giá (review_reminder = false) và đính kèm review
  const historyAfter = await attachReviewsToBookings(db, rawBookingsBefore);
  const checkedOutItemAfter = historyAfter.find(
    (b) => String(b._id) === String(IDS.bookingCheckedOut1),
  );
  assert.equal(checkedOutItemAfter.has_review, true);
  assert.equal(checkedOutItemAfter.can_review, false);
  assert.equal(checkedOutItemAfter.review_reminder, false);
  assert.equal(checkedOutItemAfter.review.rating, 5);

  // 4. Chặn đánh giá trùng lần 2 (tuần tự) -> 409 REVIEW_ALREADY_EXISTS kèm đánh giá đã gửi (chế độ chỉ xem AF2)
  await assert.rejects(
    async () => {
      try {
        await createReview(db, {
          user: user1,
          bookingId: IDS.bookingCheckedOut1,
          rating: 1,
          comment: 'Đánh giá lại lần 2',
        });
      } catch (err) {
        assert.equal(err.status, 409);
        assert.equal(err.code, 'REVIEW_ALREADY_EXISTS');
        assert.equal(err.details.review.rating, 5);
        throw err;
      }
    },
    { code: 'REVIEW_ALREADY_EXISTS' },
  );

  // 5. Chặn đánh giá trùng khi gửi ĐỒNG THỜI 2 request (Race Condition EX-5.6 trên bookingCheckedOut2 của user2)
  const concurrentResults = await Promise.allSettled([
    createReview(db, {
      user: user2,
      bookingId: IDS.bookingCheckedOut2,
      rating: 4,
      comment: 'Request đồng thời 1',
      now: new Date('2026-05-21T04:00:00Z'),
    }),
    createReview(db, {
      user: user2,
      bookingId: IDS.bookingCheckedOut2,
      rating: 3,
      comment: 'Request đồng thời 2',
      now: new Date('2026-05-21T04:00:00Z'),
    }),
  ]);
  const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
  const rejected = concurrentResults.filter((r) => r.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, 'REVIEW_ALREADY_EXISTS');

  // 6. Xem đánh giá theo Space, theo User và danh sách lọc
  const spaceReviews = await listSpaceReviews(db, { spaceId: 'FP-01' });
  assert.equal(spaceReviews.totalReviews, 2);
  assert.equal(spaceReviews.averageRating, 4.5);
  assert.equal(spaceReviews.ratingDistribution[5], 1);
  assert.equal(spaceReviews.ratingDistribution[4], 1);

  const emptySpaceReviews = await listSpaceReviews(db, { spaceId: IDS.spaceWorkLounge });
  assert.equal(emptySpaceReviews.totalReviews, 0);
  assert.equal(emptySpaceReviews.averageRating, 0);

  const myReviews = await listMyReviewsAndReminders(db, { user: user1 });
  assert.equal(myReviews.reviews.length, 1);
  assert.equal(myReviews.reminderCount, 0);

  const adminStatusView = await getBookingReviewStatus(db, {
    user: admin,
    bookingId: IDS.bookingCheckedOut1,
  });
  assert.equal(adminStatusView.hasReview, true);
  assert.equal(adminStatusView.canReview, false);

  const filtered = await listReviews(db, {
    spaceId: IDS.spaceFocusPod,
    userId: IDS.user1,
    bookingId: IDS.bookingCheckedOut1,
    rating: 5,
  });
  assert.equal(filtered.totalReviews, 1);

  await assert.rejects(
    () => listReviews(db, { rating: 9 }),
    { status: 422, code: 'INVALID_RATING' },
  );
  await assert.rejects(
    () => listSpaceReviews(db, { spaceId: '' }),
    { status: 400, code: 'INVALID_SPACE_ID' },
  );
  await assert.rejects(
    () => listSpaceReviews(db, { spaceId: 'UNKNOWN_SPACE' }),
    { status: 404, code: 'SPACE_NOT_FOUND' },
  );
});

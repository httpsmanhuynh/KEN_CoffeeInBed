'use strict';
// Kiểm thử đơn vị & tích hợp cốt lõi cho Module 10: Quản lý Đánh giá (Review Management).
// Mã TC đồng bộ với Test_Module10_Review_Management.xlsx và Postman Collection Module 10.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const {
  validateReviewInput,
  evaluateReviewEligibility,
  enrichBookingWithReview,
  summarizeReviews,
} = require('../../src/domain/review');
const {
  attachReviewsToBookings,
  getBookingReviewStatus,
  createReview,
  listMyReviewsAndReminders,
  listSpaceReviews,
  listReviews,
} = require('../../src/services/reviewService');

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

test('TC-REV-01\tAUTO-REV-01: Tạo đánh giá hợp lệ cho đơn CHECKED_OUT của chính mình & kiểm tra biên rating/comment (REV-B01; REV-B02; REV-B03; REV-B04)', async () => {
  assert.equal(validateReviewInput({ rating: 1, comment: '  Không gian rất yên tĩnh  ' }).ok, true);
  assert.equal(validateReviewInput({ rating: 5, comment: '   ' }).comment, null);
  for (const bad of [0, 6, -1, 4.5, 'abc', null, true]) {
    assert.equal(validateReviewInput({ rating: bad }).code, 'INVALID_RATING');
  }
  assert.equal(validateReviewInput({ rating: 5, comment: 12345 }).code, 'INVALID_COMMENT');
  assert.equal(validateReviewInput({ rating: 5, comment: 'a'.repeat(501) }).code, 'COMMENT_TOO_LONG');

  const db = buildReviewTestDb();
  const user1 = await db.collection('users').findOne({ _id: IDS.user1 });
  const review = await createReview(db, {
    user: user1,
    bookingId: IDS.bookingCheckedOut1,
    rating: 5,
    comment: 'Không gian rất ổn',
    now: new Date('2026-05-20T04:00:00Z'),
  });
  assert.deepEqual(Object.keys(review).sort(), [
    '_id',
    'booking_id',
    'comment',
    'created_at',
    'rating',
    'user_id',
  ]);
  assert.equal(review.rating, 5);
});

test('TC-REV-06\tAUTO-REV-06: Chặn đánh giá đơn chưa CHECKED_OUT, đơn người khác (không chính chủ) và chưa đăng nhập (REV-B06; REV-B07; REV-B08; REV-B09)', async () => {
  const db = buildReviewTestDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);

  await assert.rejects(
    () => createReview(db, { user: null, bookingId: IDS.bookingCheckedOut1, rating: 5 }),
    { status: 401, code: 'UNAUTHENTICATED' },
  );
  await assert.rejects(
    () => createReview(db, { user: user1, bookingId: 'bad-id', rating: 5 }),
    { status: 400, code: 'INVALID_BOOKING_ID' },
  );
  await assert.rejects(
    () => createReview(db, { user: user1, bookingId: new ObjectId(), rating: 5 }),
    { status: 404, code: 'BOOKING_NOT_FOUND' },
  );
  await assert.rejects(
    () => createReview(db, { user: user2, bookingId: IDS.bookingCheckedOut1, rating: 5 }),
    { status: 403, code: 'FORBIDDEN' },
  );
  for (const bId of [IDS.bookingConfirmed, IDS.bookingPending, IDS.bookingCancelled]) {
    await assert.rejects(
      () => createReview(db, { user: user1, bookingId: bId, rating: 4 }),
      { status: 422, code: 'BOOKING_NOT_CHECKED_OUT' },
    );
  }
});

test('TC-REV-10\tAUTO-REV-10: Chặn đánh giá trùng lần 2 (tuần tự) & gửi 2 đánh giá đồng thời (Race Condition) (REV-B10; REV-B11)', async () => {
  const db = buildReviewTestDb();
  const [user1, user2] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.user2 }),
  ]);

  await createReview(db, { user: user1, bookingId: IDS.bookingCheckedOut1, rating: 5, comment: 'Lần 1' });
  await assert.rejects(
    () => createReview(db, { user: user1, bookingId: IDS.bookingCheckedOut1, rating: 1, comment: 'Lần 2' }),
    { status: 409, code: 'REVIEW_ALREADY_EXISTS' },
  );

  const concurrentResults = await Promise.allSettled([
    createReview(db, { user: user2, bookingId: IDS.bookingCheckedOut2, rating: 4, comment: 'Đồng thời 1' }),
    createReview(db, { user: user2, bookingId: IDS.bookingCheckedOut2, rating: 3, comment: 'Đồng thời 2' }),
  ]);
  assert.equal(concurrentResults.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(concurrentResults.filter((r) => r.status === 'rejected').length, 1);
});

test('TC-REV-15\tAUTO-REV-15: Lời nhắc đánh giá (review_reminder), chế độ chỉ xem sau khi gửi & lọc theo Không gian (REV-B13; REV-B15; REV-B16; REV-B18)', async () => {
  const db = buildReviewTestDb();
  const [user1, admin] = await Promise.all([
    db.collection('users').findOne({ _id: IDS.user1 }),
    db.collection('users').findOne({ _id: IDS.admin }),
  ]);

  const rawBookings = await db.collection('bookings').find({ user_id: user1._id }).toArray();
  const before = await attachReviewsToBookings(db, rawBookings);
  const coBefore = before.find((b) => String(b._id) === String(IDS.bookingCheckedOut1));
  assert.equal(coBefore.review_reminder, true);
  assert.equal(coBefore.can_review, true);

  await createReview(db, { user: user1, bookingId: IDS.bookingCheckedOut1, rating: 5, comment: 'Rất tốt' });

  const after = await attachReviewsToBookings(db, rawBookings);
  const coAfter = after.find((b) => String(b._id) === String(IDS.bookingCheckedOut1));
  assert.equal(coAfter.review_reminder, false);
  assert.equal(coAfter.has_review, true);

  const statusView = await getBookingReviewStatus(db, { user: user1, bookingId: IDS.bookingCheckedOut1 });
  assert.equal(statusView.hasReview, true);
  assert.equal(statusView.canReview, false);
  assert.equal(statusView.reviewReminder, false);

  const adminView = await getBookingReviewStatus(db, { user: admin, bookingId: IDS.bookingCheckedOut1 });
  assert.equal(adminView.hasReview, true);

  const spaceReviews = await listSpaceReviews(db, { spaceId: 'FP-01' });
  assert.equal(spaceReviews.totalReviews, 1);
  assert.equal(spaceReviews.averageRating, 5);
  const myReviews = await listMyReviewsAndReminders(db, { user: user1 });
  assert.equal(myReviews.reviews.length, 1);
  assert.equal(myReviews.reminderCount, 0);
  const filtered = await listReviews(db, { spaceId: IDS.spaceFocusPod, rating: 5 });
  assert.equal(filtered.totalReviews, 1);
});

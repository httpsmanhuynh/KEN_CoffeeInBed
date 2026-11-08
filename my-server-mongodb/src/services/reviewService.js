'use strict';
// Dịch vụ Quản lý Đánh giá (Review Management — UC-16, BR-H01, BR-F03, BR-D06, FR-4.3, NFR-02).
// - Kiểm tra điều kiện đơn chính chủ và đã CHECKED_OUT (kiểm tra lại trong Transaction lưu).
// - Chặn đánh giá trùng: tối đa 01 đánh giá / Booking (khóa ghi trên Booking trong Transaction + unique index uq_reviews_booking).
// - Tạo và Xem đánh giá (theo Booking, theo Space, theo User).
// - Hiển thị lời nhắc đánh giá (review_reminder / reviewReminder) trong lịch sử đặt chỗ cho đơn CHECKED_OUT chưa có đánh giá.
const { ObjectId } = require('mongodb');
const { BookingError } = require('./bookingService');
const { isDup } = require('../utils/http');
const {
  validateReviewInput,
  evaluateReviewEligibility,
  enrichBookingWithReview,
  summarizeReviews,
} = require('../domain/review');

const toOid = (id, errCode = 'INVALID_ID', errMsg = 'ID không hợp lệ') => {
  if (id instanceof ObjectId) return id;
  const s = typeof id === 'string' ? id.trim() : '';
  if (!ObjectId.isValid(s) || s.length !== 24) throw new BookingError(400, errCode, errMsg);
  return new ObjectId(s);
};

async function runReviewTransaction(db, fn) {
  if (!db.client || typeof db.client.startSession !== 'function') {
    return fn(null);
  }
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = db.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      if (err && err.code === 112 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 5));
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

/**
 * Gắn thông tin đánh giá và cờ nhắc đánh giá (review_reminder / can_review / has_review / review)
 * vào danh sách đơn đặt chỗ (Booking History — UC-11, UC-16, FR-4.3).
 */
async function attachReviewsToBookings(db, bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) return [];
  const bookingIds = bookings.map((b) => b._id);
  const reviews = await db
    .collection('reviews')
    .find({ booking_id: { $in: bookingIds } })
    .toArray();
  const reviewByBookingId = new Map(reviews.map((r) => [String(r.booking_id), r]));
  return bookings.map((b) => enrichBookingWithReview(b, reviewByBookingId.get(String(b._id)) || null));
}

/**
 * Kiểm tra điều kiện đánh giá & xem đánh giá của 01 Booking (UC-16 bước 2–4, AF1, AF2, EX-5.1..5.3).
 */
async function getBookingReviewStatus(db, { user, bookingId }) {
  if (!user || user.status !== 'ACTIVE') {
    throw new BookingError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để kiểm tra đánh giá');
  }
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) {
    throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
  }

  const isAdmin = user.role === 'ADMIN';
  if (!isAdmin && String(booking.user_id) !== String(user._id)) {
    throw new BookingError(403, 'FORBIDDEN', 'Chỉ chủ đơn mới được xem trạng thái đánh giá của đơn này');
  }

  const existingReview = await db.collection('reviews').findOne({ booking_id: bOid });
  const elig = evaluateReviewEligibility({
    booking,
    userId: isAdmin ? booking.user_id : user._id,
    existingReview,
  });

  return {
    bookingId: String(booking._id),
    bookingCode: booking.booking_code,
    spaceId: String(booking.space_id),
    spaceName: booking.space_name,
    packageName: booking.package_name,
    status: booking.status,
    checkedOutAt: booking.checked_out_at || null,
    canReview: isAdmin ? false : elig.canReview,
    hasReview: elig.hasReview,
    reviewReminder: isAdmin ? false : elig.reviewReminder,
    code: elig.code,
    message: elig.message,
    review: existingReview || null,
  };
}

/**
 * Tạo đánh giá mới cho một Booking đã CHECKED_OUT của chính chủ (UC-16, BR-H01, BR-F03, BR-D06, FR-4.3, NFR-02).
 * Tuân thủ chặt chẽ database/schemas/reviews.validator.json (additionalProperties: false).
 */
async function createReview(db, { user, bookingId, rating, comment = null, now = new Date() }) {
  if (!user || user.status !== 'ACTIVE') {
    throw new BookingError(401, 'UNAUTHENTICATED', 'Tài khoản không hợp lệ hoặc đã bị khóa');
  }
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');

  const inputCheck = validateReviewInput({ rating, comment });
  if (!inputCheck.ok) {
    throw new BookingError(inputCheck.status, inputCheck.code, inputCheck.message);
  }

  try {
    return await runReviewTransaction(db, async (session) => {
      const opts = session ? { session } : {};

      // 1. Đọc lại Booking trong Transaction để kiểm tra quyền sở hữu và trạng thái CHECKED_OUT (NFR-02)
      const booking = await db.collection('bookings').findOne({ _id: bOid }, opts);
      const existingBeforeLock = booking
        ? await db.collection('reviews').findOne({ booking_id: bOid }, opts)
        : null;

      const elig = evaluateReviewEligibility({
        booking,
        userId: user._id,
        existingReview: existingBeforeLock,
      });
      if (!elig.canReview) {
        throw new BookingError(
          elig.status,
          elig.code,
          elig.message,
          elig.review ? { review: elig.review } : undefined,
        );
      }

      // 2. Lấy khóa ghi trên document Booking trong Transaction để tuần tự hóa 2 request gửi trùng đồng thời (EX-5.6)
      const lockRes = await db.collection('bookings').updateOne(
        { _id: bOid, user_id: user._id, status: 'CHECKED_OUT' },
        { $set: { updated_at: booking.updated_at || now } },
        opts,
      );
      if (lockRes.matchedCount === 0) {
        throw new BookingError(
          422,
          'BOOKING_NOT_CHECKED_OUT',
          'Chỉ được đánh giá sau khi đã hoàn tất sử dụng dịch vụ (CHECKED_OUT)',
        );
      }

      // 3. Kiểm tra lại lần nữa sau khi đã giữ khóa ghi trên Booking
      const existingAfterLock = await db.collection('reviews').findOne({ booking_id: bOid }, opts);
      if (existingAfterLock) {
        throw new BookingError(
          409,
          'REVIEW_ALREADY_EXISTS',
          'Đơn đặt chỗ này đã có đánh giá (tối đa 01 đánh giá/Booking)',
          { review: existingAfterLock },
        );
      }

      // Đảm bảo created_at >= booking.checked_out_at (ràng buộc toàn vẹn Chương 6 / verify_ch6.py)
      const checkedOutMs = booking.checked_out_at ? new Date(booking.checked_out_at).getTime() : 0;
      const createdAt =
        checkedOutMs && now.getTime() < checkedOutMs ? new Date(checkedOutMs) : new Date(now.getTime());

      // 4. Chỉ ghi đúng 6 trường trong database/schemas/reviews.validator.json (additionalProperties: false)
      const reviewDoc = {
        _id: new ObjectId(),
        booking_id: booking._id,
        user_id: user._id,
        rating: inputCheck.rating,
        comment: inputCheck.comment,
        created_at: createdAt,
      };

      await db.collection('reviews').insertOne(reviewDoc, opts);
      return reviewDoc;
    });
  } catch (err) {
    if (isDup(err)) {
      const existing = await db.collection('reviews').findOne({ booking_id: bOid });
      throw new BookingError(
        409,
        'REVIEW_ALREADY_EXISTS',
        'Đơn đặt chỗ này đã có đánh giá (tối đa 01 đánh giá/Booking)',
        existing ? { review: existing } : undefined,
      );
    }
    throw err;
  }
}

/**
 * Lấy danh sách đánh giá đã gửi của khách hàng hiện tại kèm danh sách lời nhắc đánh giá
 * cho các đơn CHECKED_OUT chưa có đánh giá (UC-16, FR-4.3).
 */
async function listMyReviewsAndReminders(db, { user }) {
  if (!user || user.status !== 'ACTIVE') {
    throw new BookingError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập');
  }
  const [myReviews, checkedOutBookings] = await Promise.all([
    db.collection('reviews').find({ user_id: user._id }).sort({ created_at: -1 }).toArray(),
    db
      .collection('bookings')
      .find({ user_id: user._id, status: 'CHECKED_OUT' })
      .sort({ checked_out_at: -1 })
      .toArray(),
  ]);

  const bookingMap = new Map(checkedOutBookings.map((b) => [String(b._id), b]));
  const reviewedBookingIds = new Set(myReviews.map((r) => String(r.booking_id)));

  const enrichedReviews = myReviews.map((r) => {
    const bk = bookingMap.get(String(r.booking_id)) || null;
    return {
      ...r,
      booking_code: bk ? bk.booking_code : null,
      space_id: bk ? bk.space_id : null,
      space_name: bk ? bk.space_name : null,
      package_name: bk ? bk.package_name : null,
    };
  });

  const pendingReminders = checkedOutBookings
    .filter((b) => !reviewedBookingIds.has(String(b._id)))
    .map((b) => ({
      booking_id: b._id,
      bookingId: String(b._id),
      booking_code: b.booking_code,
      space_id: b.space_id,
      space_name: b.space_name,
      package_name: b.package_name,
      zone_name: b.zone_name,
      start_at: b.start_at,
      end_at: b.end_at,
      checked_out_at: b.checked_out_at,
      can_review: true,
      review_reminder: true,
      canReview: true,
      reviewReminder: true,
    }));

  return {
    reviews: enrichedReviews,
    pendingReminders,
    reminderCount: pendingReminders.length,
  };
}

/**
 * Xem danh sách đánh giá theo Không gian (Space) kèm thống kê điểm trung bình & phân bố sao.
 * Vì bảng reviews đạt chuẩn 3NF (chỉ lưu booking_id và user_id), hệ thống truy vết Space thông qua bookings.
 */
async function listSpaceReviews(db, { spaceId }) {
  const raw = typeof spaceId === 'string' ? spaceId.trim() : String(spaceId || '');
  if (!raw) {
    throw new BookingError(400, 'INVALID_SPACE_ID', 'Mã không gian không hợp lệ');
  }
  const space =
    ObjectId.isValid(raw) && raw.length === 24
      ? await db.collection('spaces').findOne({ _id: new ObjectId(raw) })
      : await db.collection('spaces').findOne({ space_code: raw.toUpperCase() });

  if (!space) {
    throw new BookingError(404, 'SPACE_NOT_FOUND', 'Không tìm thấy không gian');
  }

  const spaceBookings = await db
    .collection('bookings')
    .find({ space_id: space._id, status: 'CHECKED_OUT' })
    .toArray();

  if (spaceBookings.length === 0) {
    return {
      spaceId: String(space._id),
      spaceCode: space.space_code,
      spaceName: space.name,
      ...summarizeReviews([]),
      reviews: [],
    };
  }

  const bookingMap = new Map(spaceBookings.map((b) => [String(b._id), b]));
  const bookingIds = spaceBookings.map((b) => b._id);

  const reviews = await db
    .collection('reviews')
    .find({ booking_id: { $in: bookingIds } })
    .sort({ created_at: -1 })
    .toArray();

  const userIds = [...new Set(reviews.map((r) => String(r.user_id)))].map((id) => new ObjectId(id));
  const users = userIds.length
    ? await db.collection('users').find({ _id: { $in: userIds } }).toArray()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const items = reviews.map((r) => {
    const bk = bookingMap.get(String(r.booking_id));
    const u = userMap.get(String(r.user_id));
    return {
      _id: r._id,
      booking_id: r.booking_id,
      user_id: r.user_id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      reviewer_name: u ? u.full_name : 'Khách hàng KÉN',
      space_id: space._id,
      space_name: space.name,
      package_name: bk ? bk.package_name : null,
    };
  });

  return {
    spaceId: String(space._id),
    spaceCode: space.space_code,
    spaceName: space.name,
    ...summarizeReviews(reviews),
    reviews: items,
  };
}

/**
 * Danh sách đánh giá có bộ lọc (theo spaceId, bookingId, userId, rating).
 */
async function listReviews(db, { spaceId = null, bookingId = null, userId = null, rating = null } = {}) {
  const filter = {};
  if (bookingId) {
    filter.booking_id = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  }
  if (userId) {
    filter.user_id = toOid(userId, 'INVALID_USER_ID', 'Mã người dùng không hợp lệ');
  }
  if (rating !== null && rating !== undefined && rating !== '') {
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw new BookingError(422, 'INVALID_RATING', 'Bộ lọc rating phải là số nguyên từ 1 đến 5');
    }
    filter.rating = r;
  }
  if (spaceId) {
    const sOid = toOid(spaceId, 'INVALID_SPACE_ID', 'Mã không gian không hợp lệ');
    const spaceBookings = await db
      .collection('bookings')
      .find({ space_id: sOid })
      .toArray();
    const bIds = spaceBookings.map((b) => b._id);
    filter.booking_id = filter.booking_id
      ? { $in: bIds.filter((id) => String(id) === String(filter.booking_id)) }
      : { $in: bIds };
  }

  const reviews = await db
    .collection('reviews')
    .find(filter)
    .sort({ created_at: -1 })
    .toArray();

  return {
    ...summarizeReviews(reviews),
    reviews,
  };
}

module.exports = {
  attachReviewsToBookings,
  getBookingReviewStatus,
  createReview,
  listMyReviewsAndReminders,
  listSpaceReviews,
  listReviews,
};

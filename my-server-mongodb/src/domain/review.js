'use strict';
// Pure domain logic cho phân hệ Quản lý Đánh giá (Review Management — UC-16, BR-H01, BR-F03, BR-D06, FR-4.3).
// Tuân thủ chặt chẽ database/schemas/reviews.validator.json.
const {
  REVIEW_MIN_RATING,
  REVIEW_MAX_RATING,
  REVIEW_MAX_COMMENT_LENGTH,
} = require('../config/constants');

/**
 * Kiểm tra dữ liệu đầu vào của đánh giá (rating 1..5 bắt buộc, comment tùy chọn <= 500 ký tự).
 */
function validateReviewInput({ rating, comment }) {
  const numRating = typeof rating === 'number' ? rating : Number(rating);
  if (
    rating === undefined ||
    rating === null ||
    rating === '' ||
    typeof rating === 'boolean' ||
    !Number.isInteger(numRating) ||
    numRating < REVIEW_MIN_RATING ||
    numRating > REVIEW_MAX_RATING
  ) {
    return {
      ok: false,
      status: 422,
      code: 'INVALID_RATING',
      message: `Điểm đánh giá bắt buộc là số nguyên từ ${REVIEW_MIN_RATING} đến ${REVIEW_MAX_RATING}`,
    };
  }

  let cleanComment = null;
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      return {
        ok: false,
        status: 422,
        code: 'INVALID_COMMENT',
        message: 'Nhận xét phải là chuỗi ký tự',
      };
    }
    const trimmed = comment.trim();
    if (trimmed.length > REVIEW_MAX_COMMENT_LENGTH) {
      return {
        ok: false,
        status: 422,
        code: 'COMMENT_TOO_LONG',
        message: `Nhận xét không được vượt quá ${REVIEW_MAX_COMMENT_LENGTH} ký tự`,
      };
    }
    cleanComment = trimmed.length > 0 ? trimmed : null;
  }

  return {
    ok: true,
    rating: numRating,
    comment: cleanComment,
  };
}

/**
 * Kiểm tra điều kiện đánh giá của một Booking (UC-16 bước 2–4, BR-D06, BR-H01, BR-F03):
 * 1. Đơn phải tồn tại.
 * 2. Đơn phải thuộc về chính chủ (user_id === userId).
 * 3. Đơn chưa có đánh giá (tối đa 01 đánh giá / Booking).
 * 4. Đơn phải ở trạng thái CHECKED_OUT.
 */
function evaluateReviewEligibility({ booking, userId, existingReview = null }) {
  if (!booking) {
    return {
      canReview: false,
      hasReview: false,
      reviewReminder: false,
      status: 404,
      code: 'BOOKING_NOT_FOUND',
      message: 'Không tìm thấy đơn đặt chỗ',
      review: null,
    };
  }

  if (!userId || String(booking.user_id) !== String(userId)) {
    return {
      canReview: false,
      hasReview: Boolean(existingReview),
      reviewReminder: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Chỉ chủ đơn mới được phép đánh giá đơn đặt chỗ này',
      review: null,
    };
  }

  if (existingReview) {
    return {
      canReview: false,
      hasReview: true,
      reviewReminder: false,
      status: 409,
      code: 'REVIEW_ALREADY_EXISTS',
      message: 'Đơn đặt chỗ này đã có đánh giá (tối đa 01 đánh giá/Booking)',
      review: existingReview,
    };
  }

  if (booking.status !== 'CHECKED_OUT') {
    return {
      canReview: false,
      hasReview: false,
      reviewReminder: false,
      status: 422,
      code: 'BOOKING_NOT_CHECKED_OUT',
      message: 'Chỉ được đánh giá sau khi đã hoàn tất sử dụng dịch vụ (CHECKED_OUT)',
      review: null,
    };
  }

  return {
    canReview: true,
    hasReview: false,
    reviewReminder: true,
    status: 200,
    code: 'OK',
    message: 'Đơn đặt chỗ đủ điều kiện đánh giá',
    review: null,
  };
}

/**
 * Gắn thông tin đánh giá và lời nhắc đánh giá vào đơn đặt chỗ khi hiển thị Booking History (FR-4.3, BR-H01).
 * - Hiển thị lời nhắc đánh giá (review_reminder / reviewReminder = true) khi đơn đã CHECKED_OUT và chưa có đánh giá.
 * - Khi đã có đánh giá, trả kèm nội dung review (chế độ chỉ xem AF2) và tắt lời nhắc (review_reminder = false).
 */
function enrichBookingWithReview(booking, reviewDoc = null) {
  const hasReview = Boolean(reviewDoc);
  const canReview = booking.status === 'CHECKED_OUT' && !hasReview;
  const reviewReminder = canReview;
  return {
    ...booking,
    has_review: hasReview,
    can_review: canReview,
    review_reminder: reviewReminder,
    hasReview,
    canReview,
    reviewReminder,
    review: reviewDoc || null,
  };
}

/**
 * Tính điểm trung bình và phân bố số sao 1..5 cho danh sách đánh giá.
 */
function summarizeReviews(reviews = []) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    const star = Number(r.rating);
    if (star >= 1 && star <= 5) {
      distribution[star] = (distribution[star] || 0) + 1;
      sum += star;
    }
  }
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? Math.round((sum / totalReviews) * 100) / 100 : 0;
  return {
    totalReviews,
    averageRating,
    ratingDistribution: distribution,
  };
}

module.exports = {
  validateReviewInput,
  evaluateReviewEligibility,
  enrichBookingWithReview,
  summarizeReviews,
};

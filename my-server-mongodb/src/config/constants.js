'use strict';
// Giá trị cấu hình vận hành và giới hạn kiểm tra (Mục 6.4.19 Report.docx)
module.exports = Object.freeze({
  HOLD_MINUTES: 15,               // BR-D03
  MIN_LEAD_MINUTES: 30,           // BR-C06
  CHECKIN_EARLY_MINUTES: 15,      // BR-F01
  NO_SHOW_AFTER_MINUTES: 30,      // BR-F01
  CANCEL_CUTOFF_MINUTES: 120,     // BR-G01 (2 giờ)
  BUFFER_MINUTES: 15,             // BR-C04: chỉ áp cho EXCLUSIVE; SHARED không có buffer
  POINT_UNIT_VND: 10000,          // BR-H03
  REVIEW_MIN_RATING: 1,           // BR-H01, FR-4.3
  REVIEW_MAX_RATING: 5,           // BR-H01, FR-4.3
  REVIEW_MAX_COMMENT_LENGTH: 500, // FR-4.3, 6.4.18
});

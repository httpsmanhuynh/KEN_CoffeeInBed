'use strict';
// Giá trị "tạm" trong report; chốt lại trong docs/memory/open-questions.md
module.exports = Object.freeze({
  HOLD_MINUTES: 15,            // BR-D03
  MIN_LEAD_MINUTES: 30,        // BR-C06
  CHECKIN_EARLY_MINUTES: 15,   // BR-F01
  NO_SHOW_AFTER_MINUTES: 30,   // BR-F01
  CANCEL_CUTOFF_MINUTES: 120,  // BR-G01 (vd 2 giờ)
  BUFFER_MINUTES: 15,          // BR-C04: chỉ áp cho EXCLUSIVE; SHARED không có buffer
  POINT_UNIT_VND: 10000,       // BR-H03
});

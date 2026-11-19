'use strict';

/**
 * Lỗi nghiệp vụ của phân hệ Admin (Module 11).
 * Route chuyển thành HTTP response: { error: code, message }.
 */
class AdminError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.name = 'AdminError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { AdminError };

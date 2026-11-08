'use strict';
// Bản tham chiếu của assertMoney / pick (NFR-03 - Never Trust the Client).
// Khi test backend thật: đổi require trong tests/unit sang file thật của bạn.

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.status = 422;
    this.field = field;
  }
}

function assertMoney(value, field = 'amount') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${field} phải là số hợp lệ`, field);
  }
  if (value < 0) throw new ValidationError(`${field} không được âm`, field);
  return value;
}

function assertPositiveInt(value, field = 'value') {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} phải là số nguyên dương`, field);
  }
  return value;
}

function assertEnum(value, allowed, field = 'status') {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} phải thuộc [${allowed.join(', ')}]`, field);
  }
  return value;
}

function pick(obj, keys) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}

const STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
module.exports = { ValidationError, assertMoney, assertPositiveInt, assertEnum, pick, STATUSES };

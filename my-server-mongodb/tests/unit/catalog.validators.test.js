'use strict';
// TC-CAT-U: Unit test cho assertMoney / assertPositiveInt / assertEnum / pick (NFR-03)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { assertMoney, assertPositiveInt, assertEnum, pick, ValidationError } = require('../helpers/validators');

describe('assertMoney', () => {
  test('TC-CAT-U-001: chấp nhận 0 và số dương', () => {
    assert.equal(assertMoney(0), 0);
    assert.equal(assertMoney(150000), 150000);
  });
  for (const bad of [-100, -0.01, NaN, Infinity, '100', null, undefined]) {
    test(`TC-CAT-U-002: từ chối giá trị ${String(bad)} (422)`, () => {
      assert.throws(() => assertMoney(bad, 'unitPrice'), (e) => e instanceof ValidationError && e.status === 422 && e.field === 'unitPrice');
    });
  }
});

describe('assertPositiveInt', () => {
  test('TC-CAT-U-003: chấp nhận số nguyên dương', () => assert.equal(assertPositiveInt(5), 5));
  for (const bad of [0, -5, 1.5, '3', null]) {
    test(`TC-CAT-U-004: từ chối capacity ${String(bad)}`, () => {
      assert.throws(() => assertPositiveInt(bad, 'capacity'), ValidationError);
    });
  }
});

describe('assertEnum', () => {
  test('TC-CAT-U-005: chấp nhận ACTIVE/INACTIVE/MAINTENANCE', () => {
    for (const s of ['ACTIVE', 'INACTIVE', 'MAINTENANCE']) assert.equal(assertEnum(s, ['ACTIVE', 'INACTIVE', 'MAINTENANCE']), s);
  });
  test('TC-CAT-U-006: từ chối trạng thái lạ / sai hoa-thường', () => {
    assert.throws(() => assertEnum('active', ['ACTIVE']), ValidationError);
    assert.throws(() => assertEnum('DELETED', ['ACTIVE']), ValidationError);
  });
});

describe('pick (chống over-posting)', () => {
  test('TC-CAT-U-007: loại bỏ trường rác, chỉ giữ trường whitelist', () => {
    assert.deepEqual(pick({ name: 'Zone 1', is_admin: true, role: 'ADMIN' }, ['name']), { name: 'Zone 1' });
  });
  test('TC-CAT-U-008: không tạo key khi input thiếu trường', () => {
    assert.deepEqual(pick({ name: 'A' }, ['name', 'capacity']), { name: 'A' });
  });
  test('TC-CAT-U-009: input null / không phải object => {}', () => {
    assert.deepEqual(pick(null, ['name']), {});
    assert.deepEqual(pick('abc', ['name']), {});
  });
  test('TC-CAT-U-010: không bị prototype pollution qua __proto__', () => {
    const evil = JSON.parse('{"__proto__":{"polluted":true},"name":"X"}');
    const out = pick(evil, ['name']);
    assert.equal(out.polluted, undefined);
    assert.equal({}.polluted, undefined);
  });
});

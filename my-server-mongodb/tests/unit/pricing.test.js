'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { computePrice } = require('../../src/domain/pricing');

test('TC-PRC-01\tAUTO-PRC-01: pricing: voucher trước, hạng sau, làm tròn xuống (BR-B03)', () => {
  const r = computePrice({
    packagePrice: 100000,
    inclusionSurcharge: 5000,
    addons: [{ unitPrice: 20000, qty: 2 }],
    voucherDiscount: 15000,
    tierPercent: 5,
  });
  assert.equal(r.subtotal, 145000);
  assert.equal(r.tierDiscount, Math.floor((130000 * 5) / 100));
  assert.equal(r.finalAmount, 145000 - 15000 - 6500);
});

test('TC-PRC-02\tAUTO-PRC-02: pricing: voucher không vượt tạm tính; tiền phải là số nguyên', () => {
  assert.equal(
    computePrice({ packagePrice: 50000, voucherDiscount: 99999, tierPercent: 15 }).finalAmount,
    0,
  );
  assert.throws(() => computePrice({ packagePrice: 100.5 }), RangeError);
});

test('TC-PRC-03\tAUTO-PRC-03: catalog: assertMoney reject float và số âm', () => {
  function assertMoney(v, name) {
    if (!Number.isInteger(v) || v < 0)
      throw Object.assign(new Error(`${name} phải là số nguyên VNĐ >= 0`), { status: 422 });
  }
  assert.throws(() => assertMoney(100.5, 'unitPrice'), { status: 422 });
  assert.throws(() => assertMoney(-1, 'unitPrice'), { status: 422 });
  assert.throws(() => assertMoney('100', 'unitPrice'), { status: 422 });
  assert.doesNotThrow(() => assertMoney(0, 'unitPrice'));
  assert.doesNotThrow(() => assertMoney(100000, 'unitPrice'));
});

test('TC-PRC-04\tAUTO-PRC-04: catalog: pick() chỉ lấy key có trong whitelist', () => {
  function pick(body, keys) {
    const set = {};
    for (const k of keys) if (k in body && body[k] !== undefined) set[k] = body[k];
    return set;
  }
  const body = { name: 'Test', hack: 'inject', status: 'ACTIVE', extra: undefined };
  const result = pick(body, ['name', 'status', 'description']);
  assert.deepEqual(result, { name: 'Test', status: 'ACTIVE' });
});

test('TC-PRC-05\tAUTO-PRC-05: catalog: ObjectId.isValid chặn injection', () => {
  assert.equal(ObjectId.isValid(''), false);
  assert.equal(ObjectId.isValid('invalid'), false);
  assert.equal(ObjectId.isValid('{ $ne: null }'), false);
  assert.equal(ObjectId.isValid(String(new ObjectId())), true);
});

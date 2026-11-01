'use strict';
// BR-B03, BR-B04: toàn bộ số tiền là số nguyên VNĐ.

function assertMoney(v, name) {
  if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} must be a non-negative integer VND`);
}

function computePrice({ packagePrice, inclusionSurcharge = 0, addons = [], voucherDiscount = 0, tierPercent = 0 }) {
  assertMoney(packagePrice, 'packagePrice');
  assertMoney(inclusionSurcharge, 'inclusionSurcharge');
  assertMoney(voucherDiscount, 'voucherDiscount');
  if (!Number.isInteger(tierPercent) || tierPercent < 0 || tierPercent > 100) throw new RangeError('tierPercent must be 0..100');

  let addonTotal = 0;
  for (const a of addons) {
    assertMoney(a.unitPrice, 'addon.unitPrice');
    if (!Number.isInteger(a.qty) || a.qty < 1) throw new RangeError('addon.qty must be integer >= 1');
    addonTotal += a.unitPrice * a.qty;
  }

  const subtotal = packagePrice + inclusionSurcharge + addonTotal;
  const voucher = Math.min(voucherDiscount, subtotal);            // voucher không vượt tạm tính
  const tierDiscount = Math.floor(((subtotal - voucher) * tierPercent) / 100); // làm tròn xuống
  const discountAmount = voucher + tierDiscount;
  return { subtotal, addonTotal, voucherDiscount: voucher, tierDiscount, discountAmount, finalAmount: subtotal - discountAmount };
}

module.exports = { computePrice };

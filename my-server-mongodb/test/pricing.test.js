'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  PricingError,
  calcPackagePrice,
  calcInclusionSurcharge,
  calcAddonTotal,
  calcVoucherDiscount,
  calcTierDiscount,
  calculatePricing,
  toBookingSnapshot,
  toPriceSnapshot,
  computePrice,
} = require('../src/domain/pricing');

const throwsCode = (fn, code) =>
  assert.throws(fn, (e) => e instanceof PricingError && e.code === code);

describe('TC-PRICE-PKG: giá Package (Bảng A.4.2)', () => {
  test('FIXED + PER_SPACE = giá trọn gói', () => {
    assert.equal(calcPackagePrice({ packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 250000 }), 250000);
  });
  test('FIXED + PER_PERSON = giá × số khách', () => {
    assert.equal(
      calcPackagePrice({ packageType: 'FIXED', pricingUnit: 'PER_PERSON', price: 90000, guestCount: 3 }),
      270000
    );
  });
  test('HOURLY + PER_SPACE = đơn giá giờ × số giờ', () => {
    assert.equal(
      calcPackagePrice({ packageType: 'HOURLY', pricingUnit: 'PER_SPACE', price: 45000, hours: 3 }),
      135000
    );
  });
  test('HOURLY + PER_PERSON = đơn giá × khách × giờ', () => {
    assert.equal(
      calcPackagePrice({ packageType: 'HOURLY', pricingUnit: 'PER_PERSON', price: 30000, guestCount: 4, hours: 2 }),
      240000
    );
  });
  test('biên: HOURLY đúng 1 giờ (tối thiểu) hợp lệ', () => {
    assert.equal(calcPackagePrice({ packageType: 'HOURLY', pricingUnit: 'PER_SPACE', price: 45000, hours: 1 }), 45000);
  });
  test('HOURLY dưới minHours bị từ chối', () => {
    throwsCode(
      () => calcPackagePrice({ packageType: 'HOURLY', pricingUnit: 'PER_SPACE', price: 45000, hours: 1, minHours: 2 }),
      'HOURS_BELOW_MIN'
    );
  });
  test('thiếu hours / guestCount bị từ chối', () => {
    throwsCode(() => calcPackagePrice({ packageType: 'HOURLY', pricingUnit: 'PER_SPACE', price: 1000 }), 'INVALID_QUANTITY');
    throwsCode(() => calcPackagePrice({ packageType: 'FIXED', pricingUnit: 'PER_PERSON', price: 1000 }), 'INVALID_QUANTITY');
  });
  test('đầu vào không hợp lệ: giá âm, số thực, loại sai', () => {
    throwsCode(() => calcPackagePrice({ packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: -1 }), 'INVALID_AMOUNT');
    throwsCode(() => calcPackagePrice({ packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 100.5 }), 'INVALID_AMOUNT');
    throwsCode(() => calcPackagePrice({ packageType: 'DAILY', pricingUnit: 'PER_SPACE', price: 1 }), 'INVALID_PACKAGE_TYPE');
    throwsCode(() => calcPackagePrice({ packageType: 'FIXED', pricingUnit: 'PER_ROOM', price: 1 }), 'INVALID_PRICING_UNIT');
  });
});

describe('TC-PRICE-INC: phụ phí Inclusion (chỉ cộng phần chênh lệch)', () => {
  const LIMIT = 50000;
  test('giá thấp hơn định mức -> phụ phí 0', () => {
    assert.equal(calcInclusionSurcharge([{ unitPrice: 40000, quantity: 1, subsidyLimit: LIMIT }]).total, 0);
  });
  test('biên: giá đúng bằng định mức -> phụ phí 0', () => {
    assert.equal(calcInclusionSurcharge([{ unitPrice: 50000, quantity: 1, subsidyLimit: LIMIT }]).total, 0);
  });
  test('biên: vượt định mức 1đ -> phụ phí 1đ', () => {
    assert.equal(calcInclusionSurcharge([{ unitPrice: 50001, quantity: 1, subsidyLimit: LIMIT }]).total, 1);
  });
  test('Matcha Latte 55.000 / định mức 50.000 -> chỉ cộng 5.000, không cộng 55.000', () => {
    assert.equal(calcInclusionSurcharge([{ unitPrice: 55000, quantity: 1, subsidyLimit: LIMIT }]).total, 5000);
  });
  test('nhiều suất: chênh lệch × số lượng, cộng dồn nhiều dòng', () => {
    const r = calcInclusionSurcharge([
      { unitPrice: 55000, quantity: 2, subsidyLimit: LIMIT }, // 5.000 × 2
      { unitPrice: 40000, quantity: 1, subsidyLimit: LIMIT }, // 0
      { unitPrice: 60000, quantity: 3, subsidyLimit: LIMIT }, // 10.000 × 3
    ]);
    assert.equal(r.total, 40000);
    assert.deepEqual(r.lines.map((l) => l.surchargeAmount), [10000, 0, 30000]);
  });
  test('quyền lợi không có định mức (null) -> không phát sinh phụ phí', () => {
    assert.equal(calcInclusionSurcharge([{ unitPrice: 35000, quantity: 2, subsidyLimit: null }]).total, 0);
  });
  test('rỗng -> 0; quantity < 1 bị từ chối', () => {
    assert.equal(calcInclusionSurcharge([]).total, 0);
    throwsCode(() => calcInclusionSurcharge([{ unitPrice: 1000, quantity: 0, subsidyLimit: 0 }]), 'INVALID_QUANTITY');
  });
});

describe('TC-PRICE-ADD: Add-on', () => {
  test('PER_ITEM = đơn giá × số lượng, cộng nhiều dòng', () => {
    const r = calcAddonTotal([
      { unit: 'PER_ITEM', unitPrice: 40000, quantity: 2 },
      { unit: 'PER_ITEM', unitPrice: 15000, quantity: 3 },
    ]);
    assert.equal(r.total, 125000);
  });
  test('mọi Add-on = đơn giá × số lượng (kể cả unit PER_BOOKING cũ, không còn ép = 1)', () => {
    assert.equal(calcAddonTotal([{ unit: 'PER_BOOKING', unitPrice: 50000, quantity: 5 }]).total, 250000);
    assert.equal(calcAddonTotal([{ unitPrice: 20000, quantity: 3 }]).total, 60000); // không truyền unit
  });
  test('thiếu quantity bị từ chối (Backend không đoán số lượng)', () => {
    throwsCode(() => calcAddonTotal([{ unit: 'PER_BOOKING', unitPrice: 50000 }]), 'INVALID_QUANTITY');
  });
  test('không có Add-on -> 0', () => {
    assert.equal(calcAddonTotal([]).total, 0);
    assert.equal(calcAddonTotal().total, 0);
  });
  test('quantity không hợp lệ / unit sai bị từ chối', () => {
    throwsCode(() => calcAddonTotal([{ unit: 'PER_ITEM', unitPrice: 1000, quantity: 0 }]), 'INVALID_QUANTITY');
    throwsCode(() => calcAddonTotal([{ unit: 'PER_ITEM', unitPrice: 1000, quantity: 1.5 }]), 'INVALID_QUANTITY');
    throwsCode(() => calcAddonTotal([{ unit: 'PER_DAY', unitPrice: 1000, quantity: 1 }]), 'INVALID_ADDON_UNIT');
  });
});

describe('TC-PRICE-VCH: Voucher (trừ trước, không âm)', () => {
  test('không có Voucher -> 0', () => {
    assert.equal(calcVoucherDiscount(null, 100000), 0);
  });
  test('FIXED_AMOUNT nhỏ hơn Tạm tính', () => {
    assert.equal(calcVoucherDiscount({ discountType: 'FIXED_AMOUNT', discountValue: 30000 }, 100000), 30000);
  });
  test('FIXED_AMOUNT lớn hơn Tạm tính -> bị chặn bằng Tạm tính (không âm)', () => {
    assert.equal(calcVoucherDiscount({ discountType: 'FIXED_AMOUNT', discountValue: 500000 }, 100000), 100000);
  });
  test('biên: FIXED_AMOUNT bằng đúng Tạm tính', () => {
    assert.equal(calcVoucherDiscount({ discountType: 'FIXED_AMOUNT', discountValue: 100000 }, 100000), 100000);
  });
  test('PERCENT làm tròn xuống', () => {
    assert.equal(calcVoucherDiscount({ discountType: 'PERCENT', discountValue: 10 }, 99999), 9999); // 9999,9
    assert.equal(calcVoucherDiscount({ discountType: 'PERCENT', discountValue: 20 }, 101), 20); // 20,2
  });
  test('PERCENT 100% = toàn bộ Tạm tính', () => {
    assert.equal(calcVoucherDiscount({ discountType: 'PERCENT', discountValue: 100 }, 123456), 123456);
  });
  test('Tạm tính 0 -> giảm 0', () => {
    assert.equal(calcVoucherDiscount({ discountType: 'FIXED_AMOUNT', discountValue: 30000 }, 0), 0);
  });
  test('Voucher cấu hình sai bị từ chối', () => {
    throwsCode(() => calcVoucherDiscount({ discountType: 'PERCENT', discountValue: 101 }, 1000), 'INVALID_DISCOUNT_VALUE');
    throwsCode(() => calcVoucherDiscount({ discountType: 'PERCENT', discountValue: 0 }, 1000), 'INVALID_DISCOUNT_VALUE');
    throwsCode(() => calcVoucherDiscount({ discountType: 'GIFT', discountValue: 10 }, 1000), 'INVALID_DISCOUNT_TYPE');
  });
});

describe('TC-PRICE-TIER: giảm theo hạng (tính sau Voucher, làm tròn xuống)', () => {
  test('tính trên (Tạm tính − Voucher), không phải trên Tạm tính', () => {
    // (200.000 − 50.000) × 10% = 15.000  (nếu tính trên 200.000 sẽ là 20.000)
    assert.equal(calcTierDiscount(200000, 50000, 0.1), 15000);
  });
  test('làm tròn xuống đến đồng', () => {
    assert.equal(calcTierDiscount(100001, 0, 0.05), 5000); // 5000,05
    assert.equal(calcTierDiscount(19, 0, 0.15), 2); // 2,85
  });
  test('không sai số số thực: 0.05 / 0.1 / 0.15 với số lớn', () => {
    // 0.1 × 300000 trong float có thể ra 29999.999...; phải ra đúng 30000
    assert.equal(calcTierDiscount(300000, 0, 0.1), 30000);
    assert.equal(calcTierDiscount(1000000, 0, 0.15), 150000);
    assert.equal(calcTierDiscount(580000, 0, 0.05), 29000);
  });
  test('hạng BASIC (0) hoặc không truyền -> 0', () => {
    assert.equal(calcTierDiscount(100000, 0, 0), 0);
    assert.equal(calcTierDiscount(100000, 0, undefined), 0);
  });
  test('Voucher đã trừ hết -> không còn gì để giảm theo hạng', () => {
    assert.equal(calcTierDiscount(100000, 100000, 0.15), 0);
  });
  test('đầu vào không hợp lệ', () => {
    throwsCode(() => calcTierDiscount(100000, 0, 1.2), 'INVALID_RATE');
    throwsCode(() => calcTierDiscount(100000, 0, -0.1), 'INVALID_RATE');
    throwsCode(() => calcTierDiscount(100000, 200000, 0.1), 'INVALID_AMOUNT');
  });
});

describe('TC-PRICE-ALL: calculatePricing – công thức tổng hợp', () => {
  test('ví dụ đầy đủ: Package + phụ phí + Add-on − Voucher − hạng Vàng 10%', () => {
    const r = calculatePricing({
      package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 140000 },
      inclusions: [{ unitPrice: 55000, quantity: 1, subsidyLimit: 50000 }], // +5.000
      addons: [
        { unit: 'PER_ITEM', unitPrice: 40000, quantity: 1 }, // 40.000
        { unit: 'PER_BOOKING', unitPrice: 25000, quantity: 2 }, // 50.000
      ],
      voucher: { discountType: 'FIXED_AMOUNT', discountValue: 30000 },
      tierRate: 0.1,
    });
    assert.equal(r.packagePrice, 140000);
    assert.equal(r.inclusionSurcharge, 5000);
    assert.equal(r.addonTotal, 90000);
    assert.equal(r.subtotal, 235000);
    assert.equal(r.voucherDiscount, 30000);
    assert.equal(r.tierDiscount, 20500); // (235.000 − 30.000) × 10%
    assert.equal(r.discountAmount, 50500);
    assert.equal(r.finalAmount, 184500);
  });

  test('thứ tự áp dụng: Voucher trước, hạng sau (khác thứ tự ngược lại)', () => {
    const input = {
      package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 200000 },
      voucher: { discountType: 'FIXED_AMOUNT', discountValue: 50000 },
      tierRate: 0.1,
    };
    const r = calculatePricing(input);
    assert.equal(r.tierDiscount, 15000); // không phải 20.000
    assert.equal(r.finalAmount, 135000);
  });

  test('Voucher lớn hơn Tạm tính -> final_amount = 0, không âm, hạng không giảm thêm', () => {
    const r = calculatePricing({
      package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 70000 },
      voucher: { discountType: 'FIXED_AMOUNT', discountValue: 500000 },
      tierRate: 0.15,
    });
    assert.equal(r.voucherDiscount, 70000);
    assert.equal(r.tierDiscount, 0);
    assert.equal(r.finalAmount, 0);
  });

  test('không Voucher, không Add-on, hạng BASIC -> final = Package', () => {
    const r = calculatePricing({ package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 70000 } });
    assert.equal(r.subtotal, 70000);
    assert.equal(r.discountAmount, 0);
    assert.equal(r.finalAmount, 70000);
  });

  test('bất biến: mọi số tiền là số nguyên không âm; final = subtotal − discount; discount ≤ subtotal', () => {
    const rates = [0, 0.05, 0.1, 0.15];
    const vouchers = [
      null,
      { discountType: 'PERCENT', discountValue: 7 },
      { discountType: 'PERCENT', discountValue: 100 },
      { discountType: 'FIXED_AMOUNT', discountValue: 12345 },
      { discountType: 'FIXED_AMOUNT', discountValue: 99999999 },
    ];
    for (const price of [0, 1, 999, 70000, 123457, 770000]) {
      for (const rate of rates) {
        for (const v of vouchers) {
          const r = calculatePricing({
            package: { packageType: 'HOURLY', pricingUnit: 'PER_PERSON', price, guestCount: 3, hours: 2 },
            inclusions: [{ unitPrice: 61234, quantity: 2, subsidyLimit: 50000 }],
            addons: [{ unit: 'PER_ITEM', unitPrice: 33333, quantity: 3 }],
            voucher: v,
            tierRate: rate,
          });
          for (const k of ['subtotal', 'voucherDiscount', 'tierDiscount', 'discountAmount', 'finalAmount']) {
            assert.ok(Number.isSafeInteger(r[k]) && r[k] >= 0, `${k} phải là số nguyên không âm`);
          }
          assert.equal(r.finalAmount, r.subtotal - r.discountAmount);
          assert.equal(r.discountAmount, r.voucherDiscount + r.tierDiscount);
          assert.ok(r.discountAmount <= r.subtotal);
        }
      }
    }
  });

  test('thiếu package bị từ chối', () => {
    throwsCode(() => calculatePricing({}), 'INVALID_INPUT');
    throwsCode(() => calculatePricing(), 'INVALID_INPUT');
  });

  test('toPriceSnapshot: đóng băng sâu, có chi tiết dòng, khớp trường phẳng', () => {
    const r = calculatePricing({
      package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 100000 },
      inclusions: [{ unitPrice: 55000, quantity: 2, subsidyLimit: 50000 }],
      addons: [{ unitPrice: 40000, quantity: 2 }],
      voucher: { discountType: 'PERCENT', discountValue: 10 },
      tierRate: 0.05,
    });
    const snap = toPriceSnapshot(r);
    // 100.000 + 10.000 + 80.000 = 190.000; voucher 19.000; hạng floor(171.000×5%) = 8.550
    assert.equal(snap.subtotal, 190000);
    assert.equal(snap.voucher_discount, 19000);
    assert.equal(snap.tier_discount, 8550);
    assert.equal(snap.final_amount, 162450);
    assert.deepEqual({ ...snap, inclusion_lines: undefined, addon_lines: undefined },
      { ...toBookingSnapshot(r), inclusion_lines: undefined, addon_lines: undefined });
    assert.deepEqual(snap.addon_lines, [{ unit_price: 40000, quantity: 2, line_total: 80000 }]);
    assert.deepEqual(snap.inclusion_lines, [
      { unit_price: 55000, quantity: 2, subsidy_limit: 50000, surcharge_amount: 10000 },
    ]);
    assert.ok(Object.isFrozen(snap) && Object.isFrozen(snap.addon_lines) && Object.isFrozen(snap.addon_lines[0]));
    assert.throws(() => { 'use strict'; snap.final_amount = 0; }, TypeError);
    assert.equal(snap.final_amount, 162450);
  });

  test('toBookingSnapshot map đúng tên trường của collection bookings', () => {
    const r = calculatePricing({
      package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 100000 },
      tierRate: 0.05,
    });
    assert.deepEqual(toBookingSnapshot(r), {
      package_price: 100000,
      inclusion_surcharge: 0,
      addon_total: 0,
      subtotal: 100000,
      voucher_discount: 0,
      tier_rate: 0.05,
      tier_discount: 5000,
      discount_amount: 5000,
      final_amount: 95000,
    });
  });
});

describe('TC-PRICE-COMPAT: computePrice (giao diện cũ) – kết quả & lỗi phải giữ nguyên', () => {
  const throwsRange = (fn, re) =>
    assert.throws(fn, (e) => e instanceof RangeError && re.test(e.message));

  test('đủ thành phần: Package + phụ phí + Add-on − Voucher − hạng 10%', () => {
    assert.deepEqual(
      computePrice({
        packagePrice: 200000,
        inclusionSurcharge: 5000,
        addons: [{ unitPrice: 20000, qty: 2 }],
        voucherDiscount: 50000,
        tierPercent: 10,
      }),
      {
        subtotal: 245000,
        addonTotal: 40000,
        voucherDiscount: 50000,
        tierDiscount: 19500,
        discountAmount: 69500,
        finalAmount: 175500,
      }
    );
  });
  test('chỉ truyền packagePrice -> final = package', () => {
    assert.deepEqual(computePrice({ packagePrice: 90000 }), {
      subtotal: 90000, addonTotal: 0, voucherDiscount: 0, tierDiscount: 0, discountAmount: 0, finalAmount: 90000,
    });
  });
  test('Voucher lớn hơn Tạm tính bị chặn: final = 0, hạng không giảm thêm', () => {
    const r = computePrice({ packagePrice: 100000, voucherDiscount: 999999, tierPercent: 20 });
    assert.equal(r.voucherDiscount, 100000);
    assert.equal(r.tierDiscount, 0);
    assert.equal(r.finalAmount, 0);
  });
  test('giảm hạng làm tròn xuống trên (Tạm tính − Voucher)', () => {
    assert.equal(computePrice({ packagePrice: 100001, tierPercent: 15 }).tierDiscount, 15000);
  });
  test('trả cùng kết quả với calculatePricing cho cùng dữ liệu', () => {
    const legacy = computePrice({ packagePrice: 250000, addons: [{ unitPrice: 15000, qty: 3 }], voucherDiscount: 30000, tierPercent: 5 });
    const modern = calculatePricing({
      package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: 250000 },
      addons: [{ unitPrice: 15000, quantity: 3 }],
      voucher: { discountType: 'FIXED_AMOUNT', discountValue: 30000 },
      tierRate: 0.05,
    });
    assert.equal(legacy.subtotal, modern.subtotal);
    assert.equal(legacy.discountAmount, modern.discountAmount);
    assert.equal(legacy.finalAmount, modern.finalAmount);
  });
  test('đầu vào sai vẫn ném RangeError với thông điệp cũ', () => {
    throwsRange(() => computePrice({ packagePrice: -1 }), /^packagePrice must be a non-negative integer VND$/);
    throwsRange(() => computePrice({ packagePrice: 1.5 }), /packagePrice/);
    throwsRange(() => computePrice({ packagePrice: 1, inclusionSurcharge: -5 }), /^inclusionSurcharge/);
    throwsRange(() => computePrice({ packagePrice: 1, voucherDiscount: -5 }), /^voucherDiscount/);
    throwsRange(() => computePrice({ packagePrice: 1, tierPercent: 101 }), /^tierPercent must be 0\.\.100$/);
    throwsRange(() => computePrice({ packagePrice: 1, tierPercent: 2.5 }), /^tierPercent/);
    throwsRange(() => computePrice({ packagePrice: 1, addons: [{ unitPrice: -1, qty: 1 }] }), /^addon\.unitPrice/);
    throwsRange(() => computePrice({ packagePrice: 1, addons: [{ unitPrice: 1, qty: 0 }] }), /^addon\.qty must be integer >= 1$/);
  });
});

'use strict';

/**
 * Pricing Engine – KÉN (FR-2.2, BR-B03, BR-B04, BR-H04)
 *
 * Công thức chuẩn (Backend tự tính – Never Trust the Client – rồi đóng băng vào price_snapshot):
 *   Giá Package + Phụ phí Inclusion + Σ(Giá Add-on × Số lượng) − Giảm giá (% Hạng / Voucher)
 *
 * Chi tiết:
 *   subtotal         = package_price + inclusion_surcharge + Σ(addon unit_price × quantity)
 *   voucher_discount = min(giảm theo Voucher, subtotal)          (trừ TRƯỚC, không âm)
 *   tier_discount    = floor((subtotal − voucher_discount) × tier_rate)
 *   discount_amount  = voucher_discount + tier_discount
 *   final_amount     = subtotal − discount_amount
 *
 * Nguyên tắc:
 *  - Hàm THUẦN: không đọc DB, không đọc Date. Đầu vào là dữ liệu Backend đã
 *    tự truy xuất từ DB (Never Trust the Client – NFR-03).
 *  - Mọi số tiền là số nguyên VNĐ, không âm, làm tròn XUỐNG (BR-B04).
 *  - Tính bằng số nguyên (basis point) để tránh sai số số thực (0.1 × 300000...).
 *  - Việc kiểm tra điều kiện Voucher (hạn dùng, giá trị tối thiểu, lượt dùng)
 *    thuộc tầng service (BR-H02); file này chỉ tính tiền khi Voucher đã hợp lệ.
 */

class PricingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
  }
}

const PACKAGE_TYPES = ['FIXED', 'HOURLY'];
const PRICING_UNITS = ['PER_SPACE', 'PER_PERSON'];
const ADDON_UNITS = ['PER_ITEM', 'PER_BOOKING']; // chỉ để tương thích dữ liệu cũ; không ảnh hưởng cách tính
const DISCOUNT_TYPES = ['PERCENT', 'FIXED_AMOUNT'];

const BASIS = 10000; // 1.0 = 10000 basis point (tier_rate 0.05 -> 500)

// ---------- helpers ----------

function fail(code, message) {
  throw new PricingError(code, message);
}

function assertMoney(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_AMOUNT', `${name} phải là số nguyên VNĐ không âm`);
  }
  return value;
}

function assertPositiveInt(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_QUANTITY', `${name} phải là số nguyên >= 1`);
  }
  return value;
}

/** floor(amount × bp / BASIS) bằng số nguyên. */
function floorByBasisPoint(amount, bp) {
  return Math.floor((amount * bp) / BASIS);
}

function deepFreeze(obj) {
  Object.values(obj).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(obj);
}

/** tier_rate (0..1) -> basis point nguyên, tránh lỗi số thực. */
function rateToBasisPoint(rate, name) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    fail('INVALID_RATE', `${name} phải nằm trong khoảng 0 đến 1`);
  }
  return Math.round(rate * BASIS);
}

// ---------- 1. Giá Package (Bảng A.4.2) ----------

/**
 * @param {object} p
 * @param {'FIXED'|'HOURLY'} p.packageType
 * @param {'PER_SPACE'|'PER_PERSON'} p.pricingUnit
 * @param {number} p.price      Giá trọn gói (FIXED) hoặc đơn giá giờ (HOURLY) – lấy từ PACKAGE_PRICE
 * @param {number} [p.guestCount]  Bắt buộc với PER_PERSON
 * @param {number} [p.hours]       Bắt buộc với HOURLY
 * @param {number} [p.minHours=1]  Số giờ tối thiểu của gói HOURLY
 */
function calcPackagePrice({ packageType, pricingUnit, price, guestCount, hours, minHours = 1 }) {
  if (!PACKAGE_TYPES.includes(packageType)) fail('INVALID_PACKAGE_TYPE', 'packageType không hợp lệ');
  if (!PRICING_UNITS.includes(pricingUnit)) fail('INVALID_PRICING_UNIT', 'pricingUnit không hợp lệ');
  assertMoney(price, 'price');

  let result = price;

  if (pricingUnit === 'PER_PERSON') {
    assertPositiveInt(guestCount, 'guestCount');
    result = result * guestCount;
  }

  if (packageType === 'HOURLY') {
    assertPositiveInt(hours, 'hours');
    if (hours < minHours) fail('HOURS_BELOW_MIN', `Gói theo giờ tối thiểu ${minHours} giờ`);
    result = result * hours;
  }

  return assertMoney(result, 'package_price');
}

// ---------- 2. Phụ phí Inclusion (BR-B03) ----------

/**
 * Chỉ cộng PHẦN CHÊNH LỆCH vượt định mức; bằng/thấp hơn định mức thì phụ phí = 0.
 * subsidyLimit = null/undefined: quyền lợi không có định mức -> không phát sinh phụ phí.
 *
 * @param {Array<{unitPrice:number, quantity:number, subsidyLimit?:number|null}>} lines
 * @returns {{total:number, lines:Array<{unitPrice,quantity,subsidyLimit,surchargeAmount}>}}
 */
function calcInclusionSurcharge(lines = []) {
  if (!Array.isArray(lines)) fail('INVALID_INPUT', 'inclusions phải là mảng');

  const detail = lines.map((l) => {
    assertMoney(l.unitPrice, 'inclusion.unitPrice');
    assertPositiveInt(l.quantity, 'inclusion.quantity');
    const limit = l.subsidyLimit == null ? null : assertMoney(l.subsidyLimit, 'inclusion.subsidyLimit');
    const surchargeAmount = limit == null ? 0 : Math.max(0, l.unitPrice - limit) * l.quantity;
    return { unitPrice: l.unitPrice, quantity: l.quantity, subsidyLimit: limit, surchargeAmount };
  });

  return { total: detail.reduce((s, l) => s + l.surchargeAmount, 0), lines: detail };
}

// ---------- 3. Add-on ----------

/**
 * Mọi Add-on: lineTotal = unitPrice × quantity (quantity là số nguyên >= 1).
 * `unit` vẫn được nhận/kiểm tra và trả lại để giữ giao diện cũ, nhưng KHÔNG còn
 * quyết định cách tính (trước đây PER_BOOKING bị ép quantity = 1).
 *
 * @param {Array<{unitPrice:number, quantity:number, unit?:'PER_ITEM'|'PER_BOOKING'}>} lines
 */
function calcAddonTotal(lines = []) {
  if (!Array.isArray(lines)) fail('INVALID_INPUT', 'addons phải là mảng');

  const detail = lines.map((l) => {
    const unit = l.unit || 'PER_ITEM';
    if (!ADDON_UNITS.includes(unit)) fail('INVALID_ADDON_UNIT', 'addon.unit không hợp lệ');
    assertMoney(l.unitPrice, 'addon.unitPrice');
    const quantity = assertPositiveInt(l.quantity, 'addon.quantity');
    return { unit, unitPrice: l.unitPrice, quantity, lineTotal: l.unitPrice * quantity };
  });

  return { total: detail.reduce((s, l) => s + l.lineTotal, 0), lines: detail };
}

// ---------- 4. Voucher (trừ trước) ----------

/**
 * Không bao giờ vượt subtotal -> tổng tiền không âm.
 * PERCENT: floor(subtotal × value / 100). FIXED_AMOUNT: value (bị chặn bởi subtotal).
 *
 * @param {{discountType:'PERCENT'|'FIXED_AMOUNT', discountValue:number}|null|undefined} voucher
 * @param {number} subtotal
 */
function calcVoucherDiscount(voucher, subtotal) {
  assertMoney(subtotal, 'subtotal');
  if (!voucher) return 0;

  if (!DISCOUNT_TYPES.includes(voucher.discountType)) fail('INVALID_DISCOUNT_TYPE', 'discountType không hợp lệ');
  if (!Number.isSafeInteger(voucher.discountValue) || voucher.discountValue <= 0) {
    fail('INVALID_DISCOUNT_VALUE', 'discountValue phải là số nguyên dương');
  }

  let discount;
  if (voucher.discountType === 'PERCENT') {
    if (voucher.discountValue > 100) fail('INVALID_DISCOUNT_VALUE', 'Giảm theo % không vượt quá 100');
    discount = Math.floor((subtotal * voucher.discountValue) / 100);
  } else {
    discount = voucher.discountValue;
  }

  return Math.min(discount, subtotal);
}

// ---------- 5. Giảm theo hạng ----------

/** tier_discount = floor((subtotal − voucher_discount) × tier_rate) */
function calcTierDiscount(subtotal, voucherDiscount, tierRate) {
  assertMoney(subtotal, 'subtotal');
  assertMoney(voucherDiscount, 'voucherDiscount');
  if (voucherDiscount > subtotal) fail('INVALID_AMOUNT', 'voucherDiscount không được vượt subtotal');
  const bp = rateToBasisPoint(tierRate ?? 0, 'tierRate');
  return floorByBasisPoint(subtotal - voucherDiscount, bp);
}

// ---------- 6. Tổng hợp ----------

/**
 * @param {object} input
 * @param {object} input.package      Xem calcPackagePrice
 * @param {Array}  [input.inclusions]
 * @param {Array}  [input.addons]
 * @param {object} [input.voucher]    { discountType, discountValue } (đã được service kiểm tra hợp lệ)
 * @param {number} [input.tierRate=0] Tỷ lệ giảm của hạng (0..1) – từ MEMBERSHIP_TIER.discount_rate
 */
function calculatePricing({ package: pkg, inclusions = [], addons = [], voucher = null, tierRate = 0 } = {}) {
  if (!pkg) fail('INVALID_INPUT', 'Thiếu thông tin package');

  const packagePrice = calcPackagePrice(pkg);
  const inclusion = calcInclusionSurcharge(inclusions);
  const addon = calcAddonTotal(addons);

  const subtotal = packagePrice + inclusion.total + addon.total;
  const voucherDiscount = calcVoucherDiscount(voucher, subtotal);
  const tierDiscount = calcTierDiscount(subtotal, voucherDiscount, tierRate);
  const discountAmount = voucherDiscount + tierDiscount;
  const finalAmount = subtotal - discountAmount;

  return {
    packagePrice,
    inclusionSurcharge: inclusion.total,
    addonTotal: addon.total,
    subtotal,
    voucherDiscount,
    tierRate: tierRate ?? 0,
    tierDiscount,
    discountAmount,
    finalAmount,
    inclusionLines: inclusion.lines,
    addonLines: addon.lines,
  };
}

/** Map kết quả sang tên trường phẳng của collection `bookings` (BR-B05). */
function toBookingSnapshot(r) {
  return {
    package_price: r.packagePrice,
    inclusion_surcharge: r.inclusionSurcharge,
    addon_total: r.addonTotal,
    subtotal: r.subtotal,
    voucher_discount: r.voucherDiscount,
    tier_rate: r.tierRate,
    tier_discount: r.tierDiscount,
    discount_amount: r.discountAmount,
    final_amount: r.finalAmount,
  };
}

/**
 * Đóng băng kết quả thành `price_snapshot` (BR-B05): đối tượng bất biến sâu, gồm
 * các trường phẳng của toBookingSnapshot + chi tiết từng dòng Inclusion / Add-on.
 * Service chỉ việc lưu `booking.price_snapshot = toPriceSnapshot(result)`; sau khi
 * tạo, giá không đổi dù bảng giá / hạng / Voucher thay đổi.
 */
function toPriceSnapshot(r) {
  return deepFreeze({
    ...toBookingSnapshot(r),
    inclusion_lines: r.inclusionLines.map((l) => ({
      unit_price: l.unitPrice,
      quantity: l.quantity,
      subsidy_limit: l.subsidyLimit,
      surcharge_amount: l.surchargeAmount,
    })),
    addon_lines: r.addonLines.map((l) => ({
      unit_price: l.unitPrice,
      quantity: l.quantity,
      line_total: l.lineTotal,
    })),
  });
}

// ---------- 7. Tương thích ngược: computePrice (giao diện cũ) ----------

/**
 * Giữ nguyên chữ ký & kiểu lỗi (RangeError) của `computePrice` cũ để code/test cũ
 * không phải sửa. KHÔNG có công thức riêng: sau khi kiểm tra đầu vào theo kiểu cũ,
 * chuyển sang `calculatePricing` (nguồn sự thật duy nhất).
 *
 * Khác với `calculatePricing`: nhận SỐ TIỀN đã tính sẵn cho phụ phí Inclusion và
 * Voucher, và hạng là số nguyên phần trăm 0..100 (tierPercent).
 * Code mới nên gọi `calculatePricing`; chuyển dần rồi bỏ hàm này khi không còn nơi gọi.
 *
 * @param {{packagePrice:number, inclusionSurcharge?:number,
 *          addons?:Array<{unitPrice:number, qty:number}>,
 *          voucherDiscount?:number, tierPercent?:number}} input
 * @returns {{subtotal,addonTotal,voucherDiscount,tierDiscount,discountAmount,finalAmount}}
 */
function computePrice({ packagePrice, inclusionSurcharge = 0, addons = [], voucherDiscount = 0, tierPercent = 0 }) {
  const legacyMoney = (v, name) => {
    if (!Number.isInteger(v) || v < 0) throw new RangeError(`${name} must be a non-negative integer VND`);
  };
  legacyMoney(packagePrice, 'packagePrice');
  legacyMoney(inclusionSurcharge, 'inclusionSurcharge');
  legacyMoney(voucherDiscount, 'voucherDiscount');
  if (!Number.isInteger(tierPercent) || tierPercent < 0 || tierPercent > 100) {
    throw new RangeError('tierPercent must be 0..100');
  }
  for (const a of addons) {
    legacyMoney(a.unitPrice, 'addon.unitPrice');
    if (!Number.isInteger(a.qty) || a.qty < 1) throw new RangeError('addon.qty must be integer >= 1');
  }

  const r = calculatePricing({
    package: { packageType: 'FIXED', pricingUnit: 'PER_SPACE', price: packagePrice },
    // phụ phí đã tính sẵn -> một dòng có định mức 0 nên toàn bộ số tiền là phụ phí
    inclusions: inclusionSurcharge > 0 ? [{ unitPrice: inclusionSurcharge, quantity: 1, subsidyLimit: 0 }] : [],
    addons: addons.map((a) => ({ unitPrice: a.unitPrice, quantity: a.qty, unit: 'PER_ITEM' })),
    voucher: voucherDiscount > 0 ? { discountType: 'FIXED_AMOUNT', discountValue: voucherDiscount } : null,
    tierRate: tierPercent / 100,
  });

  return {
    subtotal: r.subtotal,
    addonTotal: r.addonTotal,
    voucherDiscount: r.voucherDiscount,
    tierDiscount: r.tierDiscount,
    discountAmount: r.discountAmount,
    finalAmount: r.finalAmount,
  };
}

module.exports = {
  PricingError,
  calcPackagePrice,
  calcInclusionSurcharge,
  calcAddonTotal,
  calcVoucherDiscount,
  calcTierDiscount,
  calculatePricing,
  toBookingSnapshot,
  toPriceSnapshot,
  computePrice, // legacy – xem mục 7
};

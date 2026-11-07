'use strict';
// Dịch vụ nghiệp vụ Đặt không gian theo chuẩn BR-D01 (UC-04 → UC-10, UC-25 → UC-28, UC-36):
// Bước 1: Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách — UC-04, Read-only BR-C07)
// → Bước 2: Chọn Không gian (Space) & Gói dịch vụ (Package) + Book Now qua Auth Guard (UC-05, BR-A04)
// → Bước 3: Chọn món trong gói (Inclusion) & Dịch vụ mua thêm (Add-on) (UC-06, BR-B03)
// → Bước 4: Checkout — Xem Booking Summary, Áp dụng Voucher & Xác nhận giữ chỗ 15 phút (UC-07, UC-08)
// → Bước 5: Payment → Confirmation → Check-in → Sử dụng → Check-out (UC-09, UC-10, UC-25, UC-26).
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const {
  HOLD_MINUTES,
  MIN_LEAD_MINUTES,
  CANCEL_CUTOFF_MINUTES,
} = require('../config/constants');
const { checkAvailability } = require('../domain/availability');
const { computePrice } = require('../domain/pricing');
const { canTransition } = require('../domain/bookingStateMachine');
const { applyEarn } = require('../domain/loyalty');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh (UTC+7)
const HOUR_MS = 3600 * 1000;
const MIN_MS = 60 * 1000;

class BookingError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const toOid = (id, errCode = 'INVALID_ID', errMsg = 'ID không hợp lệ') => {
  if (id instanceof ObjectId) return id;
  const s = typeof id === 'string' ? id.trim() : '';
  if (!ObjectId.isValid(s) || s.length !== 24) throw new BookingError(400, errCode, errMsg);
  return new ObjectId(s);
};

// Chạy Multi-Document ACID Transaction; tự động retry khi gặp WriteConflict (code 112 / TransientTransactionError).
async function runInTransaction(db, _lockKey, fn) {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const session = db.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (err) {
      if (err && err.code === 112 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 5));
        continue;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}

// ---------- Thời gian & Khung giờ hoạt động (UTC+7) ----------
function parseHHMM(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function getOperatingBoundsUTC(space, startAtDate) {
  const vnTime = new Date(startAtDate.getTime() + VN_OFFSET_MS);
  const dayStartUtcMs =
    Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate(), 0, 0, 0, 0) -
    VN_OFFSET_MS;
  return {
    openAt: new Date(dayStartUtcMs + parseHHMM(space.open_time) * MIN_MS),
    closeAt: new Date(dayStartUtcMs + parseHHMM(space.close_time) * MIN_MS),
  };
}

// Tính [start_at, end_at, blocked_until, durationHours] theo loại gói (FIXED, HOURLY, is_full_day) và BR-C03, BR-C04.
function resolveTimeWindow({ space, pkg, startAt, endAt, hours }) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    throw new BookingError(400, 'INVALID_START_TIME', 'Thời gian bắt đầu không hợp lệ');
  }
  const { openAt, closeAt } = getOperatingBoundsUTC(space, start);
  let end;
  let durationHours;

  if (pkg.is_full_day) {
    end = closeAt;
    durationHours = (end.getTime() - start.getTime()) / HOUR_MS;
  } else if (pkg.package_type === 'FIXED') {
    durationHours = Number(pkg.duration_hours);
    end = new Date(start.getTime() + durationHours * HOUR_MS);
    if (endAt !== undefined && endAt !== null && endAt !== '') {
      const reqEnd = new Date(endAt);
      if (Number.isNaN(reqEnd.getTime()) || reqEnd.getTime() !== end.getTime()) {
        throw new BookingError(422, 'INVALID_DURATION', `Gói cố định yêu cầu đúng ${durationHours} giờ`);
      }
    }
  } else {
    let h = hours !== undefined && hours !== null ? Number(hours) : null;
    if (h === null && endAt) {
      const reqEnd = new Date(endAt);
      if (!Number.isNaN(reqEnd.getTime())) h = (reqEnd.getTime() - start.getTime()) / HOUR_MS;
    }
    const minH = Number(pkg.min_hours || 1);
    if (!Number.isInteger(h) || h < minH) {
      throw new BookingError(422, 'INVALID_DURATION', `Gói theo giờ yêu cầu số giờ nguyên từ ${minH} giờ trở lên`);
    }
    durationHours = h;
    end = new Date(start.getTime() + durationHours * HOUR_MS);
  }

  if (start.getTime() < openAt.getTime() || end.getTime() > closeAt.getTime() || end <= start) {
    throw new BookingError(
      422,
      'OUTSIDE_OPERATING_HOURS',
      `Thời gian đặt phải nằm trong khung mở cửa (${space.open_time} - ${space.close_time})`,
    );
  }

  const bufferMinutes = space.booking_mode === 'EXCLUSIVE' ? Number(space.buffer_minutes) : 0;
  const blockedUntil = new Date(end.getTime() + bufferMinutes * MIN_MS);
  return { startAt: start, endAt: end, blockedUntil, durationHours, bufferMinutes };
}

// ---------- Kiểm tra khung giờ trống & chống đặt trùng (Mini-spec 4.1.3) ----------
async function evaluateSpaceAvailability(
  db,
  { space, startAt, endAt, guests, excludeBookingId = null, now = new Date(), session = null },
) {
  const filter = {
    space_id: space._id,
    $or: [
      { status: { $in: ['CONFIRMED', 'CHECKED_IN'] } },
      { status: 'PENDING_PAYMENT', payment_expires_at: { $gt: now } },
    ],
  };
  if (excludeBookingId) filter._id = { $ne: toOid(excludeBookingId) };

  const activeBookings = await db
    .collection('bookings')
    .find(filter, session ? { session } : {})
    .toArray();

  const existing = activeBookings.map((b) => ({
    start: new Date(b.start_at).getTime(),
    end: new Date(b.end_at).getTime(),
    guests: Number(b.guest_count),
  }));

  const startMs = startAt.getTime();
  const endMs = endAt.getTime();
  const { openAt, closeAt } = getOperatingBoundsUTC(space, startAt);
  const result = checkAvailability({
    mode: space.booking_mode,
    start: startMs,
    end: endMs,
    guests: Number(guests),
    now: now.getTime(),
    openAt: openAt.getTime(),
    closeAt: closeAt.getTime(),
    space: {
      status: space.status,
      minGuests: Number(space.min_guests),
      maxGuests: Number(space.max_guests),
      capacity: Number(space.capacity),
      bufferMinutes: Number(space.buffer_minutes),
    },
    existing,
  });

  let remainingCapacity = 0;
  if (space.booking_mode === 'EXCLUSIVE') {
    remainingCapacity = result.ok ? Number(space.capacity) : 0;
  } else {
    const overlapping = existing.filter((b) => startMs < b.end && b.start < endMs);
    const points = new Set([startMs]);
    for (const b of overlapping) {
      if (b.start >= startMs && b.start < endMs) points.add(b.start);
    }
    let maxUsed = 0;
    for (const t of points) {
      const used = overlapping
        .filter((b) => b.start <= t && t < b.end)
        .reduce((s, b) => s + b.guests, 0);
      if (used > maxUsed) maxUsed = used;
    }
    remainingCapacity = Math.max(0, Number(space.capacity) - maxUsed);
  }

  return {
    ok: result.ok,
    reason: result.reason || null,
    remainingCapacity,
    activeCount: activeBookings.length,
  };
}

function calcBasePackagePrice(pkg, basePrice, guestCount, durationHours) {
  const p = Number(basePrice);
  const g = Number(guestCount);
  const h = Number(durationHours);
  if (pkg.package_type === 'FIXED') {
    return pkg.pricing_unit === 'PER_PERSON' ? p * g : p;
  }
  return pkg.pricing_unit === 'PER_PERSON' ? p * g * h : p * h;
}

// ---------- Bước 1 (UC-04, BR-D01(1), BR-C07): Khám phá & Kiểm tra chỗ trống (chọn Ngày, Giờ bắt đầu, Số khách) ----------
async function searchAvailableSpaces(
  db,
  {
    zoneId = null,
    startAt,
    endAt = null,
    hours = null,
    guestCount = 1,
    spaceType = null,
    bookingMode = null,
    minCapacity = null,
    maxPrice = null,
    now = new Date(),
  },
) {
  const start = new Date(startAt);
  if (!startAt || Number.isNaN(start.getTime())) {
    throw new BookingError(400, 'INVALID_START_TIME', 'Thời gian bắt đầu không hợp lệ');
  }
  const guests = Number(guestCount);
  if (!Number.isInteger(guests) || guests < 1) {
    throw new BookingError(422, 'INVALID_GUEST_COUNT', 'Số lượng khách không hợp lệ');
  }

  const spaceFilter = { status: 'ACTIVE' };
  if (zoneId) spaceFilter.zone_id = toOid(zoneId, 'INVALID_ZONE_ID', 'Mã khu vực không hợp lệ');
  if (spaceType) spaceFilter.space_type = String(spaceType);
  if (bookingMode) spaceFilter.booking_mode = String(bookingMode);
  if (minCapacity !== null && minCapacity !== undefined) {
    spaceFilter.capacity = { $gte: Number(minCapacity) };
  }

  const [spaces, zones, allPackages, allPrices, allInclusions] = await Promise.all([
    db.collection('spaces').find(spaceFilter).toArray(),
    db.collection('zones').find({ is_active: true, is_bookable: true }).toArray(),
    db.collection('packages').find({ is_active: true }).toArray(),
    db.collection('package_prices').find({}).toArray(),
    db.collection('package_inclusions').find({ is_active: true }).toArray(),
  ]);

  if (spaces.length > 0) {
    const { openAt, closeAt } = getOperatingBoundsUTC(spaces[0], start);
    if (start.getTime() < openAt.getTime() || start.getTime() >= closeAt.getTime()) {
      throw new BookingError(
        422,
        'OUTSIDE_OPERATING_HOURS',
        `Giờ bắt đầu phải nằm trong khung mở cửa (${spaces[0].open_time} - ${spaces[0].close_time})`,
      );
    }
  }

  const zoneMap = new Map(zones.map((z) => [String(z._id), z]));
  const pkgMap = new Map(allPackages.map((p) => [String(p._id), p]));
  const incByPkg = new Map();
  for (const inc of allInclusions) {
    const k = String(inc.package_id);
    if (!incByPkg.has(k)) incByPkg.set(k, []);
    incByPkg.get(k).push(inc);
  }
  const pricesBySpace = new Map();
  for (const pr of allPrices) {
    const k = String(pr.space_id);
    if (!pricesBySpace.has(k)) pricesBySpace.set(k, []);
    pricesBySpace.get(k).push(pr);
  }

  const maxP = maxPrice !== null && maxPrice !== undefined ? Number(maxPrice) : null;
  const results = [];

  for (const sp of spaces) {
    const zone = zoneMap.get(String(sp.zone_id));
    if (!zone || guests < sp.min_guests || guests > sp.max_guests) continue;

    const priceDocs = pricesBySpace.get(String(sp._id)) || [];
    const compatiblePackages = [];

    for (const pr of priceDocs) {
      const pkg = pkgMap.get(String(pr.package_id));
      if (!pkg || (maxP !== null && Number(pr.price) > maxP)) continue;

      const tw = resolveTimeWindow({
        space: sp,
        pkg,
        startAt: start,
        endAt,
        hours: pkg.package_type === 'HOURLY' ? hours || pkg.min_hours : undefined,
      });
      const pkgAvail = await evaluateSpaceAvailability(db, {
        space: sp,
        startAt: tw.startAt,
        endAt: tw.endAt,
        guests,
        now,
      });

      compatiblePackages.push({
        ...pkg,
        base_price: pr.price,
        package_price: calcBasePackagePrice(pkg, pr.price, guests, tw.durationHours),
        inclusions: incByPkg.get(String(pkg._id)) || [],
        isAvailable: pkgAvail.ok,
        availabilityReason: pkgAvail.reason,
        remainingCapacity: pkgAvail.remainingCapacity,
        startAt: tw.startAt,
        endAt: tw.endAt,
        blockedUntil: tw.blockedUntil,
        durationHours: tw.durationHours,
      });
    }

    const defaultEnd = endAt ? new Date(endAt) : new Date(start.getTime() + HOUR_MS);
    const spaceAvail = await evaluateSpaceAvailability(db, {
      space: sp,
      startAt: start,
      endAt: defaultEnd,
      guests,
      now,
    });
    const isAvailable = compatiblePackages.some((p) => p.isAvailable);

    results.push({
      ...sp,
      zone,
      isAvailable,
      availabilityReason: isAvailable ? null : spaceAvail.reason || 'OVERLAP',
      remainingCapacity: spaceAvail.remainingCapacity,
      packages: compatiblePackages,
    });
  }

  return results;
}

// ---------- Bước 2, 3, 4: Chọn Space & Package (UC-05), Chọn Inclusion & Add-on (UC-06), Voucher (UC-07) ----------
async function buildBookingQuote(
  db,
  {
    spaceId,
    packageId,
    startAt,
    endAt,
    hours,
    guestCount,
    inclusions = [],
    addons = [],
    voucherCode = null,
    user = null,
    now = new Date(),
    session = null,
  },
) {
  const opts = session ? { session } : {};
  const sOid = toOid(spaceId, 'INVALID_SPACE_ID', 'Mã không gian không hợp lệ');
  const pOid = toOid(packageId, 'INVALID_PACKAGE_ID', 'Mã gói dịch vụ không hợp lệ');

  const [space, pkg, pkgPriceDoc] = await Promise.all([
    db.collection('spaces').findOne({ _id: sOid }, opts),
    db.collection('packages').findOne({ _id: pOid }, opts),
    db.collection('package_prices').findOne({ space_id: sOid, package_id: pOid }, opts),
  ]);

  if (!space || space.status !== 'ACTIVE') {
    throw new BookingError(404, 'SPACE_NOT_AVAILABLE', 'Không gian không tồn tại hoặc đang tạm ngưng');
  }
  const zone = await db.collection('zones').findOne({ _id: space.zone_id }, opts);
  if (!zone || !zone.is_active || !zone.is_bookable) {
    throw new BookingError(422, 'ZONE_NOT_BOOKABLE', 'Khu vực này không hỗ trợ đặt chỗ');
  }
  if (!pkg || !pkg.is_active || String(pkg.zone_id) !== String(space.zone_id) || !pkgPriceDoc) {
    throw new BookingError(422, 'PACKAGE_INCOMPATIBLE', 'Gói dịch vụ không tương thích với không gian đã chọn');
  }

  const guests = Number(guestCount);
  if (!Number.isInteger(guests) || guests < space.min_guests || guests > space.max_guests) {
    throw new BookingError(
      422,
      'INVALID_GUEST_COUNT',
      `Số lượng khách phải từ ${space.min_guests} đến ${space.max_guests} người`,
    );
  }

  const timeWindow = resolveTimeWindow({ space, pkg, startAt, endAt, hours });
  const packagePrice = calcBasePackagePrice(
    pkg,
    pkgPriceDoc.price,
    guests,
    timeWindow.durationHours,
  );

  const pkgInclusions = await db
    .collection('package_inclusions')
    .find({ package_id: pkg._id, is_active: true }, opts)
    .toArray();

  const fixedInclusionsSnapshot = [];
  const selectableInclusions = [];
  const selectableMap = new Map();
  for (const inc of pkgInclusions) {
    const minH = Number(inc.min_hours_required || 0);
    const allowedQty =
      timeWindow.durationHours >= minH
        ? Number(inc.quantity) * (inc.quantity_basis === 'PER_GUEST' ? guests : 1)
        : 0;
    if (inc.item_type === 'WATER' || inc.item_type === 'EQUIPMENT') {
      if (allowedQty > 0) {
        fixedInclusionsSnapshot.push({
          item_type: inc.item_type,
          label: inc.label,
          quantity: allowedQty,
        });
      }
    } else {
      selectableMap.set(String(inc._id), { inc, allowedQty, usedQty: 0 });
      selectableInclusions.push({
        package_inclusion_id: inc._id,
        item_type: inc.item_type,
        label: inc.label,
        allowed_quantity: allowedQty,
        subsidy_limit: inc.subsidy_limit,
      });
    }
  }

  const inclusionDocs = [];
  for (const item of inclusions) {
    const qty = Number(item && item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new BookingError(400, 'INVALID_INCLUSION_QTY', 'Số lượng món đi kèm không hợp lệ');
    }
    const piOid = toOid(item.packageInclusionId || item.package_inclusion_id, 'INVALID_INCLUSION_ID');
    const prodOid = toOid(item.productId || item.product_id, 'INVALID_PRODUCT_ID');
    const slot = selectableMap.get(String(piOid));
    if (!slot) {
      throw new BookingError(422, 'INCLUSION_NOT_IN_PACKAGE', 'Quyền lợi không thuộc gói đã chọn');
    }
    if (slot.usedQty + qty > slot.allowedQty) {
      throw new BookingError(422, 'INCLUSION_QUOTA_EXCEEDED', 'Số lượng chọn vượt quá định mức quyền lợi');
    }
    const product = await db.collection('products').findOne({ _id: prodOid, is_active: true }, opts);
    if (!product) {
      throw new BookingError(404, 'PRODUCT_NOT_FOUND', 'Món đi kèm không tồn tại hoặc đã ngừng bán');
    }
    const expectedCategory = slot.inc.item_type === 'STANDARD_DRINK' ? 'DRINK' : 'PASTRY';
    if (product.category !== expectedCategory) {
      throw new BookingError(422, 'INCLUSION_CATEGORY_MISMATCH', 'Món đã chọn không đúng nhóm quyền lợi');
    }

    let unitPrice = Number(product.price);
    const variantStr = typeof item.variant === 'string' ? item.variant.trim() : '';
    if (variantStr) {
      const matched = (product.variants || []).find((v) => v.name === variantStr);
      if (!matched) {
        throw new BookingError(422, 'INVALID_PRODUCT_VARIANT', 'Biến thể sản phẩm không hợp lệ');
      }
      unitPrice = Number(matched.price);
    }

    slot.usedQty += qty;
    const subsidyLimit = slot.inc.subsidy_limit !== null ? Number(slot.inc.subsidy_limit) : null;
    const surchargeAmount =
      subsidyLimit !== null ? Math.max(0, unitPrice - subsidyLimit) * qty : 0;

    inclusionDocs.push({
      product_id: product._id,
      package_inclusion_id: slot.inc._id,
      product_name: product.name,
      ...(variantStr ? { variant: variantStr } : {}),
      unit_price: unitPrice,
      subsidy_limit: subsidyLimit,
      quantity: qty,
      surcharge_amount: surchargeAmount,
    });
  }

  const addonDocs = [];
  const pricingAddons = [];
  const seenPerBookingAddon = new Set();

  for (const item of addons) {
    const qty = Number(item && item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new BookingError(400, 'INVALID_ADDON_QTY', 'Số lượng Add-on không hợp lệ');
    }
    const addonOid = toOid(item.addonId || item.addon_id, 'INVALID_ADDON_ID');
    const addon = await db.collection('addons').findOne({ _id: addonOid, is_active: true }, opts);
    if (!addon) {
      throw new BookingError(404, 'ADDON_NOT_FOUND', 'Dịch vụ cộng thêm không tồn tại hoặc ngừng phục vụ');
    }
    if (addon.unit === 'PER_BOOKING') {
      if (qty !== 1 || seenPerBookingAddon.has(String(addon._id))) {
        throw new BookingError(422, 'ADDON_PER_BOOKING_LIMIT', 'Dịch vụ này chỉ tính tối đa 1 lần mỗi đơn');
      }
      seenPerBookingAddon.add(String(addon._id));
    }

    let unitPrice = Number(addon.price);
    const variantStr = typeof item.variant === 'string' ? item.variant.trim() : '';
    if (variantStr) {
      const matched = (addon.variants || []).find((v) => v.name === variantStr);
      if (!matched) {
        throw new BookingError(422, 'INVALID_ADDON_VARIANT', 'Biến thể Add-on không hợp lệ');
      }
      unitPrice = Number(matched.price);
    }

    addonDocs.push({
      addon_id: addon._id,
      addon_name: addon.name,
      ...(variantStr ? { variant: variantStr } : {}),
      unit: addon.unit,
      unit_price: unitPrice,
      quantity: qty,
      line_total: unitPrice * qty,
    });
    pricingAddons.push({ unitPrice, qty });
  }

  const inclusionSurcharge = inclusionDocs.reduce((sum, d) => sum + d.surcharge_amount, 0);
  const rawPrice = computePrice({
    packagePrice,
    inclusionSurcharge,
    addons: pricingAddons,
    voucherDiscount: 0,
    tierPercent: 0,
  });

  let voucherDoc = null;
  let userVoucherDoc = null;
  let rawVoucherDiscount = 0;
  const cleanCode = typeof voucherCode === 'string' ? voucherCode.trim().toUpperCase() : '';
  if (cleanCode) {
    voucherDoc = await db.collection('vouchers').findOne({ code: cleanCode }, opts);
    if (!voucherDoc || voucherDoc.status !== 'ACTIVE') {
      throw new BookingError(422, 'VOUCHER_INVALID', 'Mã ưu đãi không tồn tại hoặc đã ngừng áp dụng');
    }
    if (now < new Date(voucherDoc.valid_from) || now > new Date(voucherDoc.valid_to)) {
      throw new BookingError(422, 'VOUCHER_EXPIRED', 'Mã ưu đãi chưa đến hạn hoặc đã hết hạn sử dụng');
    }
    if (Number(voucherDoc.usage_count) >= Number(voucherDoc.usage_limit)) {
      throw new BookingError(422, 'VOUCHER_USAGE_LIMIT', 'Mã ưu đãi đã hết lượt sử dụng');
    }
    if (rawPrice.subtotal < Number(voucherDoc.min_order_value)) {
      throw new BookingError(422, 'VOUCHER_MIN_ORDER', 'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã');
    }
    if (Number(voucherDoc.coins_cost) > 0) {
      if (!user) {
        throw new BookingError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để dùng mã ưu đãi đổi bằng KÉN Coins');
      }
      userVoucherDoc = await db.collection('user_vouchers').findOne(
        { user_id: user._id, voucher_id: voucherDoc._id, used_booking_id: null },
        { sort: { redeemed_at: 1 }, ...opts },
      );
      if (!userVoucherDoc) {
        throw new BookingError(422, 'VOUCHER_NOT_OWNED', 'Bạn chưa quy đổi mã ưu đãi này hoặc đã dùng hết lượt');
      }
    }
    rawVoucherDiscount =
      voucherDoc.discount_type === 'PERCENT'
        ? Math.floor((rawPrice.subtotal * Number(voucherDoc.discount_value)) / 100)
        : Number(voucherDoc.discount_value);
  }

  let tierCode = 'BASIC';
  let tierRate = 0.0;
  if (user && user.tier_id) {
    const tierDoc = await db.collection('membership_tiers').findOne({ _id: user.tier_id }, opts);
    if (tierDoc) {
      tierCode = tierDoc.code;
      tierRate = Number(tierDoc.discount_rate);
    }
  }

  const computed = computePrice({
    packagePrice,
    inclusionSurcharge,
    addons: pricingAddons,
    voucherDiscount: rawVoucherDiscount,
    tierPercent: Math.round(tierRate * 100),
  });

  return {
    zone,
    space,
    pkg,
    baseUnitPrice: pkgPriceDoc.price,
    timeWindow,
    guests,
    fixedInclusionsSnapshot,
    selectableInclusions,
    inclusionDocs,
    addonDocs,
    voucherDoc,
    userVoucherDoc,
    tierCode,
    tierRate,
    pricing: { packagePrice, inclusionSurcharge, ...computed },
  };
}

// Bước 2 (UC-05, BR-D01(2), BR-A04): Chọn Không gian (Space) & Gói dịch vụ (Package), kiểm tra tương thích & giờ trống toàn gói
async function selectSpaceAndPackage(
  db,
  { spaceId, packageId, startAt, endAt = null, hours = null, guestCount = 1, now = new Date() },
) {
  const quote = await buildBookingQuote(db, {
    spaceId,
    packageId,
    startAt,
    endAt,
    hours,
    guestCount,
    now,
  });
  const avail = await evaluateSpaceAvailability(db, {
    space: quote.space,
    startAt: quote.timeWindow.startAt,
    endAt: quote.timeWindow.endAt,
    guests: quote.guests,
    now,
  });
  if (!avail.ok) {
    throw new BookingError(
      409,
      avail.reason || 'OVERLAP',
      'Khung giờ đã chọn không còn đủ chỗ trống cho gói dịch vụ này',
    );
  }
  return {
    ok: true,
    space: quote.space,
    zone: quote.zone,
    pkg: quote.pkg,
    guestCount: quote.guests,
    startAt: quote.timeWindow.startAt,
    endAt: quote.timeWindow.endAt,
    blockedUntil: quote.timeWindow.blockedUntil,
    durationHours: quote.timeWindow.durationHours,
    remainingCapacity: avail.remainingCapacity,
    baseUnitPrice: quote.baseUnitPrice,
    packagePrice: quote.pricing.packagePrice,
    fixedInclusionsSnapshot: quote.fixedInclusionsSnapshot,
    selectableInclusions: quote.selectableInclusions,
  };
}

function generateBookingCode(now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const yy = String(vn.getUTCFullYear()).slice(-2);
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `BK${yy}${mm}${dd}${rand}`;
}

async function releaseVoucherIfNeeded(db, booking, now, session) {
  if (!booking.voucher_id || booking.voucher_usage_released) return false;
  const opts = session ? { session } : {};
  await db.collection('vouchers').updateOne(
    { _id: booking.voucher_id, usage_count: { $gt: 0 } },
    { $inc: { usage_count: -1 }, $set: { updated_at: now } },
    opts,
  );
  await db.collection('user_vouchers').updateOne(
    { used_booking_id: booking._id },
    { $set: { used_booking_id: null, used_at: null } },
    opts,
  );
  return true;
}

// ---------- Bước 4 (UC-08): Checkout — Xác nhận Booking Summary & giữ chỗ 15 phút ----------
async function createBooking(
  db,
  {
    user,
    spaceId,
    packageId,
    startAt,
    endAt,
    hours,
    guestCount,
    inclusions = [],
    addons = [],
    voucherCode = null,
    expectedFinalAmount = undefined,
    now = new Date(),
  },
) {
  if (!user || user.status !== 'ACTIVE') {
    throw new BookingError(401, 'UNAUTHENTICATED', 'Tài khoản không hợp lệ hoặc đã bị khóa');
  }
  const sOid = toOid(spaceId, 'INVALID_SPACE_ID', 'Mã không gian không hợp lệ');

  return runInTransaction(db, `space:${String(sOid)}`, async (session) => {
    const opts = { session };
    const lockRes = await db.collection('spaces').updateOne(
      { _id: sOid, status: 'ACTIVE' },
      { $inc: { lock_version: 1 }, $set: { updated_at: now } },
      opts,
    );
    if (lockRes.matchedCount === 0) {
      throw new BookingError(404, 'SPACE_NOT_AVAILABLE', 'Không gian không tồn tại hoặc đang bảo trì');
    }

    const quote = await buildBookingQuote(db, {
      spaceId: sOid,
      packageId,
      startAt,
      endAt,
      hours,
      guestCount,
      inclusions,
      addons,
      voucherCode,
      user,
      now,
      session,
    });

    if (quote.timeWindow.startAt.getTime() - now.getTime() < MIN_LEAD_MINUTES * MIN_MS) {
      throw new BookingError(
        422,
        'LEAD_TIME_VIOLATION',
        `Thời điểm bắt đầu phải cách thời điểm đặt tối thiểu ${MIN_LEAD_MINUTES} phút`,
      );
    }

    const avail = await evaluateSpaceAvailability(db, {
      space: quote.space,
      startAt: quote.timeWindow.startAt,
      endAt: quote.timeWindow.endAt,
      guests: quote.guests,
      now,
      session,
    });
    if (!avail.ok) {
      throw new BookingError(
        409,
        avail.reason || 'OVERLAP',
        'Khung giờ đã có người đặt hoặc không đủ sức chứa',
        { reason: avail.reason, remainingCapacity: avail.remainingCapacity },
      );
    }

    if (
      expectedFinalAmount !== undefined &&
      expectedFinalAmount !== null &&
      Number(expectedFinalAmount) !== quote.pricing.finalAmount
    ) {
      throw new BookingError(
        409,
        'PRICE_CHANGED',
        'Tổng tiền đơn hàng đã thay đổi, vui lòng xác nhận lại bảng giá mới',
        { pricing: quote.pricing },
      );
    }

    const bookingId = new ObjectId();

    if (quote.voucherDoc) {
      await db.collection('vouchers').updateOne(
        { _id: quote.voucherDoc._id, status: 'ACTIVE', usage_count: { $lt: quote.voucherDoc.usage_limit } },
        { $inc: { usage_count: 1 }, $set: { updated_at: now } },
        opts,
      );
      if (quote.userVoucherDoc) {
        await db.collection('user_vouchers').updateOne(
          { _id: quote.userVoucherDoc._id, used_booking_id: null },
          { $set: { used_booking_id: bookingId, used_at: now } },
          opts,
        );
      }
    }

    const paymentExpiresAt = new Date(now.getTime() + HOLD_MINUTES * MIN_MS);
    const bookingCode = generateBookingCode(now);

    const bookingDoc = {
      _id: bookingId,
      booking_code: bookingCode,
      user_id: user._id,
      space_id: quote.space._id,
      zone_id: quote.zone._id,
      package_id: quote.pkg._id,
      zone_name: quote.zone.name,
      package_name: quote.pkg.name,
      space_name: quote.space.name,
      fixed_inclusions_snapshot: quote.fixedInclusionsSnapshot,
      start_at: quote.timeWindow.startAt,
      end_at: quote.timeWindow.endAt,
      blocked_until: quote.timeWindow.blockedUntil,
      guest_count: quote.guests,
      status: 'PENDING_PAYMENT',
      created_at: now,
      payment_expires_at: paymentExpiresAt,
      confirmed_at: null,
      checked_in_at: null,
      checked_out_at: null,
      cancelled_at: null,
      expired_at: null,
      no_show_at: null,
      package_price: quote.pricing.packagePrice,
      inclusion_surcharge: quote.pricing.inclusionSurcharge,
      addon_total: quote.pricing.addonTotal,
      subtotal: quote.pricing.subtotal,
      voucher_id: quote.voucherDoc ? quote.voucherDoc._id : null,
      ...(quote.voucherDoc ? { voucher_code: quote.voucherDoc.code } : {}),
      voucher_discount: quote.pricing.voucherDiscount,
      tier_code: quote.tierCode,
      tier_rate: quote.tierRate,
      tier_discount: quote.pricing.tierDiscount,
      discount_amount: quote.pricing.discountAmount,
      final_amount: quote.pricing.finalAmount,
      voucher_usage_released: false,
      refund_status: 'NONE',
      refund_amount: 0,
      updated_at: now,
    };

    await db.collection('bookings').insertOne(bookingDoc, opts);

    if (quote.inclusionDocs.length > 0) {
      await db.collection('booking_inclusions').insertMany(
        quote.inclusionDocs.map((d) => ({ _id: new ObjectId(), booking_id: bookingId, ...d })),
        opts,
      );
    }
    if (quote.addonDocs.length > 0) {
      await db.collection('booking_addons').insertMany(
        quote.addonDocs.map((d) => ({ _id: new ObjectId(), booking_id: bookingId, ...d })),
        opts,
      );
    }

    return bookingDoc;
  });
}

const toSmBooking = (b) => ({
  status: b.status,
  startAt: new Date(b.start_at).getTime(),
  paymentExpiresAt: new Date(b.payment_expires_at).getTime(),
});

// ---------- Bước 5: Payment -> Confirmation (UC-09, UC-10, BR-E01 -> BR-E07) ----------
async function payBooking(db, { bookingId, user, result = 'SUCCESS', now = new Date() }) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
  if (String(booking.user_id) !== String(user._id)) {
    throw new BookingError(403, 'FORBIDDEN', 'Bạn không có quyền thanh toán đơn này');
  }

  const check = canTransition(toSmBooking(booking), 'CONFIRMED', 'PAYMENT', now.getTime());
  if (!check.ok) {
    throw new BookingError(409, check.reason, 'Đơn đặt chỗ không hợp lệ hoặc đã quá hạn giữ chỗ 15 phút');
  }

  const simResult = String(result).toUpperCase();
  const isFree = Number(booking.final_amount) === 0;
  const method = isFree ? 'NONE' : 'SIMULATION';
  const gatewayRef = `MOCK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

  if (!isFree && simResult === 'FAILED') {
    const failedTxn = {
      _id: new ObjectId(),
      booking_id: booking._id,
      txn_type: 'PAYMENT',
      status: 'FAILED',
      method: 'SIMULATION',
      amount: booking.final_amount,
      gateway_ref: gatewayRef,
      created_at: now,
      completed_at: now,
    };
    await db.collection('payment_transactions').insertOne(failedTxn);
    return { booking, transaction: failedTxn };
  }

  return runInTransaction(db, `booking:${String(bOid)}`, async (session) => {
    const opts = { session };
    await db.collection('bookings').updateOne(
      { _id: bOid, status: 'PENDING_PAYMENT', payment_expires_at: { $gt: now } },
      { $set: { status: 'CONFIRMED', confirmed_at: now, updated_at: now } },
      opts,
    );

    const txn = {
      _id: new ObjectId(),
      booking_id: bOid,
      txn_type: 'PAYMENT',
      status: 'SUCCESS',
      method,
      amount: booking.final_amount,
      gateway_ref: gatewayRef,
      created_at: now,
      completed_at: now,
    };
    await db.collection('payment_transactions').insertOne(txn, opts);
    const updatedBooking = await db.collection('bookings').findOne({ _id: bOid }, opts);

    console.log(
      `[SMS-MOCK] Xac nhan dat cho thanh cong. Ma dat cho: ${updatedBooking.booking_code} (${updatedBooking.space_name})`,
    );
    return {
      booking: updatedBooking,
      transaction: txn,
      confirmation: {
        bookingCode: updatedBooking.booking_code,
        status: updatedBooking.status,
        confirmedAt: updatedBooking.confirmed_at,
        spaceName: updatedBooking.space_name,
        packageName: updatedBooking.package_name,
        zoneName: updatedBooking.zone_name,
        startAt: updatedBooking.start_at,
        endAt: updatedBooking.end_at,
        guestCount: updatedBooking.guest_count,
        finalAmount: updatedBooking.final_amount,
        smsDispatched: true,
      },
    };
  });
}

// ---------- Hủy đặt chỗ (UC-11, UC-12, UC-14, BR-D04, BR-G01, BR-G02) ----------
async function cancelBooking(
  db,
  { bookingId, user, refundResult = 'SUCCESS', now = new Date() },
) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
  if (String(booking.user_id) !== String(user._id)) {
    throw new BookingError(403, 'FORBIDDEN', 'Bạn không có quyền hủy đơn này');
  }

  const check = canTransition(toSmBooking(booking), 'CANCELLED', 'CUSTOMER', now.getTime());
  if (!check.ok) {
    throw new BookingError(409, check.reason, 'Không thể hủy đơn ở thời điểm hiện tại');
  }

  return runInTransaction(db, `space:${String(booking.space_id)}`, async (session) => {
    const opts = { session };
    const fresh = await db.collection('bookings').findOne({ _id: bOid }, opts);
    const released = await releaseVoucherIfNeeded(db, fresh, now, session);
    const needsRefund = fresh.status === 'CONFIRMED' && Number(fresh.final_amount) > 0;

    let refundStatus = 'NONE';
    let refundAmount = 0;
    let refundTxn = null;

    if (needsRefund) {
      refundAmount = Number(fresh.final_amount);
      const outcome = String(refundResult).toUpperCase();
      const txnStatus =
        outcome === 'FAILED' ? 'FAILED' : outcome === 'PENDING' ? 'PENDING' : 'SUCCESS';
      refundStatus =
        txnStatus === 'SUCCESS'
          ? 'REFUNDED'
          : txnStatus === 'FAILED'
            ? 'FAILED'
            : 'PROCESSING';

      refundTxn = {
        _id: new ObjectId(),
        booking_id: bOid,
        txn_type: 'REFUND',
        status: txnStatus,
        method: 'SIMULATION',
        amount: refundAmount,
        gateway_ref: `MOCK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        created_at: now,
        completed_at: txnStatus === 'PENDING' ? null : now,
      };
      await db.collection('payment_transactions').insertOne(refundTxn, opts);
    }

    await db.collection('bookings').updateOne(
      { _id: bOid },
      {
        $set: {
          status: 'CANCELLED',
          cancelled_at: now,
          refund_status: refundStatus,
          refund_amount: refundAmount,
          ...(released ? { voucher_usage_released: true } : {}),
          updated_at: now,
        },
      },
      opts,
    );

    const updated = await db.collection('bookings').findOne({ _id: bOid }, opts);
    return { booking: updated, refundTransaction: refundTxn };
  });
}

// ---------- Đổi giờ đặt chỗ (UC-13, UC-15, BR-G01, BR-G03) ----------
async function rescheduleBooking(db, { bookingId, user, newStartAt, now = new Date() }) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
  if (String(booking.user_id) !== String(user._id)) {
    throw new BookingError(403, 'FORBIDDEN', 'Bạn không có quyền đổi lịch đơn này');
  }
  if (booking.status !== 'CONFIRMED') {
    throw new BookingError(409, 'INVALID_TRANSITION', 'Chỉ đơn đã xác nhận (CONFIRMED) mới được đổi lịch');
  }
  if (
    now.getTime() >
    new Date(booking.start_at).getTime() - CANCEL_CUTOFF_MINUTES * MIN_MS
  ) {
    throw new BookingError(409, 'PAST_CUTOFF', 'Đã quá thời hạn Cut-off đổi lịch');
  }

  const reqStart = new Date(newStartAt);
  if (Number.isNaN(reqStart.getTime())) {
    throw new BookingError(400, 'INVALID_START_TIME', 'Thời gian bắt đầu mới không hợp lệ');
  }
  if (reqStart.getTime() - now.getTime() < MIN_LEAD_MINUTES * MIN_MS) {
    throw new BookingError(422, 'LEAD_TIME_VIOLATION', 'Giờ bắt đầu mới phải cách hiện tại tối thiểu 30 phút');
  }

  return runInTransaction(db, `space:${String(booking.space_id)}`, async (session) => {
    const opts = { session };
    await db.collection('spaces').updateOne(
      { _id: booking.space_id, status: 'ACTIVE' },
      { $inc: { lock_version: 1 }, $set: { updated_at: now } },
      opts,
    );

    const [freshBooking, space, pkg] = await Promise.all([
      db.collection('bookings').findOne({ _id: bOid }, opts),
      db.collection('spaces').findOne({ _id: booking.space_id }, opts),
      db.collection('packages').findOne({ _id: booking.package_id }, opts),
    ]);

    const origDurationHours =
      (new Date(freshBooking.end_at).getTime() - new Date(freshBooking.start_at).getTime()) /
      HOUR_MS;
    const { openAt, closeAt } = getOperatingBoundsUTC(space, reqStart);
    const newEnd =
      pkg && pkg.is_full_day
        ? closeAt
        : new Date(reqStart.getTime() + origDurationHours * HOUR_MS);

    if (reqStart < openAt || newEnd > closeAt || newEnd <= reqStart) {
      throw new BookingError(422, 'OUTSIDE_OPERATING_HOURS', 'Khung giờ mới nằm ngoài giờ mở cửa');
    }

    const avail = await evaluateSpaceAvailability(db, {
      space,
      startAt: reqStart,
      endAt: newEnd,
      guests: freshBooking.guest_count,
      excludeBookingId: freshBooking._id,
      now,
      session,
    });
    if (!avail.ok) {
      throw new BookingError(409, avail.reason || 'OVERLAP', 'Khung giờ mới đã có người đặt hoặc không đủ sức chứa');
    }

    const bufMin = space.booking_mode === 'EXCLUSIVE' ? Number(space.buffer_minutes) : 0;
    const newBlockedUntil = new Date(newEnd.getTime() + bufMin * MIN_MS);

    await db.collection('bookings').updateOne(
      { _id: bOid, status: 'CONFIRMED' },
      {
        $set: {
          start_at: reqStart,
          end_at: newEnd,
          blocked_until: newBlockedUntil,
          updated_at: now,
        },
      },
      opts,
    );

    return db.collection('bookings').findOne({ _id: bOid }, opts);
  });
}

// ---------- Vận hành tại quầy & Hệ thống: Check-in, Check-out, No-show, Hết hạn giữ chỗ ----------
async function checkInBooking(db, { bookingId, now = new Date() }) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');

  const check = canTransition(toSmBooking(booking), 'CHECKED_IN', 'ADMIN', now.getTime());
  if (!check.ok) {
    throw new BookingError(409, check.reason, 'Không thể Check-in đơn ở thời điểm hiện tại');
  }

  await db.collection('bookings').updateOne(
    { _id: bOid, status: 'CONFIRMED' },
    { $set: { status: 'CHECKED_IN', checked_in_at: now, updated_at: now } },
  );
  return db.collection('bookings').findOne({ _id: bOid });
}

async function checkOutBooking(db, { bookingId, now = new Date() }) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');

  const check = canTransition(toSmBooking(booking), 'CHECKED_OUT', 'ADMIN', now.getTime());
  if (!check.ok) {
    throw new BookingError(409, check.reason, 'Chỉ đơn đang CHECKED_IN mới có thể Check-out');
  }

  return runInTransaction(db, `booking:${String(bOid)}`, async (session) => {
    const opts = { session };
    await db.collection('bookings').updateOne(
      { _id: bOid, status: 'CHECKED_IN' },
      { $set: { status: 'CHECKED_OUT', checked_out_at: now, updated_at: now } },
      opts,
    );

    const user = await db.collection('users').findOne({ _id: booking.user_id }, opts);
    if (user) {
      const currentTier = user.tier_id
        ? await db.collection('membership_tiers').findOne({ _id: user.tier_id }, opts)
        : null;
      const earnRes = applyEarn(
        {
          tier: currentTier ? currentTier.code : 'BASIC',
          tierPoints: Number(user.tier_points),
          coins: Number(user.coin_balance),
        },
        Number(booking.final_amount),
      );
      const newTierDoc = await db.collection('membership_tiers').findOne({ code: earnRes.tier }, opts);
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            tier_points: earnRes.tierPoints,
            coin_balance: earnRes.coins,
            tier_id: newTierDoc._id,
            updated_at: now,
          },
        },
        opts,
      );
      await db.collection('loyalty_transactions').insertOne(
        {
          _id: new ObjectId(),
          user_id: user._id,
          booking_id: bOid,
          type: 'EARN',
          points_delta: earnRes.earned.points,
          coins_delta: earnRes.earned.coins,
          points_after: earnRes.tierPoints,
          coins_after: earnRes.coins,
          created_at: now,
        },
        opts,
      );
    }

    return db.collection('bookings').findOne({ _id: bOid }, opts);
  });
}

async function markNoShowBooking(db, { bookingId, now = new Date() }) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');

  const check = canTransition(toSmBooking(booking), 'NO_SHOW', 'ADMIN', now.getTime());
  if (!check.ok) {
    throw new BookingError(409, check.reason, 'Chỉ có thể đánh dấu NO_SHOW sau 30 phút kể từ giờ bắt đầu');
  }

  await db.collection('bookings').updateOne(
    { _id: bOid, status: 'CONFIRMED' },
    { $set: { status: 'NO_SHOW', no_show_at: now, updated_at: now } },
  );
  return db.collection('bookings').findOne({ _id: bOid });
}

async function expirePendingBookings(db, { now = new Date() } = {}) {
  const expiredCandidates = await db
    .collection('bookings')
    .find({ status: 'PENDING_PAYMENT', payment_expires_at: { $lte: now } })
    .toArray();

  let expiredCount = 0;
  for (const b of expiredCandidates) {
    await runInTransaction(db, `booking:${String(b._id)}`, async (session) => {
      const opts = { session };
      const fresh = await db.collection('bookings').findOne({ _id: b._id }, opts);
      const released = await releaseVoucherIfNeeded(db, fresh, now, session);
      const upd = await db.collection('bookings').updateOne(
        { _id: b._id, status: 'PENDING_PAYMENT' },
        {
          $set: {
            status: 'EXPIRED',
            expired_at: now,
            ...(released ? { voucher_usage_released: true } : {}),
            updated_at: now,
          },
        },
        opts,
      );
      if (upd.matchedCount === 1) expiredCount++;
    });
  }
  return { expiredCount };
}

async function reconcileRefund(db, { bookingId, adminUser, note = null, now = new Date() }) {
  const bOid = toOid(bookingId, 'INVALID_BOOKING_ID', 'Mã đơn đặt chỗ không hợp lệ');
  const booking = await db.collection('bookings').findOne({ _id: bOid });
  if (!booking) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy đơn đặt chỗ');
  if (
    booking.status !== 'CANCELLED' ||
    !['FAILED', 'PROCESSING'].includes(booking.refund_status)
  ) {
    throw new BookingError(
      409,
      'INVALID_REFUND_STATE',
      'Chỉ đơn đã hủy có trạng thái hoàn tiền FAILED hoặc PROCESSING mới cần xử lý',
    );
  }

  return runInTransaction(db, `booking:${String(bOid)}`, async (session) => {
    const opts = { session };
    const cleanNote = typeof note === 'string' && note.trim() ? note.trim() : 'Hoàn tiền thủ công tại quầy';
    const manualTxn = {
      _id: new ObjectId(),
      booking_id: bOid,
      txn_type: 'REFUND',
      status: 'SUCCESS',
      method: 'MANUAL',
      amount: booking.refund_amount,
      performed_by: adminUser._id,
      note: cleanNote,
      created_at: now,
      completed_at: now,
    };
    await db.collection('payment_transactions').insertOne(manualTxn, opts);
    await db.collection('bookings').updateOne(
      { _id: bOid },
      {
        $set: {
          refund_status: 'MANUALLY_RESOLVED',
          refund_note: cleanNote,
          updated_at: now,
        },
      },
      opts,
    );
    return db.collection('bookings').findOne({ _id: bOid }, opts);
  });
}

module.exports = {
  BookingError,
  resolveTimeWindow,
  evaluateSpaceAvailability,
  searchAvailableSpaces,
  selectSpaceAndPackage,
  buildBookingQuote,
  createBooking,
  payBooking,
  cancelBooking,
  rescheduleBooking,
  checkInBooking,
  checkOutBooking,
  markNoShowBooking,
  expirePendingBookings,
  reconcileRefund,
};

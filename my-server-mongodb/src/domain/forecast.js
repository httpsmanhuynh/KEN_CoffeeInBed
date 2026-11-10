'use strict';

/**
 * Domain thuần (không phụ thuộc MongoDB) cho Module 12 — Recommendation & Forecast API.
 * Toàn bộ hàm nhận dữ liệu thuần (mảng/object) để có thể kiểm thử đơn vị (Unit Test) độc lập với CSDL.
 */

const { AdminError } = require('./adminError');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Ho_Chi_Minh (UTC+7)
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_FORECAST_DAYS = 7;
const DEFAULT_TREND_DAYS = 30;
const MAX_RANGE_DAYS = 366;

const ALERT_TYPES = Object.freeze(['LOW_STOCK', 'REORDER', 'DEFROST']);
const ALERT_SEVERITIES = Object.freeze(['INFO', 'WARNING', 'CRITICAL']);
const ALERT_STATUSES = Object.freeze(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']);
const MOVEMENT_TYPES = Object.freeze(['IN', 'OUT', 'ADJUST', 'DISCARD']);
const DAYPARTS = Object.freeze(['MORNING', 'AFTERNOON', 'EVENING']);

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------ Thời gian & Tham số */

function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s == null ? '' : s).trim());
  if (!m) return null;
  const raw = String(s).trim();
  // Chấp nhận YYYY-MM-DD hoặc chuỗi ISO hợp lệ bắt đầu bằng YYYY-MM-DD
  if (raw.length > 10 && Number.isNaN(new Date(raw).getTime())) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, mo, d };
}

function utcDayStart({ y, mo, d }) {
  return new Date(Date.UTC(y, mo - 1, d));
}

function ymdOfUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function ymdOfVn(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Chuẩn hóa khoảng ngày `[from, to]` cho Forecast hoặc Trends.
 * - Mode `forecast` mặc định (không truyền `from`/`to`): ngày hôm sau (tomorrow) theo giờ VN (UTC+7).
 * - Mode `trend` mặc định: 30 ngày gần nhất đến hôm nay theo giờ VN.
 */
function parseForecastDateRange(query = {}, now = new Date(), mode = 'trend') {
  const vnNow = new Date(now.getTime() + VN_OFFSET_MS);
  const todayStr = vnNow.toISOString().slice(0, 10);
  const todayParts = parseYmd(todayStr);
  const todayUtc = utcDayStart(todayParts);

  const hasFrom = query.from != null && String(query.from).trim() !== '';
  const hasTo = query.to != null && String(query.to).trim() !== '';

  let fromStart;
  let toStart;

  if (mode === 'forecast') {
    const tomorrowUtc = new Date(todayUtc.getTime() + DAY_MS);
    if (hasFrom) {
      const fp = parseYmd(query.from);
      if (!fp) throw new AdminError(422, 'VALIDATION_ERROR', 'Tham số `from` không đúng định dạng ngày (YYYY-MM-DD).');
      fromStart = utcDayStart(fp);
    } else {
      fromStart = tomorrowUtc;
    }
    if (hasTo) {
      const tp = parseYmd(query.to);
      if (!tp) throw new AdminError(422, 'VALIDATION_ERROR', 'Tham số `to` không đúng định dạng ngày (YYYY-MM-DD).');
      toStart = utcDayStart(tp);
    } else {
      toStart = hasFrom
        ? new Date(fromStart.getTime() + (DEFAULT_FORECAST_DAYS - 1) * DAY_MS)
        : tomorrowUtc;
    }
  } else {
    if (hasTo) {
      const tp = parseYmd(query.to);
      if (!tp) throw new AdminError(422, 'VALIDATION_ERROR', 'Tham số `to` không đúng định dạng ngày (YYYY-MM-DD).');
      toStart = utcDayStart(tp);
    } else {
      toStart = todayUtc;
    }
    if (hasFrom) {
      const fp = parseYmd(query.from);
      if (!fp) throw new AdminError(422, 'VALIDATION_ERROR', 'Tham số `from` không đúng định dạng ngày (YYYY-MM-DD).');
      fromStart = utcDayStart(fp);
    } else {
      fromStart = new Date(toStart.getTime() - (DEFAULT_TREND_DAYS - 1) * DAY_MS);
    }
  }

  if (fromStart.getTime() > toStart.getTime()) {
    throw new AdminError(422, 'VALIDATION_ERROR', '`from` phải nhỏ hơn hoặc bằng `to`.');
  }
  const toExclusive = new Date(toStart.getTime() + DAY_MS);
  const days = Math.round((toExclusive.getTime() - fromStart.getTime()) / DAY_MS);
  if (days > MAX_RANGE_DAYS) {
    throw new AdminError(422, 'VALIDATION_ERROR', `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày.`);
  }

  return {
    from: fromStart,
    to: toExclusive,
    days,
    fromDate: ymdOfUtc(fromStart),
    toDate: ymdOfUtc(toStart),
  };
}

/**
 * Xác định khung giờ trong ngày (`MORNING`: <12h, `AFTERNOON`: 12h–16h59, `EVENING`: >=17h theo giờ VN).
 */
function resolveDaypart(startAt, explicitDaypart) {
  if (explicitDaypart != null && String(explicitDaypart).trim() !== '') {
    const dp = String(explicitDaypart).trim().toUpperCase();
    if (!DAYPARTS.includes(dp)) {
      throw new AdminError(422, 'VALIDATION_ERROR', 'daypart phải là MORNING, AFTERNOON hoặc EVENING.');
    }
    return dp;
  }
  if (!startAt) return null;
  const d = startAt instanceof Date ? startAt : new Date(startAt);
  if (Number.isNaN(d.getTime())) {
    throw new AdminError(422, 'VALIDATION_ERROR', 'startAt không đúng định dạng thời gian.');
  }
  const vnHour = new Date(d.getTime() + VN_OFFSET_MS).getUTCHours();
  if (vnHour < 12) return 'MORNING';
  if (vnHour < 17) return 'AFTERNOON';
  return 'EVENING';
}

/* ------------------------------------------------ Helpers chung cho Recommendation */

function indexProductsById(products = []) {
  const allById = new Map();
  const activeById = new Map();
  for (const p of products) {
    if (!p || !p._id) continue;
    const idStr = String(p._id);
    allById.set(idStr, p);
    if (p.is_active === true) activeById.set(idStr, p);
  }
  return { allById, activeById };
}

function aggregateSalesStats(salesDaily = [], daypart = null) {
  const statsByItem = new Map();
  let validHistoryCount = 0;

  for (const row of salesDaily) {
    if (!row || (!row.item_id && !row.item_code)) continue;
    const totalQty = Number(row.qty);
    if (!Number.isFinite(totalQty) || totalQty < 0) continue;
    validHistoryCount += 1;

    const dpQty =
      daypart && row.qty_by_daypart && Number.isFinite(Number(row.qty_by_daypart[daypart]))
        ? Number(row.qty_by_daypart[daypart])
        : 0;

    const curTemplate = () => ({
      totalQty: 0,
      daypartQty: 0,
      revenue: 0,
    });

    const rev = Number.isFinite(Number(row.revenue_vnd)) ? Number(row.revenue_vnd) : 0;

    if (row.item_id) {
      const k = String(row.item_id);
      const cur = statsByItem.get(k) || curTemplate();
      cur.totalQty += totalQty;
      cur.daypartQty += dpQty;
      cur.revenue += rev;
      statsByItem.set(k, cur);
    }
    if (row.item_code) {
      const kc = `code:${String(row.item_code)}`;
      const cur = statsByItem.get(kc) || curTemplate();
      cur.totalQty += totalQty;
      cur.daypartQty += dpQty;
      cur.revenue += rev;
      statsByItem.set(kc, cur);
    }
  }

  return { statsByItem, validHistoryCount };
}

function lookupSalesStat(statsByItem, productId, itemCode) {
  if (productId && statsByItem.has(String(productId))) {
    return statsByItem.get(String(productId));
  }
  if (itemCode && statsByItem.has(`code:${String(itemCode)}`)) {
    return statsByItem.get(`code:${String(itemCode)}`);
  }
  return { totalQty: 0, daypartQty: 0, revenue: 0 };
}

function daypartText(daypart) {
  if (daypart === 'MORNING') return 'buổi sáng';
  if (daypart === 'AFTERNOON') return 'buổi chiều';
  if (daypart === 'EVENING') return 'buổi tối';
  return null;
}

function isAddonEligible(addon, allProductsById) {
  if (!addon || addon.is_active !== true) return false;
  if (addon.product_id) {
    const linked = allProductsById.get(String(addon.product_id));
    if (linked && linked.is_active === false) return false;
  }
  return true;
}

/* ------------------------------------------------ 1A. Top Trending (Không phân role — Pop-up & Trang Top Trending) */

/**
 * Xếp hạng Top Trending toàn hệ thống cho Pop-up & Trang `/top-trending` (KHÔNG phân role, không cá nhân hóa).
 * Mọi đối tượng (Guest / Customer / Admin) nhận cùng danh sách món bán chạy đang `is_active === true`.
 */
function buildTopTrendingRecommendations({
  addons = [],
  products = [],
  salesDaily = [],
  daypart = null,
  guestCount = 1,
  limit = 6,
  excludeProductIds = new Set(),
} = {}) {
  const { allById, activeById } = indexProductsById(products);
  const candidatesByKey = new Map();

  for (const a of addons) {
    if (!isAddonEligible(a, allById)) continue;
    const prodIdStr = a.product_id ? String(a.product_id) : null;
    if (prodIdStr && excludeProductIds.has(prodIdStr)) continue;

    const prod = prodIdStr ? activeById.get(prodIdStr) : null;
    const key = prodIdStr || `addon:${String(a._id)}`;
    const listedPrice = Number(a.price ?? (prod && prod.price) ?? 0);

    candidatesByKey.set(key, {
      addonId: a._id,
      productId: a.product_id || null,
      itemCode: (prod && prod.item_code) || a.item_code || null,
      name: a.name || (prod && prod.name) || 'Dịch vụ cộng thêm',
      category: (prod && prod.category) || 'ADDON',
      subCategory: (prod && prod.sub_category) || null,
      price: listedPrice,
      listedPrice,
      unit: a.unit || 'PER_ITEM',
      variants: Array.isArray(a.variants) ? a.variants : (prod && prod.variants) || [],
      imageUrl: (prod && prod.image_url) || a.image_url || null,
      is_active: true,
    });
  }

  for (const [prodIdStr, p] of activeById.entries()) {
    if (excludeProductIds.has(prodIdStr)) continue;
    if (!candidatesByKey.has(prodIdStr)) {
      const listedPrice = Number(p.price || 0);
      candidatesByKey.set(prodIdStr, {
        addonId: null,
        productId: p._id,
        itemCode: p.item_code || null,
        name: p.name,
        category: p.category || 'DRINK',
        subCategory: p.sub_category || null,
        price: listedPrice,
        listedPrice,
        unit: 'PER_ITEM',
        variants: Array.isArray(p.variants) ? p.variants : [],
        imageUrl: p.image_url || null,
        is_active: true,
      });
    }
  }

  const { statsByItem, validHistoryCount } = aggregateSalesStats(salesDaily, daypart);
  const dpLabel = daypartText(daypart);

  const ranked = [];
  for (const cand of candidatesByKey.values()) {
    const stat = lookupSalesStat(statsByItem, cand.productId, cand.itemCode);
    const groupBoost =
      guestCount >= 2 && (cand.category === 'PASTRY' || cand.unit === 'PER_BOOKING') ? 15 : 0;
    const score = stat.totalQty + stat.daypartQty * 1.5 + groupBoost;

    let reason = 'Món đang được yêu thích tại KÉN';
    if (dpLabel && stat.daypartQty > 0) {
      reason = `Top Trending ${dpLabel} (${stat.daypartQty} lượt gọi)`;
    } else if (stat.totalQty > 0) {
      reason = `Top Trending tại KÉN (${stat.totalQty} lượt gọi)`;
    } else if (guestCount >= 2 && groupBoost > 0) {
      reason = `Phù hợp cho nhóm ${guestCount} khách`;
    }

    ranked.push({
      ...cand,
      score: round2(score),
      totalSold: stat.totalQty,
      daypartSold: stat.daypartQty,
      totalRevenueVnd: round2(stat.revenue),
      reason,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.totalSold !== a.totalSold) return b.totalSold - a.totalSold;
    return String(a.name).localeCompare(String(b.name), 'vi');
  });

  const safeLimit = Math.min(Math.max(1, Number(limit) || 6), 50);
  const items = ranked.slice(0, safeLimit).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  return {
    strategy: validHistoryCount > 0 ? 'TRENDING_POPULAR' : 'DEFAULT_FALLBACK',
    hasHistory: validHistoryCount > 0,
    roleScoped: false,
    topTrendingPath: '/top-trending',
    items,
  };
}

/* ------------------------------------------------ 1B. Recommend theo nhóm Customer trong luồng Booking (Menu Inclusion & Add-ons) */

/**
 * Xếp hạng menu Inclusion & Add-on trong luồng Booking (Bước 3 UC-06) theo nhóm khách hàng ML (`ml_cluster_id`).
 * - `inclusions`: các món đang `is_active === true` cho menu Inclusion (gắn thêm `packageInclusionId`, `itemType`, `subsidyLimit`, `surchargeAmount` nếu có `packageInclusions`).
 * - `addons`: các dịch vụ Add-on đang `is_active === true` cho menu Add-on.
 * - Fallback an toàn: Guest, Customer chưa có `ml_cluster_id`, hoặc cụm không có dữ liệu -> rơi về xu hướng chung (`TRENDING_FALLBACK` / `DEFAULT_FALLBACK`).
 */
function buildBookingMenuRecommendations({
  addons = [],
  products = [],
  packageInclusions = [],
  salesDaily = [],
  clusterItemScores = new Map(),
  clusterAddonScores = new Map(),
  daypart = null,
  guestCount = 1,
  mlClusterId = null,
  isAuthenticated = false,
  forceFallback = false,
  recommendLimit = 4,
} = {}) {
  const { allById, activeById } = indexProductsById(products);
  const { statsByItem, validHistoryCount } = aggregateSalesStats(salesDaily, daypart);

  const hasClusterData =
    !forceFallback &&
    mlClusterId !== null &&
    mlClusterId !== undefined &&
    ((clusterItemScores && clusterItemScores.size > 0) ||
      (clusterAddonScores && clusterAddonScores.size > 0));

  const fallbackUsed = Boolean(forceFallback || !hasClusterData);
  const dpLabel = daypartText(daypart);
  const safeRecLimit = Math.min(Math.max(1, Number(recommendLimit) || 4), 20);

  // Ánh xạ package_inclusions theo category nếu gói được truyền vào
  const slotByCategory = new Map();
  for (const inc of packageInclusions) {
    if (!inc || inc.is_active === false) continue;
    if (inc.item_type === 'STANDARD_DRINK') {
      slotByCategory.set('DRINK', {
        packageInclusionId: inc._id || null,
        itemType: 'STANDARD_DRINK',
        subsidyLimit: inc.subsidy_limit !== null && inc.subsidy_limit !== undefined ? Number(inc.subsidy_limit) : 50000,
      });
    } else if (inc.item_type === 'PASTRY') {
      slotByCategory.set('PASTRY', {
        packageInclusionId: inc._id || null,
        itemType: 'PASTRY',
        subsidyLimit: inc.subsidy_limit !== null && inc.subsidy_limit !== undefined ? Number(inc.subsidy_limit) : null,
      });
    }
  }
  const filterByPackageSlots = slotByCategory.size > 0;

  // 1. Menu Inclusion (products)
  const inclusionCandidates = [];
  for (const p of activeById.values()) {
    const cat = p.category || 'DRINK';
    if (filterByPackageSlots && !slotByCategory.has(cat)) continue;

    const slot = slotByCategory.get(cat) || null;
    const price = Number(p.price || 0);
    const subsidyLimit = slot ? slot.subsidyLimit : null;
    const surchargeAmount = subsidyLimit !== null ? Math.max(0, price - subsidyLimit) : 0;

    const idStr = String(p._id);
    const stat = lookupSalesStat(statsByItem, idStr, p.item_code);
    const clusterById = clusterItemScores.get(idStr) || 0;
    const clusterByCode = p.item_code ? clusterItemScores.get(`code:${String(p.item_code)}`) || 0 : 0;
    const clusterScore = hasClusterData ? Number(clusterById || clusterByCode || 0) : 0;
    const groupBoost = guestCount >= 2 && cat === 'PASTRY' ? 10 : 0;
    const score = clusterScore * 3 + stat.totalQty + stat.daypartQty * 1.5 + groupBoost;

    let recommendReason = 'Món phổ biến trong gói tại KÉN';
    if (hasClusterData && clusterScore > 0) {
      recommendReason = `Phù hợp với nhóm khách hàng #${mlClusterId}`;
    } else if (dpLabel && stat.daypartQty > 0) {
      recommendReason = `Được chọn nhiều vào ${dpLabel}`;
    } else if (stat.totalQty > 0) {
      recommendReason = `Được yêu thích tại KÉN (${stat.totalQty} lượt chọn)`;
    }

    inclusionCandidates.push({
      _id: p._id,
      productId: p._id,
      itemCode: p.item_code || null,
      name: p.name,
      category: cat,
      subCategory: p.sub_category || null,
      price,
      variants: Array.isArray(p.variants) ? p.variants : [],
      imageUrl: p.image_url || null,
      is_active: true,
      packageInclusionId: slot ? slot.packageInclusionId : null,
      itemType: slot ? slot.itemType : cat === 'PASTRY' ? 'PASTRY' : cat === 'DRINK' ? 'STANDARD_DRINK' : cat,
      subsidyLimit,
      surchargeAmount,
      score: round2(score),
      clusterScore: round2(clusterScore),
      totalSold: stat.totalQty,
      daypartSold: stat.daypartQty,
      recommendReason,
    });
  }

  inclusionCandidates.sort((a, b) => {
    if (hasClusterData && (b.clusterScore > 0) !== (a.clusterScore > 0)) {
      return b.clusterScore > 0 ? 1 : -1;
    }
    if (b.score !== a.score) return b.score - a.score;
    return String(a.name).localeCompare(String(b.name), 'vi');
  });

  const inclusions = inclusionCandidates.map((item, idx) => {
    const rank = idx + 1;
    const isRecommended = hasClusterData
      ? item.clusterScore > 0 && rank <= safeRecLimit
      : item.score > 0 && rank <= safeRecLimit;
    return {
      ...item,
      isRecommended,
      recommendRank: rank,
    };
  });

  // 2. Menu Add-ons
  const addonCandidates = [];
  for (const a of addons) {
    if (!isAddonEligible(a, allById)) continue;
    const prodIdStr = a.product_id ? String(a.product_id) : null;
    const prod = prodIdStr ? activeById.get(prodIdStr) : null;
    const itemCode = (prod && prod.item_code) || a.item_code || null;
    const price = Number(a.price ?? (prod && prod.price) ?? 0);

    const stat = lookupSalesStat(statsByItem, prodIdStr, itemCode);
    const addonKey = String(a._id);
    const cAddon = clusterAddonScores.get(addonKey) || 0;
    const cProd = prodIdStr ? clusterItemScores.get(prodIdStr) || 0 : 0;
    const cCode = itemCode ? clusterItemScores.get(`code:${String(itemCode)}`) || 0 : 0;
    const clusterScore = hasClusterData ? Number(cAddon + (cProd || cCode)) : 0;
    const groupBoost = guestCount >= 2 && (a.unit === 'PER_BOOKING' || (prod && prod.category === 'PASTRY')) ? 10 : 0;
    const score = clusterScore * 3 + stat.totalQty + stat.daypartQty * 1.5 + groupBoost;

    let recommendReason = 'Dịch vụ bổ sung được ưa chuộng';
    if (hasClusterData && clusterScore > 0) {
      recommendReason = `Phù hợp với nhóm khách hàng #${mlClusterId}`;
    } else if (dpLabel && stat.daypartQty > 0) {
      recommendReason = `Thường được thêm vào ${dpLabel}`;
    } else if (stat.totalQty > 0) {
      recommendReason = `Add-on bán chạy (${stat.totalQty} lượt đặt)`;
    } else if (guestCount >= 2 && groupBoost > 0) {
      recommendReason = `Tiện ích phù hợp cho nhóm ${guestCount} khách`;
    }

    addonCandidates.push({
      _id: a._id,
      addonId: a._id,
      productId: a.product_id || null,
      itemCode,
      name: a.name || (prod && prod.name) || 'Dịch vụ cộng thêm',
      category: (prod && prod.category) || 'ADDON',
      subCategory: (prod && prod.sub_category) || null,
      price,
      listedPrice: price,
      unit: a.unit || 'PER_ITEM',
      variants: Array.isArray(a.variants) ? a.variants : (prod && prod.variants) || [],
      imageUrl: (prod && prod.image_url) || a.image_url || null,
      is_active: true,
      score: round2(score),
      clusterScore: round2(clusterScore),
      totalSold: stat.totalQty,
      daypartSold: stat.daypartQty,
      recommendReason,
    });
  }

  addonCandidates.sort((a, b) => {
    if (hasClusterData && (b.clusterScore > 0) !== (a.clusterScore > 0)) {
      return b.clusterScore > 0 ? 1 : -1;
    }
    if (b.score !== a.score) return b.score - a.score;
    return String(a.name).localeCompare(String(b.name), 'vi');
  });

  const mappedAddons = addonCandidates.map((item, idx) => {
    const rank = idx + 1;
    const isRecommended = hasClusterData
      ? item.clusterScore > 0 && rank <= safeRecLimit
      : item.score > 0 && rank <= safeRecLimit;
    return {
      ...item,
      isRecommended,
      recommendRank: rank,
    };
  });

  const inclusionsByType = {
    STANDARD_DRINK: inclusions.filter((i) => i.itemType === 'STANDARD_DRINK'),
    PASTRY: inclusions.filter((i) => i.itemType === 'PASTRY'),
  };

  const strategy = hasClusterData
    ? 'PERSONALIZED_ML_CLUSTER'
    : validHistoryCount > 0
      ? 'TRENDING_FALLBACK'
      : 'DEFAULT_FALLBACK';

  return {
    strategy,
    hasHistory: validHistoryCount > 0,
    fallbackUsed,
    mlClusterId: hasClusterData ? mlClusterId : null,
    isAuthenticated: Boolean(isAuthenticated),
    inclusions,
    inclusionsByType,
    addons: mappedAddons,
    recommendedInclusions: inclusions.filter((i) => i.isRecommended),
    recommendedAddons: mappedAddons.filter((a) => a.isRecommended),
  };
}

/* ------------------------------------------------ 2. Admin Forecast: Số lượng món ngày hôm sau -> Số lượng nguyên vật liệu */

/**
 * Kiểm tra bản ghi `demand_forecasts` có hợp lệ hay không (bảo vệ API trước dữ liệu ML bị hỏng/thiếu trường — REC-16).
 */
function isValidForecastDoc(doc) {
  if (!doc || typeof doc !== 'object') return false;
  if (!doc.item_id && !doc.item_code) return false;
  if (!doc.forecast_date) return false;
  const dt = doc.forecast_date instanceof Date ? doc.forecast_date : new Date(doc.forecast_date);
  if (Number.isNaN(dt.getTime())) return false;
  const qty = Number(doc.predicted_qty);
  if (!Number.isFinite(qty) || qty < 0) return false;
  return true;
}

/**
 * Bước 1: Tổng hợp số lượng từng món dự báo (`dishes`) cho ngày hôm sau (hoặc khoảng ngày lọc).
 * Bước 2: Từ số lượng món đó kết hợp công thức (`recipes`), tính ra số lượng nguyên vật liệu phù hợp (`items`).
 */
function computeIngredientForecasts({
  ingredients = [],
  products = [],
  recipes = [],
  forecasts = [],
  range = null,
} = {}) {
  let skippedMalformedCount = 0;
  const validForecasts = [];

  for (const f of forecasts) {
    if (!isValidForecastDoc(f)) {
      skippedMalformedCount += 1;
      continue;
    }
    const dt = f.forecast_date instanceof Date ? f.forecast_date : new Date(f.forecast_date);
    // Chuẩn hóa ngày theo UTC+7 (hỗ trợ cả bản ghi lưu 00:00Z lẫn 17:00Z = 00:00+07:00)
    const vnDate = ymdOfVn(dt);
    const utcDate = ymdOfUtc(dt);
    if (range) {
      const inRange =
        (vnDate >= range.fromDate && vnDate <= range.toDate) ||
        (dt.getTime() >= range.from.getTime() && dt.getTime() < range.to.getTime());
      if (!inRange) continue;
    }
    const displayDate = range && vnDate >= range.fromDate && vnDate <= range.toDate ? vnDate : utcDate;
    validForecasts.push({
      itemId: f.item_id ? String(f.item_id) : null,
      itemCode: f.item_code ? String(f.item_code) : null,
      forecastDate: displayDate,
      predictedQty: Number(f.predicted_qty),
      lowerQty: Number.isFinite(Number(f.lower_qty)) ? Number(f.lower_qty) : Number(f.predicted_qty),
      upperQty: Number.isFinite(Number(f.upper_qty)) ? Number(f.upper_qty) : Number(f.predicted_qty),
      modelVersion: f.model_version || 'UNKNOWN',
    });
  }

  if (validForecasts.length === 0) {
    return {
      items: [],
      dishes: [],
      totalIngredients: ingredients.length,
      totalDishes: 0,
      forecastRecordsCount: 0,
      skippedMalformedCount,
      message:
        skippedMalformedCount > 0
          ? 'Các bản ghi dự báo không hợp lệ đã bị bỏ qua; không còn dữ liệu dự báo hợp lệ trong kỳ.'
          : 'Chưa có dữ liệu dự báo nhu cầu từ mô hình ML trong khoảng thời gian này.',
    };
  }

  // Bước 1: Tính số lượng món dự báo (`dishes`)
  const prodById = new Map();
  const prodByCode = new Map();
  for (const p of products) {
    if (!p) continue;
    if (p._id) prodById.set(String(p._id), p);
    if (p.item_code) prodByCode.set(String(p.item_code), p);
  }

  const dishAccMap = new Map();
  for (const vf of validForecasts) {
    const prod = (vf.itemId && prodById.get(vf.itemId)) || (vf.itemCode && prodByCode.get(vf.itemCode)) || null;
    const key = vf.itemId || `code:${vf.itemCode}`;
    let dAcc = dishAccMap.get(key);
    if (!dAcc) {
      dAcc = {
        itemId: vf.itemId || (prod && prod._id ? String(prod._id) : null),
        itemCode: vf.itemCode || (prod && prod.item_code) || null,
        name: (prod && prod.name) || vf.itemCode || 'Sản phẩm',
        category: (prod && prod.category) || null,
        price: prod && prod.price != null ? Number(prod.price) : null,
        predictedQty: 0,
        lowerQty: 0,
        upperQty: 0,
        byDate: new Map(),
        modelVersions: new Set(),
      };
      dishAccMap.set(key, dAcc);
    }
    dAcc.predictedQty = round2(dAcc.predictedQty + vf.predictedQty);
    dAcc.lowerQty = round2(dAcc.lowerQty + vf.lowerQty);
    dAcc.upperQty = round2(dAcc.upperQty + vf.upperQty);
    dAcc.modelVersions.add(vf.modelVersion);

    const dayDish = dAcc.byDate.get(vf.forecastDate) || {
      forecastDate: vf.forecastDate,
      predictedQty: 0,
      lowerQty: 0,
      upperQty: 0,
    };
    dayDish.predictedQty = round2(dayDish.predictedQty + vf.predictedQty);
    dayDish.lowerQty = round2(dayDish.lowerQty + vf.lowerQty);
    dayDish.upperQty = round2(dayDish.upperQty + vf.upperQty);
    dAcc.byDate.set(vf.forecastDate, dayDish);
  }

  const dishes = [...dishAccMap.values()]
    .map((d) => {
      const dailyForecasts = [...d.byDate.values()].sort((a, b) =>
        a.forecastDate.localeCompare(b.forecastDate),
      );
      return {
        itemId: d.itemId,
        itemCode: d.itemCode,
        name: d.name,
        category: d.category,
        price: d.price,
        predictedQty: d.predictedQty,
        lowerQty: d.lowerQty,
        upperQty: d.upperQty,
        forecastDate:
          dailyForecasts.length > 0
            ? dailyForecasts[0].forecastDate
            : range
              ? range.fromDate
              : null,
        dailyForecasts,
        modelVersions: [...d.modelVersions],
      };
    })
    .sort((a, b) => b.predictedQty - a.predictedQty);

  // Bước 2: Từ số lượng món (`dishes`) -> quy đổi qua `recipes` sang số lượng nguyên vật liệu phù hợp (`items`)
  const recipesByItemId = new Map();
  const recipesByItemCode = new Map();
  for (const r of recipes) {
    if (!r || !r.ingredient_id) continue;
    const qtyPerItem = Number(r.quantity_per_item);
    if (!Number.isFinite(qtyPerItem) || qtyPerItem <= 0) continue;
    if (r.item_id) {
      const k = String(r.item_id);
      if (!recipesByItemId.has(k)) recipesByItemId.set(k, []);
      recipesByItemId.get(k).push(r);
    }
    if (r.item_code) {
      const kc = String(r.item_code);
      if (!recipesByItemCode.has(kc)) recipesByItemCode.set(kc, []);
      recipesByItemCode.get(kc).push(r);
    }
  }

  const demandByIngId = new Map();
  for (const ing of ingredients) {
    if (!ing || !ing._id) continue;
    demandByIngId.set(String(ing._id), {
      predictedDemand: 0,
      lowerDemand: 0,
      upperDemand: 0,
      byDate: new Map(),
      dishBreakdown: [],
      modelVersions: new Set(),
    });
  }

  for (const dish of dishes) {
    const matchedRecipes =
      (dish.itemId && recipesByItemId.get(dish.itemId)) ||
      (dish.itemCode && recipesByItemCode.get(dish.itemCode)) ||
      [];

    for (const r of matchedRecipes) {
      const ingIdStr = String(r.ingredient_id);
      let acc = demandByIngId.get(ingIdStr);
      if (!acc) {
        acc = {
          predictedDemand: 0,
          lowerDemand: 0,
          upperDemand: 0,
          byDate: new Map(),
          dishBreakdown: [],
          modelVersions: new Set(),
        };
        demandByIngId.set(ingIdStr, acc);
      }

      const qPer = Number(r.quantity_per_item);
      const dishReq = round2(dish.predictedQty * qPer);
      acc.predictedDemand += dish.predictedQty * qPer;
      acc.lowerDemand += dish.lowerQty * qPer;
      acc.upperDemand += dish.upperQty * qPer;
      for (const mv of dish.modelVersions) acc.modelVersions.add(mv);

      acc.dishBreakdown.push({
        itemId: dish.itemId,
        itemCode: dish.itemCode,
        dishName: dish.name,
        dishQty: dish.predictedQty,
        quantityPerItem: qPer,
        requiredIngredientQty: dishReq,
      });

      for (const dayDish of dish.dailyForecasts) {
        const pred = dayDish.predictedQty * qPer;
        const low = dayDish.lowerQty * qPer;
        const up = dayDish.upperQty * qPer;
        const dayRow = acc.byDate.get(dayDish.forecastDate) || {
          forecastDate: dayDish.forecastDate,
          predictedDemand: 0,
          lowerDemand: 0,
          upperDemand: 0,
        };
        dayRow.predictedDemand = round2(dayRow.predictedDemand + pred);
        dayRow.lowerDemand = round2(dayRow.lowerDemand + low);
        dayRow.upperDemand = round2(dayRow.upperDemand + up);
        acc.byDate.set(dayDish.forecastDate, dayRow);
      }
    }
  }

  const items = ingredients.map((ing) => {
    const acc = demandByIngId.get(String(ing._id)) || {
      predictedDemand: 0,
      lowerDemand: 0,
      upperDemand: 0,
      byDate: new Map(),
      dishBreakdown: [],
      modelVersions: new Set(),
    };
    const dailySchedule = [...acc.byDate.values()].sort((a, b) =>
      a.forecastDate.localeCompare(b.forecastDate),
    );
    const currentStock = Number(ing.current_stock ?? 0);
    const minStockLevel = Number(ing.min_stock_level ?? 0);
    const predictedDemand = round2(acc.predictedDemand);
    const projectedRemainingStock = round2(currentStock - predictedDemand);
    const shortfall = round2(Math.max(0, predictedDemand - currentStock));
    const recommendedOrderQty = round2(Math.max(0, predictedDemand + minStockLevel - currentStock));

    return {
      _id: ing._id,
      ingredientCode: ing.ingredient_code,
      name: ing.ingredient_name,
      unit: ing.unit,
      status: ing.status,
      storageType: ing.storage_type || 'AMBIENT',
      currentStock: round2(currentStock),
      minStockLevel: round2(minStockLevel),
      defrostHours: ing.defrost_hours ?? null,
      predictedDemand,
      lowerDemand: round2(acc.lowerDemand),
      upperDemand: round2(acc.upperDemand),
      projectedRemainingStock,
      shortfallQty: shortfall,
      recommendedOrderQty,
      needsRestock: currentStock < minStockLevel || shortfall > 0 || projectedRemainingStock < minStockLevel,
      forecastDate:
        dailySchedule.length > 0
          ? dailySchedule[0].forecastDate
          : range
            ? range.fromDate
            : null,
      dishBreakdown: acc.dishBreakdown,
      dailyForecasts: dailySchedule,
      modelVersions: [...acc.modelVersions],
    };
  });

  return {
    items,
    dishes,
    totalIngredients: items.length,
    totalDishes: dishes.length,
    forecastRecordsCount: validForecasts.length,
    skippedMalformedCount,
    message: null,
  };
}

/* ------------------------------------------------ 3. Xu hướng Doanh thu & Tiêu thụ */

/**
 * Xây dựng chuỗi xu hướng theo ngày từ `sales_history_daily` hoặc `sales_transactions`.
 */
function buildTrendSeries({ rows = [], mode = 'daily', productId = null } = {}) {
  const byDate = new Map();
  let totalQty = 0;
  let totalRevenue = 0;
  let totalOrders = 0;

  for (const r of rows) {
    if (!r || !r.sale_date) continue;
    const dStr = ymdOfUtc(r.sale_date);
    if (!dStr) continue;

    const qty = Number(mode === 'transactions' ? r.quantity : r.qty);
    const rev = Number(mode === 'transactions' ? r.line_total_vnd : r.revenue_vnd);
    const orders = Number(mode === 'transactions' ? 1 : r.order_lines ?? 1);

    if (!Number.isFinite(qty) || qty < 0) continue;
    const safeRev = Number.isFinite(rev) && rev >= 0 ? rev : 0;
    const safeOrders = Number.isFinite(orders) && orders >= 0 ? orders : 0;

    const cur = byDate.get(dStr) || {
      date: dStr,
      qty: 0,
      revenueVnd: 0,
      orderLines: 0,
    };
    cur.qty += qty;
    cur.revenueVnd += safeRev;
    cur.orderLines += safeOrders;
    byDate.set(dStr, cur);

    totalQty += qty;
    totalRevenue += safeRev;
    totalOrders += safeOrders;
  }

  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    sourceCollection: mode === 'transactions' ? 'sales_transactions' : 'sales_history_daily',
    productId: productId ? String(productId) : null,
    totals: {
      qty: totalQty,
      revenueVnd: totalRevenue,
      orderLines: totalOrders,
      daysWithSales: series.length,
    },
    series,
  };
}

/* ------------------------------------------------ 4. Kiểm tra Nhập/Xuất Kho & Cảnh báo */

function validateStockMovement({ currentStock = 0, movementType, quantityChange, reason = null } = {}) {
  const type = String(movementType || '').trim().toUpperCase();
  if (!MOVEMENT_TYPES.includes(type)) {
    throw new AdminError(
      422,
      'VALIDATION_ERROR',
      'movementType phải thuộc IN, OUT, ADJUST hoặc DISCARD.',
    );
  }
  const delta = Number(quantityChange);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AdminError(422, 'VALIDATION_ERROR', 'quantityChange phải là số khác 0.');
  }
  if (type === 'IN' && delta <= 0) {
    throw new AdminError(422, 'VALIDATION_ERROR', 'Giao dịch nhập kho (IN) phải có quantityChange > 0.');
  }
  if ((type === 'OUT' || type === 'DISCARD') && delta >= 0) {
    throw new AdminError(
      422,
      'VALIDATION_ERROR',
      `Giao dịch ${type} phải có quantityChange < 0.`,
    );
  }

  const balanceAfter = round2(Number(currentStock || 0) + delta);
  if (balanceAfter < 0) {
    throw new AdminError(
      422,
      'INSUFFICIENT_STOCK',
      `Tồn kho không đủ để xuất (hiện có ${currentStock}, thay đổi ${delta}).`,
    );
  }

  const cleanReason =
    reason === null || reason === undefined || String(reason).trim() === ''
      ? null
      : String(reason).trim().slice(0, 300);

  return {
    movementType: type,
    quantityChange: round2(delta),
    balanceAfter,
    reason: cleanReason,
  };
}

function validateAlertTransition(currentAlert, nextStatus) {
  if (!currentAlert) {
    throw new AdminError(404, 'ALERT_NOT_FOUND', 'Không tìm thấy cảnh báo tồn kho.');
  }
  const target = String(nextStatus || '').trim().toUpperCase();
  if (!['ACKNOWLEDGED', 'RESOLVED'].includes(target)) {
    throw new AdminError(
      422,
      'VALIDATION_ERROR',
      'Trạng thái cập nhật phải là ACKNOWLEDGED hoặc RESOLVED.',
    );
  }
  if (currentAlert.status === 'RESOLVED' && target === 'ACKNOWLEDGED') {
    throw new AdminError(
      409,
      'INVALID_ALERT_STATE',
      'Cảnh báo đã RESOLVED không thể chuyển ngược về ACKNOWLEDGED.',
    );
  }
  return target;
}

module.exports = {
  ALERT_TYPES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  MOVEMENT_TYPES,
  DAYPARTS,
  parseForecastDateRange,
  resolveDaypart,
  buildTopTrendingRecommendations,
  buildBookingMenuRecommendations,
  isValidForecastDoc,
  computeIngredientForecasts,
  buildTrendSeries,
  validateStockMovement,
  validateAlertTransition,
};

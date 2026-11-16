'use strict';

/**
 * Dịch vụ Module 12 — Recommendation & Forecast API.
 * Nhận `db` làm tham số đầu tiên (nhất quán với `bookingService.js` và `adminService.js`).
 */

const { ObjectId } = require('mongodb');
const { AdminError } = require('../domain/adminError');
const {
  ALERT_TYPES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  parseForecastDateRange,
  resolveDaypart,
  buildTopTrendingRecommendations,
  buildBookingMenuRecommendations,
  computeIngredientForecasts,
  buildTrendSeries,
  validateStockMovement,
  validateAlertTransition,
} = require('../domain/forecast');

function toOid(v) {
  if (v instanceof ObjectId) return v;
  if (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v.trim())) return new ObjectId(v.trim());
  return null;
}

function mustOid(v, what = 'id') {
  const o = toOid(v);
  if (!o) throw new AdminError(400, 'INVALID_ID', `${what} không đúng định dạng ObjectId.`);
  return o;
}

function parseLimitParam(raw, defaultLimit = 6, maxLimit = 50) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultLimit;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new AdminError(422, 'VALIDATION_ERROR', 'Tham số `limit` phải là số nguyên dương >= 1.');
  }
  return Math.min(n, maxLimit);
}

function parseGuestCount(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 1;
  const g = Number(raw);
  if (!Number.isInteger(g) || g < 1) {
    throw new AdminError(422, 'VALIDATION_ERROR', 'Tham số `guestCount` phải là số nguyên dương >= 1.');
  }
  return g;
}

async function resolveSpaceParam(db, rawSpaceId) {
  if (rawSpaceId === undefined || rawSpaceId === null || String(rawSpaceId).trim() === '') return null;
  const sOid = mustOid(rawSpaceId, 'spaceId');
  const space = await db.collection('spaces').findOne({ _id: sOid });
  if (!space) {
    throw new AdminError(404, 'SPACE_NOT_FOUND', 'Không tìm thấy không gian.');
  }
  return space;
}

/* ------------------------------------------------ 1A. Top Trending (Không phân role) */

/**
 * GET /api/recommendations & GET /api/recommendations/top-trending
 * Phục vụ Pop-up và trang Top Trending (gắn trên footer):
 *  - KHÔNG phân role, không cá nhân hóa theo user hay ml_cluster_id.
 *  - Trả về danh sách Top Trending đang `is_active === true` kèm `topTrendingPath: '/top-trending'`.
 *  - Fallback an toàn về danh sách mặc định (HTTP 200) nếu lịch sử bán hàng rỗng hoặc lỗi truy vấn.
 */
async function getTopTrendingRecommendations(db, query = {}, defaultLimit = 6) {
  const space = await resolveSpaceParam(db, query.spaceId);
  const guestCount = parseGuestCount(query.guestCount);
  const daypart = resolveDaypart(query.startAt, query.daypart);
  const limit = parseLimitParam(query.limit, defaultLimit, 50);

  const excludeProductIds = new Set();
  if (query.excludeProductIds) {
    const rawList = Array.isArray(query.excludeProductIds)
      ? query.excludeProductIds
      : String(query.excludeProductIds).split(',');
    for (const id of rawList) {
      const trimmed = String(id).trim();
      if (trimmed) excludeProductIds.add(trimmed);
    }
  }

  const [addons, products] = await Promise.all([
    db.collection('addons').find({}).toArray(),
    db.collection('products').find({}).toArray(),
  ]);

  let salesDaily = [];
  try {
    salesDaily = await db.collection('sales_history_daily').find({}).toArray();
  } catch (_) {
    salesDaily = [];
  }

  let mlGlobal = [];
  try {
    mlGlobal = await db.collection('ml_global_trending').find({}).toArray();
  } catch (_) {
    mlGlobal = [];
  }

  const built = buildTopTrendingRecommendations({
    addons,
    products,
    salesDaily,
    daypart,
    guestCount,
    limit,
    excludeProductIds,
  });

  if (mlGlobal.length > 0) {
    const prodByCode = new Map();
    const prodByName = new Map();
    for (const p of products) {
      if (!p || p.is_active === false) continue;
      if (p.item_code) prodByCode.set(String(p.item_code).trim().toUpperCase(), p);
      if (p.name) prodByName.set(String(p.name).trim().toLocaleLowerCase('vi-VN'), p);
    }
    const addonByCode = new Map();
    const addonByProdId = new Map();
    const addonByName = new Map();
    for (const a of addons) {
      if (!a || a.is_active === false) continue;
      if (a.item_code) addonByCode.set(String(a.item_code).trim().toUpperCase(), a);
      if (a.product_id) addonByProdId.set(String(a.product_id), a);
      if (a.name) addonByName.set(String(a.name).trim().toLocaleLowerCase('vi-VN'), a);
    }

    const sortedGlobal = [...mlGlobal].sort((a, b) => {
      const rA = Number(a?.rank);
      const rB = Number(b?.rank);
      const hasRA = Number.isFinite(rA) && rA > 0;
      const hasRB = Number.isFinite(rB) && rB > 0;
      if (hasRA && hasRB && rA !== rB) return rA - rB;
      return (Number(b?.trending_score ?? 0) || 0) - (Number(a?.trending_score ?? 0) || 0);
    });

    const mappedItems = [];
    const seenKeys = new Set();

    for (const row of sortedGlobal) {
      if (!row) continue;
      const code = String(row.item_code || '').trim().toUpperCase();
      const lowerName = String(row.item_name || '').trim().toLocaleLowerCase('vi-VN');
      const prod = (code && prodByCode.get(code)) || (lowerName && prodByName.get(lowerName)) || null;
      const addon =
        (prod && addonByProdId.get(String(prod._id))) ||
        (code && addonByCode.get(code)) ||
        (lowerName && addonByName.get(lowerName)) ||
        null;

      if (prod && excludeProductIds.has(String(prod._id))) continue;
      const dedupeKey = code || (prod ? String(prod._id) : lowerName);
      if (!dedupeKey || seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const price = Number(prod?.price ?? addon?.price ?? 45000) || 0;
      const scoreVal = Number(row.trending_score ?? row.score ?? 0) || 0;
      const rankNum = Number(row.rank) || mappedItems.length + 1;
      mappedItems.push({
        addonId: addon?._id || null,
        productId: prod?._id || addon?.product_id || null,
        itemCode: code || prod?.item_code || null,
        name: prod?.name || row.item_name || addon?.name || 'Món KÉN',
        description: prod?.description || addon?.description || '',
        category: prod?.category || row.item_type || 'DRINK',
        subCategory: prod?.sub_category || row.category || null,
        itemType: row.item_type || prod?.category || 'DRINK',
        price,
        listedPrice: price,
        unit: addon?.unit || 'PER_ITEM',
        variants: Array.isArray(prod?.variants)
          ? prod.variants
          : Array.isArray(addon?.variants)
            ? addon.variants
            : [],
        imageUrl: prod?.image_url || addon?.image_url || null,
        is_active: true,
        rank: rankNum,
        score: scoreVal,
        trendingScore: scoreVal,
        reason: `Top #${rankNum} thịnh hành · Điểm ${scoreVal.toFixed(2)}`,
      });
      if (mappedItems.length >= limit) break;
    }

    if (mappedItems.length < limit) {
      for (const fallbackItem of built.items) {
        const fKey = String(fallbackItem.itemCode || fallbackItem.productId || fallbackItem.name || '').toUpperCase();
        if (fKey && seenKeys.has(fKey)) continue;
        if (fallbackItem.productId && seenKeys.has(String(fallbackItem.productId))) continue;
        if (fKey) seenKeys.add(fKey);
        mappedItems.push({
          ...fallbackItem,
          rank: mappedItems.length + 1,
        });
        if (mappedItems.length >= limit) break;
      }
    }

    return {
      items: mappedItems,
      total: mappedItems.length,
      strategy: 'ML_GLOBAL_TRENDING',
      hasHistory: true,
      roleScoped: false,
      topTrendingPath: '/top-trending',
      context: {
        spaceId: space ? space._id : null,
        guestCount,
        daypart,
        limit,
      },
    };
  }

  return {
    items: built.items,
    total: built.items.length,
    strategy: built.strategy,
    hasHistory: built.hasHistory,
    roleScoped: false,
    topTrendingPath: built.topTrendingPath,
    context: {
      spaceId: space ? space._id : null,
      guestCount,
      daypart,
      limit,
    },
  };
}

/* ------------------------------------------------ 1B. Recommend theo nhóm Customer trong luồng Booking */

/**
 * Thu thập điểm ưa chuộng của cụm khách hàng (`ml_cluster_id`) từ `sales_transactions`
 * và lịch sử đơn đặt chỗ (`bookings` -> `booking_inclusions`, `booking_addons`).
 */
async function collectClusterPreferences(db, mlClusterId) {
  const clusterItemScores = new Map();
  const clusterAddonScores = new Map();

  const clusterUsers = await db
    .collection('users')
    .find({ ml_cluster_id: mlClusterId })
    .limit(100)
    .toArray();
  const clusterUserIds = clusterUsers.map((u) => u._id);

  if (clusterUserIds.length === 0) {
    return { clusterItemScores, clusterAddonScores };
  }

  const [clusterTxs, clusterBookings] = await Promise.all([
    db
      .collection('sales_transactions')
      .find({ customer_id: { $in: clusterUserIds } })
      .limit(500)
      .toArray(),
    db
      .collection('bookings')
      .find({
        user_id: { $in: clusterUserIds },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      })
      .limit(300)
      .toArray(),
  ]);

  for (const tx of clusterTxs) {
    if (!tx || (!tx.item_id && !tx.item_code)) continue;
    const q = Number(tx.quantity || 1);
    if (!Number.isFinite(q) || q <= 0) continue;
    if (tx.item_id) {
      const k = String(tx.item_id);
      clusterItemScores.set(k, (clusterItemScores.get(k) || 0) + q);
    }
    if (tx.item_code) {
      const kc = `code:${String(tx.item_code)}`;
      clusterItemScores.set(kc, (clusterItemScores.get(kc) || 0) + q);
    }
  }

  if (clusterBookings.length > 0) {
    const bookingIds = clusterBookings.map((b) => b._id);
    const [bInclusions, bAddons] = await Promise.all([
      db.collection('booking_inclusions').find({ booking_id: { $in: bookingIds } }).toArray(),
      db.collection('booking_addons').find({ booking_id: { $in: bookingIds } }).toArray(),
    ]);

    for (const bi of bInclusions) {
      if (!bi || !bi.product_id) continue;
      const q = Number(bi.quantity || 1);
      if (Number.isFinite(q) && q > 0) {
        const k = String(bi.product_id);
        clusterItemScores.set(k, (clusterItemScores.get(k) || 0) + q);
      }
    }
    for (const ba of bAddons) {
      if (!ba || !ba.addon_id) continue;
      const q = Number(ba.quantity || 1);
      if (Number.isFinite(q) && q > 0) {
        const k = String(ba.addon_id);
        clusterAddonScores.set(k, (clusterAddonScores.get(k) || 0) + q);
      }
    }
  }

  return { clusterItemScores, clusterAddonScores };
}

/**
 * GET /api/recommendations/booking & GET /api/bookings/recommendations
 * Recommend phân theo nhóm khách hàng (`ml_cluster_id`) hiển thị ngay trong luồng Booking
 * (Bước 3 UC-06: menu sản phẩm Inclusion & Add-ons).
 */
async function getBookingMenuRecommendations(db, query = {}, user = null) {
  const space = await resolveSpaceParam(db, query.spaceId);

  let pkg = null;
  let packageInclusions = [];
  if (query.packageId !== undefined && query.packageId !== null && String(query.packageId).trim() !== '') {
    const pOid = mustOid(query.packageId, 'packageId');
    pkg = await db.collection('packages').findOne({ _id: pOid, is_active: true });
    if (!pkg) {
      throw new AdminError(404, 'PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.');
    }
    packageInclusions = await db
      .collection('package_inclusions')
      .find({ package_id: pkg._id, is_active: true })
      .toArray();
  }

  const guestCount = parseGuestCount(query.guestCount);
  const daypart = resolveDaypart(query.startAt, query.daypart);
  const recommendLimit = parseLimitParam(query.limit, 4, 20);

  const [addons, products] = await Promise.all([
    db.collection('addons').find({}).toArray(),
    db.collection('products').find({}).toArray(),
  ]);

  let salesDaily = [];
  try {
    salesDaily = await db.collection('sales_history_daily').find({}).toArray();
  } catch (_) {
    salesDaily = [];
  }

  const rawCluster =
    user && user.ml_cluster_id !== undefined && user.ml_cluster_id !== null
      ? Number(user.ml_cluster_id)
      : null;
  const mlClusterId =
    rawCluster !== null && Number.isFinite(rawCluster) ? rawCluster : null;

  let clusterItemScores = new Map();
  let clusterAddonScores = new Map();
  let forceFallback = false;

  if (mlClusterId !== null) {
    try {
      const collected = await collectClusterPreferences(db, mlClusterId);
      clusterItemScores = collected.clusterItemScores;
      clusterAddonScores = collected.clusterAddonScores;
      if (clusterItemScores.size === 0 && clusterAddonScores.size === 0) {
        forceFallback = true;
      }
    } catch (_) {
      clusterItemScores.clear();
      clusterAddonScores.clear();
      forceFallback = true;
    }
  }

  // Gợi ý theo cụm ML: users.ml_cluster_id -> ml_cluster_recommendations.cluster_id -> recommended_item_codes
  let clusterRecommendation = null;
  if (mlClusterId !== null) {
    try {
      const rec = await db.collection('ml_cluster_recommendations').findOne({ cluster_id: mlClusterId });
      const codes = Array.isArray(rec && rec.recommended_item_codes) ? rec.recommended_item_codes : [];
      if (rec && codes.length) {
        const productByCode = new Map(
          products.filter((p) => p && p.item_code && p.is_active !== false).map((p) => [String(p.item_code), p]),
        );
        const addonByProduct = new Map(
          addons.filter((a) => a && a.product_id && a.is_active !== false).map((a) => [String(a.product_id), a]),
        );
        const items = [];
        for (const code of codes) {
          const p = productByCode.get(String(code));
          if (!p) continue;
          const a = addonByProduct.get(String(p._id)) || null;
          items.push({
            itemCode: p.item_code,
            productId: p._id,
            addonId: a ? a._id : null,
            name: p.name,
            category: p.category || null,
            price: Number(p.price || 0),
            imageUrl: p.image_url || null,
          });
        }
        if (items.length) {
          clusterRecommendation = {
            clusterId: mlClusterId,
            personaName: rec.persona_name || null,
            items,
          };
        }
      }
    } catch (_) {
      clusterRecommendation = null;
    }
  }

  const built = buildBookingMenuRecommendations({
    addons,
    products,
    packageInclusions,
    salesDaily,
    clusterItemScores,
    clusterAddonScores,
    daypart,
    guestCount,
    mlClusterId,
    isAuthenticated: Boolean(user),
    forceFallback,
    recommendLimit,
  });

  return {
    strategy: built.strategy,
    hasHistory: built.hasHistory,
    fallbackUsed: built.fallbackUsed,
    customerGroup: {
      isAuthenticated: Boolean(user),
      userId: user ? user._id : null,
      mlClusterId: built.mlClusterId,
      tier: (user && user.tier) || null,
    },
    context: {
      spaceId: space ? space._id : null,
      packageId: pkg ? pkg._id : null,
      guestCount,
      daypart,
      recommendLimit,
    },
    inclusions: built.inclusions,
    inclusionsByType: built.inclusionsByType,
    addons: built.addons,
    recommendedInclusions: built.recommendedInclusions,
    recommendedAddons: built.recommendedAddons,
    clusterRecommendation,
  };
}

/* ------------------------------------------------ 2. Admin Forecast: Số lượng món ngày hôm sau -> Nguyên vật liệu */

/**
 * GET /api/admin/forecast & GET /api/admin/forecast/ingredients
 * Dự báo số lượng món (`dishes`) cho ngày hôm sau (mặc định theo UTC+7)
 * và từ đó tính ra số lượng nguyên vật liệu phù hợp (`items`).
 */
async function listIngredientForecasts(db, query = {}, now = new Date()) {
  const range = parseForecastDateRange(query, now, 'forecast');

  const [ingredients, products, recipes, rawForecasts] = await Promise.all([
    db.collection('ingredients').find({}).sort({ ingredient_code: 1 }).toArray(),
    db.collection('products').find({}).toArray(),
    db.collection('recipes').find({}).toArray(),
    db.collection('demand_forecasts').find({}).toArray(),
  ]);

  let forecasts = rawForecasts;
  let fallbackUsed = false;

  if (forecasts.length === 0 && String(query.fallback || '').toLowerCase() === 'true') {
    const salesDaily = await db.collection('sales_history_daily').find({}).toArray();
    if (salesDaily.length > 0) {
      fallbackUsed = true;
      const distinctDays = new Set();
      const byItem = new Map();
      for (const row of salesDaily) {
        if (!row || (!row.item_id && !row.item_code)) continue;
        const dayKey = row.sale_date || row.date || row.day;
        if (dayKey) distinctDays.add(String(dayKey).slice(0, 10));
        const key = row.item_id ? `id:${String(row.item_id)}` : `code:${String(row.item_code)}`;
        const cur = byItem.get(key) || {
          item_id: row.item_id || null,
          item_code: row.item_code || null,
          totalQty: 0,
          days: 0,
        };
        cur.totalQty += Math.max(0, Number(row.qty) || 0);
        cur.days += 1;
        byItem.set(key, cur);
      }

      const dayDenominator = Math.max(1, distinctDays.size || 30);
      const dayMs = 24 * 60 * 60 * 1000;
      const synthetic = [];
      for (const item of byItem.values()) {
        const avgDaily = item.totalQty / Math.max(dayDenominator, item.days || 1);
        const predicted = Math.max(1, Math.round(avgDaily));
        const lower = Math.max(0, Math.round(predicted * 0.8));
        const upper = Math.max(predicted + 1, Math.round(predicted * 1.25));
        for (let d = 0; d < range.days; d += 1) {
          synthetic.push({
            item_id: item.item_id,
            item_code: item.item_code,
            forecast_date: new Date(range.from.getTime() + d * dayMs),
            predicted_qty: predicted,
            lower_qty: lower,
            upper_qty: upper,
            model_version: 'HIST_SEASONAL_V1',
          });
        }
      }
      forecasts = synthetic;
    }
  }

  const result = computeIngredientForecasts({
    ingredients,
    products,
    recipes,
    forecasts,
    range,
  });

  return {
    targetDate: range.fromDate,
    dishes: result.dishes,
    items: result.items,
    total: result.items.length,
    totalDishes: result.totalDishes,
    totalIngredients: result.totalIngredients,
    forecastRecordsCount: result.forecastRecordsCount,
    skippedMalformedCount: result.skippedMalformedCount,
    fallbackUsed,
    source: fallbackUsed ? 'HISTORICAL_FALLBACK' : 'ML_FORECAST',
    filters: { from: range.fromDate, to: range.toDate, days: range.days },
    message: result.message,
  };
}

/**
 * GET /api/admin/forecast/ingredients/:id
 * Xem chi tiết một nguyên vật liệu kèm lịch sử nhập/xuất kho (`ingredient_stock_movements`) đúng thứ tự mới nhất trước.
 */
async function getIngredientForecastDetail(db, id, query = {}, now = new Date()) {
  const _id = mustOid(id, 'ingredientId');
  const ingredient = await db.collection('ingredients').findOne({ _id });
  if (!ingredient) {
    throw new AdminError(404, 'INGREDIENT_NOT_FOUND', 'Không tìm thấy nguyên vật liệu.');
  }

  const limit = parseLimitParam(query.limit, 50, 200);
  const hasDateFilter =
    (query.from != null && String(query.from).trim() !== '') ||
    (query.to != null && String(query.to).trim() !== '');
  const range = hasDateFilter ? parseForecastDateRange(query, now, 'forecast') : null;

  const [movements, recipes, products, forecasts] = await Promise.all([
    db
      .collection('ingredient_stock_movements')
      .find({ ingredient_id: _id })
      .sort({ created_at: -1, _id: -1 })
      .limit(limit)
      .toArray(),
    db.collection('recipes').find({ ingredient_id: _id }).toArray(),
    db.collection('products').find({}).toArray(),
    db.collection('demand_forecasts').find({}).toArray(),
  ]);

  const computed = computeIngredientForecasts({
    ingredients: [ingredient],
    products,
    recipes,
    forecasts,
    range,
  });

  const forecastSummary =
    computed.items.length > 0
      ? computed.items[0]
      : {
          predictedDemand: 0,
          lowerDemand: 0,
          upperDemand: 0,
          projectedRemainingStock: Number(ingredient.current_stock ?? 0),
          shortfallQty: 0,
          recommendedOrderQty: Math.max(
            0,
            Number(ingredient.min_stock_level ?? 0) - Number(ingredient.current_stock ?? 0),
          ),
          needsRestock: Number(ingredient.current_stock ?? 0) < Number(ingredient.min_stock_level ?? 0),
          dishBreakdown: [],
          dailyForecasts: [],
        };

  return {
    ingredient: {
      ...ingredient,
      predictedDemand: forecastSummary.predictedDemand,
      lowerDemand: forecastSummary.lowerDemand,
      upperDemand: forecastSummary.upperDemand,
      projectedRemainingStock: forecastSummary.projectedRemainingStock,
      shortfallQty: forecastSummary.shortfallQty,
      recommendedOrderQty: forecastSummary.recommendedOrderQty,
      needsRestock: forecastSummary.needsRestock,
      dishBreakdown: forecastSummary.dishBreakdown,
      dailyForecasts: forecastSummary.dailyForecasts,
    },
    recipes,
    movements,
    movementCount: movements.length,
  };
}

/**
 * POST /api/admin/forecast/ingredients/:id/movements
 * Ghi nhận giao dịch nhập/xuất/kiểm kê/hủy kho (`IN` / `OUT` / `ADJUST` / `DISCARD`) và cập nhật `current_stock`.
 */
async function createIngredientMovement(db, id, body = {}, actor = null, now = new Date()) {
  const _id = mustOid(id, 'ingredientId');
  const ingredient = await db.collection('ingredients').findOne({ _id });
  if (!ingredient) {
    throw new AdminError(404, 'INGREDIENT_NOT_FOUND', 'Không tìm thấy nguyên vật liệu.');
  }

  const validated = validateStockMovement({
    currentStock: ingredient.current_stock ?? 0,
    movementType: body.movementType || body.movement_type,
    quantityChange: body.quantityChange ?? body.quantity_change,
    reason: body.reason,
  });

  const movementDoc = {
    _id: new ObjectId(),
    ingredient_id: _id,
    movement_type: validated.movementType,
    quantity_change: validated.quantityChange,
    balance_after: validated.balanceAfter,
    reason: validated.reason,
    created_by: actor && actor._id ? toOid(actor._id) : null,
    created_at: now,
  };

  await db.collection('ingredient_stock_movements').insertOne(movementDoc);
  await db.collection('ingredients').updateOne(
    { _id },
    {
      $set: {
        current_stock: validated.balanceAfter,
        stock_updated_at: now,
        updated_at: now,
      },
    },
  );

  const updatedIngredient = await db.collection('ingredients').findOne({ _id });
  return {
    movement: movementDoc,
    ingredient: updatedIngredient,
  };
}

/* ------------------------------------------------ 3. Xu hướng Doanh thu & Tiêu thụ */

async function getForecastTrends(db, query = {}, now = new Date()) {
  const range = parseForecastDateRange(query, now, 'trend');

  let productOid = null;
  let product = null;
  if (query.productId !== undefined && query.productId !== null && String(query.productId).trim() !== '') {
    productOid = mustOid(query.productId, 'productId');
    product = await db.collection('products').findOne({ _id: productOid });
    if (!product) {
      throw new AdminError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
    }
  }

  if (productOid) {
    const txRows = await db
      .collection('sales_transactions')
      .find({
        item_id: productOid,
        sale_date: { $gte: range.from, $lt: range.to },
      })
      .sort({ sale_date: 1 })
      .toArray();

    const built = buildTrendSeries({
      rows: txRows,
      mode: 'transactions',
      productId: productOid,
    });

    return {
      filters: {
        from: range.fromDate,
        to: range.toDate,
        days: range.days,
        productId: String(productOid),
        productName: product ? product.name : null,
        itemCode: product ? product.item_code : null,
      },
      ...built,
    };
  }

  const dailyRows = await db
    .collection('sales_history_daily')
    .find({
      sale_date: { $gte: range.from, $lt: range.to },
    })
    .sort({ sale_date: 1 })
    .toArray();

  const built = buildTrendSeries({
    rows: dailyRows,
    mode: 'daily',
    productId: null,
  });

  return {
    filters: {
      from: range.fromDate,
      to: range.toDate,
      days: range.days,
      productId: null,
    },
    ...built,
  };
}

/* ------------------------------------------------ 4. Cảnh báo tồn kho (Inventory Alerts) */

async function listInventoryAlerts(db, query = {}) {
  const filter = {};
  if (query.status !== undefined && query.status !== null && String(query.status).trim() !== '') {
    const st = String(query.status).trim().toUpperCase();
    if (!ALERT_STATUSES.includes(st)) {
      throw new AdminError(422, 'VALIDATION_ERROR', 'status phải là OPEN, ACKNOWLEDGED hoặc RESOLVED.');
    }
    filter.status = st;
  }
  if (query.severity !== undefined && query.severity !== null && String(query.severity).trim() !== '') {
    const sev = String(query.severity).trim().toUpperCase();
    if (!ALERT_SEVERITIES.includes(sev)) {
      throw new AdminError(422, 'VALIDATION_ERROR', 'severity phải là INFO, WARNING hoặc CRITICAL.');
    }
    filter.severity = sev;
  }
  const rawType = query.alertType ?? query.alert_type;
  if (rawType !== undefined && rawType !== null && String(rawType).trim() !== '') {
    const tp = String(rawType).trim().toUpperCase();
    if (!ALERT_TYPES.includes(tp)) {
      throw new AdminError(422, 'VALIDATION_ERROR', 'alertType phải là LOW_STOCK, REORDER hoặc DEFROST.');
    }
    filter.alert_type = tp;
  }

  const [alerts, ingredients] = await Promise.all([
    db.collection('inventory_alerts').find(filter).sort({ generated_at: -1, _id: -1 }).toArray(),
    db.collection('ingredients').find({}).toArray(),
  ]);

  const ingById = new Map(ingredients.map((i) => [String(i._id), i]));
  const items = alerts.map((a) => {
    const ing = ingById.get(String(a.ingredient_id));
    return {
      ...a,
      ingredientName: ing ? ing.ingredient_name : a.ingredient_code,
      unit: ing ? ing.unit : null,
      storageType: ing ? ing.storage_type : null,
    };
  });

  return {
    items,
    total: items.length,
    filters: {
      status: filter.status || null,
      severity: filter.severity || null,
      alertType: filter.alert_type || null,
    },
  };
}

async function updateInventoryAlertStatus(db, id, body = {}, actor = null, now = new Date()) {
  const _id = mustOid(id, 'alertId');
  const current = await db.collection('inventory_alerts').findOne({ _id });
  const nextStatus = validateAlertTransition(current, body.status);

  const updateFields = {
    status: nextStatus,
    acknowledged_by: actor && actor._id ? toOid(actor._id) : current.acknowledged_by ?? null,
    acknowledged_at: now,
  };

  await db.collection('inventory_alerts').updateOne({ _id }, { $set: updateFields });
  const updated = await db.collection('inventory_alerts').findOne({ _id });
  return { alert: updated };
}

/**
 * UC-35: Phân tích gợi ý bán kèm (Co-occurring items, Top trending & ML Clusters cho Admin).
 */
async function getAdminRecommendAnalysis(db, query = {}) {
  const limit = parseLimitParam(query.limit, 12, 50);

  const [
    products,
    addons,
    bookingInclusions,
    bookingAddons,
    mlClusters,
    mlGlobal,
    salesDaily,
  ] = await Promise.all([
    db.collection('products').find({}).toArray(),
    db.collection('addons').find({}).toArray(),
    db.collection('booking_inclusions').find({}).toArray(),
    db.collection('booking_addons').find({}).toArray(),
    db.collection('ml_cluster_recommendations').find({}).toArray(),
    db.collection('ml_global_trending').find({}).toArray(),
    db.collection('sales_history_daily').find({}).toArray(),
  ]);

  const catalogByKey = new Map();
  for (const p of products) {
    if (!p) continue;
    const entry = {
      id: p._id ? String(p._id) : null,
      code: p.code || p.item_code || null,
      name: p.name || p.product_name || 'Sản phẩm',
      category: p.category || p.type || 'PRODUCT',
      price: Number(p.price ?? p.base_price ?? 0) || 0,
    };
    if (entry.id) catalogByKey.set(`p:${entry.id}`, entry);
    if (entry.code) {
      catalogByKey.set(`c:${String(entry.code)}`, entry);
      catalogByKey.set(`c:${String(entry.code).trim().toUpperCase()}`, entry);
    }
  }
  for (const a of addons) {
    if (!a) continue;
    const linked = a.product_id ? catalogByKey.get(`p:${String(a.product_id)}`) : null;
    const entry = {
      id: a._id ? String(a._id) : null,
      productId: a.product_id ? String(a.product_id) : null,
      code: a.code || a.addon_code || a.item_code || linked?.code || null,
      name: a.name || a.addon_name || linked?.name || 'Add-on',
      category: a.category || a.type || linked?.category || 'ADDON',
      price: Number(a.price ?? a.unit_price ?? linked?.price ?? 0) || 0,
    };
    if (entry.id) catalogByKey.set(`a:${entry.id}`, entry);
    if (entry.code && !catalogByKey.has(`c:${String(entry.code)}`)) {
      catalogByKey.set(`c:${String(entry.code)}`, entry);
      catalogByKey.set(`c:${String(entry.code).trim().toUpperCase()}`, entry);
    }
  }

  const resolveItemMeta = (row, fallbackKind) => {
    const pid = row.product_id ? String(row.product_id) : null;
    const aid = row.addon_id ? String(row.addon_id) : null;
    const iid = row.item_id ? String(row.item_id) : null;
    const code = row.item_code || row.product_code || row.addon_code || row.code || null;
    const upperCode = code ? String(code).trim().toUpperCase() : null;

    const meta =
      (pid && catalogByKey.get(`p:${pid}`)) ||
      (aid && catalogByKey.get(`a:${aid}`)) ||
      (iid && (catalogByKey.get(`p:${iid}`) || catalogByKey.get(`a:${iid}`))) ||
      (code && (catalogByKey.get(`c:${String(code)}`) || catalogByKey.get(`c:${upperCode}`))) ||
      null;

    const key =
      (meta?.productId || meta?.id || pid || aid || iid || code)
        ? String(meta?.productId || meta?.id || pid || aid || iid || code)
        : null;
    if (!key) return null;

    return {
      key,
      code: meta?.code || code || key.slice(-6).toUpperCase(),
      name: row.item_name || row.product_name || row.addon_name || row.name || meta?.name || 'Món KÉN',
      category: meta?.category || row.item_type || fallbackKind,
      price: Number(row.unit_price ?? row.price ?? meta?.price ?? 0) || 0,
      qty: Math.max(1, Number(row.qty ?? row.quantity ?? 1) || 1),
    };
  };

  const bookingsMap = new Map();
  const itemFreq = new Map();

  const ingestRows = (rows, kind) => {
    for (const row of rows) {
      if (!row || !row.booking_id) continue;
      const meta = resolveItemMeta(row, kind);
      if (!meta) continue;
      const bKey = String(row.booking_id);
      let basket = bookingsMap.get(bKey);
      if (!basket) {
        basket = new Map();
        bookingsMap.set(bKey, basket);
      }
      if (!basket.has(meta.key)) {
        basket.set(meta.key, meta);
        const freq = itemFreq.get(meta.key) || { ...meta, orderCount: 0, totalQty: 0 };
        freq.orderCount += 1;
        itemFreq.set(meta.key, freq);
      }
      const freqRef = itemFreq.get(meta.key);
      if (freqRef) freqRef.totalQty += meta.qty;
    }
  };

  ingestRows(bookingInclusions, 'INCLUSION');
  ingestRows(bookingAddons, 'ADDON');

  const pairCounts = new Map();
  let multiItemBookings = 0;
  let totalBasketItems = 0;

  for (const basket of bookingsMap.values()) {
    const items = Array.from(basket.values());
    totalBasketItems += items.length;
    if (items.length < 2) continue;
    multiItemBookings += 1;
    items.sort((a, b) => a.key.localeCompare(b.key));
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        const pairKey = `${a.key}::${b.key}`;
        const cur = pairCounts.get(pairKey) || {
          itemA: a,
          itemB: b,
          pairCount: 0,
        };
        cur.pairCount += 1;
        pairCounts.set(pairKey, cur);
      }
    }
  }

  const totalBookingsAnalyzed = bookingsMap.size;
  const coOccurringPairs = Array.from(pairCounts.values())
    .sort((x, y) => y.pairCount - x.pairCount)
    .slice(0, limit)
    .map((p, idx) => {
      const countA = itemFreq.get(p.itemA.key)?.orderCount || p.pairCount;
      const countB = itemFreq.get(p.itemB.key)?.orderCount || p.pairCount;
      const supportPct =
        totalBookingsAnalyzed > 0 ? Number(((p.pairCount / totalBookingsAnalyzed) * 100).toFixed(1)) : 0;
      const confidencePct = countA > 0 ? Number(((p.pairCount / countA) * 100).toFixed(1)) : 0;
      const lift =
        totalBookingsAnalyzed > 0 && countA > 0 && countB > 0
          ? Number(((p.pairCount * totalBookingsAnalyzed) / (countA * countB)).toFixed(2))
          : 1;
      return {
        rank: idx + 1,
        itemA: { id: p.itemA.key, code: p.itemA.code, name: p.itemA.name, category: p.itemA.category },
        itemB: { id: p.itemB.key, code: p.itemB.code, name: p.itemB.name, category: p.itemB.category },
        pairCount: p.pairCount,
        supportPct,
        confidencePct,
        lift,
      };
    });

  const trendingResult = buildTopTrendingRecommendations({
    addons,
    products,
    salesDaily,
    limit,
  });

  const globalTrendingItems =
    mlGlobal.length > 0
      ? [...mlGlobal]
          .sort((a, b) => {
            const rA = Number(a?.rank);
            const rB = Number(b?.rank);
            if (Number.isFinite(rA) && rA > 0 && Number.isFinite(rB) && rB > 0 && rA !== rB) {
              return rA - rB;
            }
            return (Number(b?.trending_score ?? 0) || 0) - (Number(a?.trending_score ?? 0) || 0);
          })
          .slice(0, limit)
          .map((g, idx) => {
            const meta = resolveItemMeta(g, g.item_type || 'DRINK');
            const freq = meta ? itemFreq.get(meta.key) : null;
            const totalQty = freq?.totalQty || 0;
            const unitPrice = meta?.price || 0;
            return {
              rank: Number(g.rank || idx + 1),
              itemId: meta?.key || g.item_code || String(g._id || idx),
              itemCode: g.item_code || meta?.code || '',
              name: meta?.name || g.item_name || 'Món KÉN',
              category: g.category || g.item_type || meta?.category || 'DRINK',
              trendingScore: Number(g.trending_score ?? g.score ?? 0) || 0,
              totalQty,
              totalRevenue: totalQty * unitPrice,
              price: unitPrice,
            };
          })
      : trendingResult.items || [];

  const clusters = mlClusters.map((c, idx) => {
    const rawItems = Array.isArray(c.recommended_items)
      ? c.recommended_items
      : Array.isArray(c.items)
        ? c.items
        : Array.isArray(c.recommended_item_codes)
          ? c.recommended_item_codes.map((code) => ({ item_code: code }))
          : [];
    const mappedItems = rawItems.slice(0, 5).map((ri) => {
      const itemObj = typeof ri === 'string' ? { item_code: ri } : ri || {};
      const m = resolveItemMeta(itemObj, 'ADDON');
      return {
        name: itemObj?.name || itemObj?.item_name || m?.name || itemObj?.item_code || 'Món gợi ý',
        code: itemObj?.item_code || itemObj?.code || m?.code || '',
        score: Number(itemObj?.score ?? itemObj?.weight ?? 0) || 0,
      };
    });
    const personaName =
      c.persona_name || c.cluster_name || c.persona || c.description || `Nhóm khách hàng #${idx + 1}`;
    return {
      clusterId: c.cluster_id ?? c._id ?? `CLUSTER_${idx + 1}`,
      persona_name: personaName,
      name: personaName,
      size: Number(c.customer_count ?? c.user_count ?? c.size ?? 0) || 0,
      items: mappedItems,
    };
  });

  return {
    summary: {
      totalBookingsAnalyzed,
      multiItemBookings,
      multiItemRate:
        totalBookingsAnalyzed > 0 ? Number(((multiItemBookings / totalBookingsAnalyzed) * 100).toFixed(1)) : 0,
      totalPairsFound: pairCounts.size,
      avgBasketItems:
        totalBookingsAnalyzed > 0 ? Number((totalBasketItems / totalBookingsAnalyzed).toFixed(2)) : 0,
      mlGlobalCount: mlGlobal.length,
      mlClusterCount: clusters.length,
    },
    coOccurringPairs,
    topTrending: globalTrendingItems,
    clusters,
  };
}

module.exports = {
  getTopTrendingRecommendations,
  getBookingMenuRecommendations,
  listIngredientForecasts,
  getIngredientForecastDetail,
  createIngredientMovement,
  getForecastTrends,
  listInventoryAlerts,
  updateInventoryAlertStatus,
  getAdminRecommendAnalysis,
};

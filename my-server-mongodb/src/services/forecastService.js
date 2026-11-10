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

  const built = buildTopTrendingRecommendations({
    addons,
    products,
    salesDaily,
    daypart,
    guestCount,
    limit,
    excludeProductIds,
  });

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

  const [ingredients, products, recipes, forecasts] = await Promise.all([
    db.collection('ingredients').find({}).sort({ ingredient_code: 1 }).toArray(),
    db.collection('products').find({}).toArray(),
    db.collection('recipes').find({}).toArray(),
    db.collection('demand_forecasts').find({}).toArray(),
  ]);

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

module.exports = {
  getTopTrendingRecommendations,
  getBookingMenuRecommendations,
  listIngredientForecasts,
  getIngredientForecastDetail,
  createIngredientMovement,
  getForecastTrends,
  listInventoryAlerts,
  updateInventoryAlertStatus,
};

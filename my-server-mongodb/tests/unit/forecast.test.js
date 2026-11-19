'use strict';
/**
 * Kiểm thử đơn vị Module 12 — Recommendation & Forecast Domain (src/domain/forecast.js).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseForecastDateRange,
  resolveDaypart,
  buildTopTrendingRecommendations,
  buildBookingMenuRecommendations,
  computeIngredientForecasts,
  buildTrendSeries,
  validateStockMovement,
  validateAlertTransition,
} = require('../../src/domain/forecast');

const NOW = new Date('2026-11-10T05:00:00Z'); // 12:00 giờ VN, 10/11/2026

/* ------------------------------------------------ Khoảng ngày & Daypart */
test('TC-REC-06, TC-REC-12\t[REC-06, REC-12] parseForecastDateRange: mặc định Forecast là ngày hôm sau (tomorrow VN), hỗ trợ lọc [from, to] và từ chối from > to / sai định dạng 422', () => {
  const tomorrowRange = parseForecastDateRange({}, NOW, 'forecast');
  assert.equal(tomorrowRange.days, 1);
  assert.equal(tomorrowRange.fromDate, '2026-11-11');
  assert.equal(tomorrowRange.toDate, '2026-11-11');

  const r = parseForecastDateRange({ from: '2026-11-01', to: '2026-11-07' }, NOW, 'forecast');
  assert.equal(r.days, 7);
  assert.equal(r.fromDate, '2026-11-01');
  assert.equal(r.toDate, '2026-11-07');

  assert.throws(
    () => parseForecastDateRange({ from: '2026-12-31', to: '2026-01-01' }, NOW, 'trend'),
    (e) => e.code === 'VALIDATION_ERROR' && e.status === 422,
  );
  for (const bad of [{ from: 'abc!@#' }, { to: '2026-02-30' }, { from: '2024-01-01', to: '2026-12-31' }]) {
    assert.throws(
      () => parseForecastDateRange(bad, NOW, 'trend'),
      (e) => e.code === 'VALIDATION_ERROR' && e.status === 422,
    );
  }
});

test('TC-REC-17\t[REC-17] resolveDaypart: phân loại MORNING (<12h VN), AFTERNOON (12h-16h59 VN), EVENING (>=17h VN) và kiểm tra daypart hợp lệ', () => {
  assert.equal(resolveDaypart('2026-11-10T02:00:00Z'), 'MORNING');   // 09:00 VN
  assert.equal(resolveDaypart('2026-11-10T07:00:00Z'), 'AFTERNOON'); // 14:00 VN
  assert.equal(resolveDaypart('2026-11-10T12:00:00Z'), 'EVENING');   // 19:00 VN
  assert.equal(resolveDaypart(null, 'morning'), 'MORNING');
  assert.throws(
    () => resolveDaypart(null, 'MIDNIGHT'),
    (e) => e.code === 'VALIDATION_ERROR' && e.status === 422,
  );
});

/* ------------------------------------------------ Top Trending (Không phân role) */
test('TC-REC-01..04\tbuildTopTrendingRecommendations: Top Trending không phân role (Guest/Customer như nhau), đường dẫn /top-trending, lọc món ẩn và fallback khi lịch sử rỗng', () => {
  const addons = [
    { _id: 'a1', product_id: 'p1', name: 'Cà phê đen', price: 40000, unit: 'PER_ITEM', is_active: true },
    { _id: 'a2', product_id: 'p2', name: 'Bánh Croissant', price: 45000, unit: 'PER_ITEM', is_active: true },
    { _id: 'a3', product_id: 'p3', name: 'Món đã ẩn', price: 50000, unit: 'PER_ITEM', is_active: false },
    { _id: 'a4', product_id: 'p3', name: 'Addon trỏ product ẩn', price: 50000, unit: 'PER_ITEM', is_active: true },
  ];
  const products = [
    { _id: 'p1', item_code: 'CF_DEN', name: 'Cà phê đen', category: 'DRINK', price: 40000, is_active: true },
    { _id: 'p2', item_code: 'CR_BO', name: 'Bánh Croissant', category: 'PASTRY', price: 45000, is_active: true },
    { _id: 'p3', item_code: 'HIDDEN', name: 'Món đã ẩn', category: 'DRINK', price: 50000, is_active: false },
  ];
  const salesDaily = [
    { item_id: 'p3', item_code: 'HIDDEN', qty: 999, revenue_vnd: 999000, qty_by_daypart: { MORNING: 500, AFTERNOON: 300, EVENING: 199 } },
    { item_id: 'p1', item_code: 'CF_DEN', qty: 50, revenue_vnd: 2000000, qty_by_daypart: { MORNING: 40, AFTERNOON: 5, EVENING: 5 } },
    { item_id: 'p2', item_code: 'CR_BO', qty: 30, revenue_vnd: 1350000, qty_by_daypart: { MORNING: 5, AFTERNOON: 20, EVENING: 5 } },
  ];

  const trending = buildTopTrendingRecommendations({ addons, products, salesDaily });
  assert.equal(trending.roleScoped, false);
  assert.equal(trending.topTrendingPath, '/top-trending');
  assert.equal(trending.strategy, 'TRENDING_POPULAR');
  assert.equal(trending.hasHistory, true);
  assert.equal(trending.items.length, 2);
  assert.equal(trending.items[0].name, 'Cà phê đen');
  assert.equal(trending.items[0].rank, 1);
  assert.equal(trending.items[0].listedPrice, 40000);
  assert.ok(trending.items.every((i) => i.is_active === true && i.productId !== 'p3'));

  // Hỗ trợ excludeProductIds & daypart
  const afternoon = buildTopTrendingRecommendations({
    addons,
    products,
    salesDaily,
    daypart: 'AFTERNOON',
  });
  assert.equal(afternoon.items[0].name, 'Bánh Croissant'); // 30 + 20*1.5 = 60 > 50 + 5*1.5 = 57.5

  // Lịch sử bán hàng rỗng -> DEFAULT_FALLBACK, không lỗi
  const resEmpty = buildTopTrendingRecommendations({ addons, products, salesDaily: [] });
  assert.equal(resEmpty.hasHistory, false);
  assert.equal(resEmpty.strategy, 'DEFAULT_FALLBACK');
  assert.equal(resEmpty.items.length, 2);
});

/* ------------------------------------------------ Recommend theo nhóm Customer trong luồng Booking */
test('TC-REC-17\tbuildBookingMenuRecommendations: phân nhóm Customer (ml_cluster_id) trong menu Inclusion & Add-ons của luồng Booking, tính phụ phí package_inclusions và fallback an toàn', () => {
  const products = [
    { _id: 'p1', item_code: 'CF_DEN', name: 'Cà phê đen', category: 'DRINK', price: 40000, is_active: true },
    { _id: 'p2', item_code: 'MATCHA', name: 'Matcha Latte', category: 'DRINK', price: 59000, is_active: true },
    { _id: 'p3', item_code: 'CR_BO', name: 'Bánh Croissant', category: 'PASTRY', price: 45000, is_active: true },
    { _id: 'p4', item_code: 'HIDDEN', name: 'Món đã ẩn', category: 'DRINK', price: 50000, is_active: false },
  ];
  const addons = [
    { _id: 'a1', product_id: 'p1', name: 'Cà phê đen', price: 40000, unit: 'PER_ITEM', is_active: true },
    { _id: 'a2', product_id: 'p3', name: 'Bánh Croissant', price: 45000, unit: 'PER_ITEM', is_active: true },
    { _id: 'a3', product_id: null, name: 'Màn hình rời 24 inch', price: 50000, unit: 'PER_BOOKING', is_active: true },
    { _id: 'a4', product_id: 'p4', name: 'Addon sản phẩm ẩn', price: 50000, unit: 'PER_ITEM', is_active: true },
  ];
  const packageInclusions = [
    { _id: 'pi1', item_type: 'STANDARD_DRINK', subsidy_limit: 50000, is_active: true },
    { _id: 'pi2', item_type: 'PASTRY', subsidy_limit: null, is_active: true },
  ];
  const salesDaily = [
    { item_id: 'p1', item_code: 'CF_DEN', qty: 50 },
    { item_id: 'p2', item_code: 'MATCHA', qty: 10 },
    { item_id: 'p3', item_code: 'CR_BO', qty: 20 },
  ];

  // Customer thuộc Cụm #2: ưa chuộng Matcha Latte (p2) và Màn hình rời (a3)
  const personalized = buildBookingMenuRecommendations({
    addons,
    products,
    packageInclusions,
    salesDaily,
    clusterItemScores: new Map([['p2', 40]]),
    clusterAddonScores: new Map([['a3', 35]]),
    mlClusterId: 2,
    isAuthenticated: true,
    recommendLimit: 2,
  });

  assert.equal(personalized.strategy, 'PERSONALIZED_ML_CLUSTER');
  assert.equal(personalized.fallbackUsed, false);
  assert.equal(personalized.mlClusterId, 2);
  assert.equal(personalized.inclusions.length, 3); // Không chứa p4 (ẩn)
  assert.equal(personalized.inclusions[0].name, 'Matcha Latte');
  assert.equal(personalized.inclusions[0].isRecommended, true);
  assert.equal(personalized.inclusions[0].subsidyLimit, 50000);
  assert.equal(personalized.inclusions[0].surchargeAmount, 9000); // 59k - 50k
  assert.equal(personalized.inclusions[0].packageInclusionId, 'pi1');

  assert.equal(personalized.addons.length, 3); // Không chứa a4 (trỏ p4 ẩn)
  assert.equal(personalized.addons[0].name, 'Màn hình rời 24 inch');
  assert.equal(personalized.addons[0].isRecommended, true);

  // Customer chưa có cụm hoặc Guest -> fallback xu hướng chung, không lỗi
  const fallback = buildBookingMenuRecommendations({
    addons,
    products,
    packageInclusions,
    salesDaily,
    clusterItemScores: new Map(),
    clusterAddonScores: new Map(),
    mlClusterId: null,
    isAuthenticated: true,
  });
  assert.equal(fallback.strategy, 'TRENDING_FALLBACK');
  assert.equal(fallback.fallbackUsed, true);
  assert.equal(fallback.inclusions[0].name, 'Cà phê đen'); // Xu hướng chung (50 lượt)
  assert.equal(fallback.addons[0].name, 'Cà phê đen');
});

/* ------------------------------------------------ Forecast nguyên vật liệu & số lượng món ngày hôm sau */
test('TC-REC-05..07, TC-REC-16\t[REC-05..07, REC-16] computeIngredientForecasts: tính số lượng món ngày hôm sau (dishes) rồi quy đổi ra số lượng nguyên vật liệu phù hợp (items), bỏ qua bản ghi ML hỏng', () => {
  const ingredients = [
    { _id: 'ing1', ingredient_code: 'ING_001', ingredient_name: 'Hạt cà phê Robusta', unit: 'g', status: 'ACTIVE', current_stock: 200, min_stock_level: 500 },
    { _id: 'ing2', ingredient_code: 'ING_002', ingredient_name: 'Sữa tươi thanh trùng', unit: 'ml', status: 'ACTIVE', current_stock: 5000, min_stock_level: 1000 },
  ];
  const products = [
    { _id: 'p1', item_code: 'CF_DEN', name: 'Cà phê đen', category: 'DRINK', price: 40000, is_active: true },
    { _id: 'p2', item_code: 'CF_SUA', name: 'Cà phê sữa', category: 'DRINK', price: 45000, is_active: true },
  ];
  const recipes = [
    { item_id: 'p1', item_code: 'CF_DEN', ingredient_id: 'ing1', quantity_per_item: 18, unit: 'g' },
    { item_id: 'p2', item_code: 'CF_SUA', ingredient_id: 'ing1', quantity_per_item: 15, unit: 'g' },
    { item_id: 'p2', item_code: 'CF_SUA', ingredient_id: 'ing2', quantity_per_item: 60, unit: 'ml' },
  ];

  // Collection demand_forecasts rỗng -> mảng rỗng kèm thông báo
  const emptyRes = computeIngredientForecasts({ ingredients, products, recipes, forecasts: [] });
  assert.deepEqual(emptyRes.items, []);
  assert.deepEqual(emptyRes.dishes, []);
  assert.ok(typeof emptyRes.message === 'string' && emptyRes.message.length > 0);

  // Dự báo cho ngày hôm sau (2026-11-11, hỗ trợ cả 00:00Z và 17:00Z ngày trước = 00:00+07:00) + bỏ qua 2 bản ghi ML hỏng
  const tomorrowRange = parseForecastDateRange({}, NOW, 'forecast');
  const forecasts = [
    { item_id: 'p1', item_code: 'CF_DEN', forecast_date: new Date('2026-11-11T00:00:00Z'), predicted_qty: 10, lower_qty: 8, upper_qty: 12, model_version: 'LGBM_v1' },
    { item_id: 'p2', item_code: 'CF_SUA', forecast_date: new Date('2026-11-10T17:00:00Z'), predicted_qty: 5, lower_qty: 4, upper_qty: 6, model_version: 'LGBM_v1' },
    { item_id: 'p1', item_code: 'CF_DEN', forecast_date: new Date('2026-11-20T00:00:00Z'), predicted_qty: 99, model_version: 'LGBM_v1' },
    { item_id: null, forecast_date: 'invalid-date', predicted_qty: -10 },
    { item_id: 'p1', forecast_date: null, predicted_qty: 'NaN' },
  ];
  const calc = computeIngredientForecasts({ ingredients, products, recipes, forecasts, range: tomorrowRange });
  assert.equal(calc.skippedMalformedCount, 2);
  assert.equal(calc.items.length, 2);
  assert.equal(calc.dishes.length, 2);

  const cfDenDish = calc.dishes.find((d) => d.itemCode === 'CF_DEN');
  assert.equal(cfDenDish.predictedQty, 10);
  assert.equal(cfDenDish.forecastDate, '2026-11-11');

  const cfSuaDish = calc.dishes.find((d) => d.itemCode === 'CF_SUA');
  assert.equal(cfSuaDish.predictedQty, 5);
  assert.equal(cfSuaDish.forecastDate, '2026-11-11');

  // Từ số lượng món: ing1 = 10*18 + 5*15 = 255g; ing2 = 5*60 = 300ml
  const ing1 = calc.items.find((x) => x.ingredientCode === 'ING_001');
  assert.equal(ing1.predictedDemand, 255);
  assert.equal(ing1.projectedRemainingStock, -55);
  assert.equal(ing1.shortfallQty, 55);
  assert.equal(ing1.recommendedOrderQty, 555); // 255 + 500 - 200
  assert.equal(ing1.needsRestock, true);
  assert.equal(ing1.dishBreakdown.length, 2);

  const ing2 = calc.items.find((x) => x.ingredientCode === 'ING_002');
  assert.equal(ing2.predictedDemand, 300);
  assert.equal(ing2.projectedRemainingStock, 4700);
  assert.equal(ing2.shortfallQty, 0);
  assert.equal(ing2.recommendedOrderQty, 0);
  assert.equal(ing2.needsRestock, false);
});

/* ------------------------------------------------ Xu hướng & Nhập/Xuất kho & Cảnh báo */
test('TC-REC-10, TC-REC-11\t[REC-10, REC-11] buildTrendSeries: gom chuỗi doanh thu/tiêu thụ theo ngày từ sales_history_daily và sales_transactions', () => {
  const daily = buildTrendSeries({
    mode: 'daily',
    rows: [
      { sale_date: new Date('2026-11-02T00:00:00Z'), qty: 10, revenue_vnd: 400000, order_lines: 9 },
      { sale_date: new Date('2026-11-01T00:00:00Z'), qty: 5, revenue_vnd: 200000, order_lines: 5 },
      { sale_date: new Date('2026-11-01T00:00:00Z'), qty: 3, revenue_vnd: 120000, order_lines: 3 },
    ],
  });
  assert.equal(daily.series.length, 2);
  assert.equal(daily.series[0].date, '2026-11-01');
  assert.equal(daily.series[0].qty, 8);
  assert.equal(daily.series[0].revenueVnd, 320000);
  assert.equal(daily.totals.revenueVnd, 720000);

  const tx = buildTrendSeries({
    mode: 'transactions',
    productId: 'p1',
    rows: [
      { sale_date: new Date('2026-11-01T08:00:00Z'), quantity: 2, line_total_vnd: 80000 },
      { sale_date: new Date('2026-11-01T14:00:00Z'), quantity: 3, line_total_vnd: 120000 },
    ],
  });
  assert.equal(tx.sourceCollection, 'sales_transactions');
  assert.equal(tx.totals.qty, 5);
  assert.equal(tx.totals.revenueVnd, 200000);
});

test('TC-REC-21..24\t[REC-21..24] validateStockMovement & validateAlertTransition: kiểm tra dấu nhập/xuất kho, chặn âm tồn kho và chuyển trạng thái cảnh báo', () => {
  const inMov = validateStockMovement({ currentStock: 100, movementType: 'IN', quantityChange: 50, reason: 'Nhập hàng' });
  assert.equal(inMov.balanceAfter, 150);

  const outMov = validateStockMovement({ currentStock: 150, movementType: 'OUT', quantityChange: -40, reason: 'Pha chế' });
  assert.equal(outMov.balanceAfter, 110);

  assert.throws(
    () => validateStockMovement({ currentStock: 100, movementType: 'IN', quantityChange: -10 }),
    (e) => e.code === 'VALIDATION_ERROR' && e.status === 422,
  );
  assert.throws(
    () => validateStockMovement({ currentStock: 100, movementType: 'OUT', quantityChange: 10 }),
    (e) => e.code === 'VALIDATION_ERROR' && e.status === 422,
  );
  assert.throws(
    () => validateStockMovement({ currentStock: 30, movementType: 'DISCARD', quantityChange: -50 }),
    (e) => e.code === 'INSUFFICIENT_STOCK' && e.status === 422,
  );

  assert.equal(validateAlertTransition({ status: 'OPEN' }, 'ACKNOWLEDGED'), 'ACKNOWLEDGED');
  assert.equal(validateAlertTransition({ status: 'ACKNOWLEDGED' }, 'RESOLVED'), 'RESOLVED');
  assert.throws(
    () => validateAlertTransition({ status: 'RESOLVED' }, 'ACKNOWLEDGED'),
    (e) => e.code === 'INVALID_ALERT_STATE' && e.status === 409,
  );
});

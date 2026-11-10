'use strict';
/**
 * Kiểm thử tích hợp Module 12 — Recommendation & Forecast API (service + route + auth + RBAC).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { ObjectId } = require('mongodb');
const { recommendationRouter, adminForecastRouter } = require('../../src/routes/forecast');
const bookingsRouter = require('../../src/routes/bookings');
const catalogRouter = require('../../src/routes/catalog');

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getTomorrowUtcDate() {
  const vnNow = new Date(Date.now() + VN_OFFSET_MS);
  const ymd = vnNow.toISOString().slice(0, 10);
  const todayUtc = new Date(`${ymd}T00:00:00.000Z`);
  return new Date(todayUtc.getTime() + DAY_MS);
}

/* ---------- DB giả lập hỗ trợ findOne, updateOne, insertOne, find ---------- */
function matches(doc, filter = {}) {
  for (const [k, cond] of Object.entries(filter)) {
    if (k === '$or') {
      if (!cond.some((sub) => matches(doc, sub))) return false;
      continue;
    }
    if (k === '$and') {
      if (!cond.every((sub) => matches(doc, sub))) return false;
      continue;
    }
    const v = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
      if ('$in' in cond && !cond.$in.some((x) => String(x) === String(v))) return false;
      if ('$gte' in cond && !(v >= cond.$gte)) return false;
      if ('$lt' in cond && !(v < cond.$lt)) return false;
      if ('$ne' in cond && String(v) === String(cond.$ne)) return false;
      continue;
    }
    if (String(v) !== String(cond)) return false;
  }
  return true;
}

function fakeDb(seed = {}) {
  const cols = {};
  for (const [k, arr] of Object.entries(seed)) {
    cols[k] = arr.map((x) => ({ ...x }));
  }

  return {
    collection(name) {
      const rows = cols[name] || (cols[name] = []);
      return {
        async findOne(filter) {
          return rows.find((d) => matches(d, filter)) || null;
        },
        async insertOne(doc) {
          rows.push({ ...doc });
          return { insertedId: doc._id };
        },
        async updateOne(filter, update) {
          const d = rows.find((x) => matches(x, filter));
          if (!d) return { matchedCount: 0, modifiedCount: 0 };
          if (update && update.$set) Object.assign(d, update.$set);
          return { matchedCount: 1, modifiedCount: 1 };
        },
        find(filter = {}) {
          let list = rows.filter((d) => matches(d, filter)).map((d) => ({ ...d }));
          const cursor = {
            sort(spec = {}) {
              const entries = Object.entries(spec);
              list.sort((a, b) => {
                for (const [f, dir] of entries) {
                  const av = a[f] instanceof Date ? a[f].getTime() : String(a[f] ?? '');
                  const bv = b[f] instanceof Date ? b[f].getTime() : String(b[f] ?? '');
                  if (av < bv) return dir < 0 ? 1 : -1;
                  if (av > bv) return dir < 0 ? -1 : 1;
                }
                return 0;
              });
              return cursor;
            },
            limit(n) {
              list = list.slice(0, n);
              return cursor;
            },
            async toArray() {
              return list;
            },
          };
          return cursor;
        },
      };
    },
    _cols: cols,
  };
}

const IDS = {
  admin: new ObjectId('111111111111111111111111'),
  customerNoCluster: new ObjectId('450a77f9282618e177a8cd76'),
  customerCluster: new ObjectId('650a77f9282618e177a8cd99'),
  spacePod: new ObjectId('c7185699b9a4ff8d7d94214d'),
  pkgHalf: new ObjectId('b7185699b9a4ff8d7d942101'),
  incDrink: new ObjectId('b7185699b9a4ff8d7d942201'),
  incPastry: new ObjectId('b7185699b9a4ff8d7d942202'),
  prodCfDen: new ObjectId('a9e9ae7e2e1bbdcce41e6eed'),
  prodMatcha: new ObjectId('a9e9ae7e2e1bbdcce41e6eef'),
  prodCroissant: new ObjectId('6bf253898080b443d05ccd37'),
  prodHidden: new ObjectId('72e8fee2e96c48aa51f97b90'),
  addonCfDen: new ObjectId('4781b8610bc1ac73f7afe67d'),
  addonCroissant: new ObjectId('02ea32d64bb213f7d49a1f53'),
  addonMonitor: new ObjectId('02ea32d64bb213f7d49a1f99'),
  addonHidden: new ObjectId('4937c361d6efe7b2437044c3'),
  bookingCluster: new ObjectId('c8185699b9a4ff8d7d942301'),
  ing1: new ObjectId('8ef89de69e384466f8f6c236'),
  alertOpen: new ObjectId('99f89de69e384466f8f6c001'),
  alertFrozen: new ObjectId('99f89de69e384466f8f6c002'),
};

function buildSeedData() {
  const tomorrow = getTomorrowUtcDate();
  const nextWeek = new Date(tomorrow.getTime() + 7 * DAY_MS);

  const ingredients = [
    {
      _id: IDS.ing1,
      ingredient_code: 'ING_001',
      ingredient_name: 'Hạt cà phê Robusta',
      unit: 'g',
      status: 'ACTIVE',
      storage_type: 'AMBIENT',
      min_stock_level: 5400,
      current_stock: 9957.17,
      defrost_hours: null,
    },
  ];
  for (let i = 2; i <= 38; i++) {
    const code = `ING_${String(i).padStart(3, '0')}`;
    ingredients.push({
      _id: new ObjectId(`8ef89de69e384466f8f6c${String(i).padStart(3, '0')}`),
      ingredient_code: code,
      ingredient_name: `Nguyên vật liệu ${code}`,
      unit: i % 3 === 0 ? 'piece' : i % 2 === 0 ? 'ml' : 'g',
      status: 'ACTIVE',
      storage_type: i % 5 === 0 ? 'FROZEN' : 'CHILLED',
      min_stock_level: 1000,
      current_stock: 2500,
      defrost_hours: i % 5 === 0 ? 4 : null,
    });
  }

  return {
    users: [
      { _id: IDS.admin, full_name: 'Quản trị KÉN', phone: '0900000001', role: 'ADMIN', status: 'ACTIVE', ml_cluster_id: null },
      { _id: IDS.customerNoCluster, full_name: 'Nguyễn Văn An', phone: '0909123456', role: 'CUSTOMER', status: 'ACTIVE', tier: 'BASIC', ml_cluster_id: null },
      { _id: IDS.customerCluster, full_name: 'Trần Minh Anh', phone: '0909123401', role: 'CUSTOMER', status: 'ACTIVE', tier: 'GOLD', ml_cluster_id: 2 },
    ],
    spaces: [
      { _id: IDS.spacePod, space_code: 'POD-01', name: 'Focus Pod 01', status: 'ACTIVE' },
    ],
    packages: [
      { _id: IDS.pkgHalf, name: 'Gói Tập Trung 4 Giờ', package_type: 'FIXED', is_active: true },
    ],
    package_inclusions: [
      { _id: IDS.incDrink, package_id: IDS.pkgHalf, item_type: 'STANDARD_DRINK', subsidy_limit: 50000, is_active: true },
      { _id: IDS.incPastry, package_id: IDS.pkgHalf, item_type: 'PASTRY', subsidy_limit: null, is_active: true },
    ],
    products: [
      { _id: IDS.prodCfDen, item_code: 'CF_DEN', name: 'Cà phê đen', category: 'DRINK', price: 40000, is_active: true },
      { _id: IDS.prodMatcha, item_code: 'MATCHA', name: 'Matcha Latte', category: 'DRINK', price: 59000, is_active: true },
      { _id: IDS.prodCroissant, item_code: 'CR_BO', name: 'Bánh Croissant', category: 'PASTRY', price: 45000, is_active: true },
      { _id: IDS.prodHidden, item_code: 'MON_AN', name: 'Món đã ẩn', category: 'DRINK', price: 55000, is_active: false },
    ],
    addons: [
      { _id: IDS.addonCfDen, product_id: IDS.prodCfDen, name: 'Cà phê đen', price: 40000, unit: 'PER_ITEM', is_active: true },
      { _id: IDS.addonCroissant, product_id: IDS.prodCroissant, name: 'Bánh Croissant', price: 45000, unit: 'PER_ITEM', is_active: true },
      { _id: IDS.addonMonitor, product_id: null, name: 'Màn hình rời 24 inch', price: 50000, unit: 'PER_BOOKING', is_active: true },
      { _id: IDS.addonHidden, product_id: IDS.prodHidden, name: 'Món đã ẩn', price: 55000, unit: 'PER_ITEM', is_active: false },
    ],
    sales_history_daily: [
      {
        _id: new ObjectId(),
        item_id: IDS.prodCfDen,
        item_code: 'CF_DEN',
        sale_date: new Date('2026-10-15T00:00:00Z'),
        qty: 30,
        revenue_vnd: 1200000,
        order_lines: 28,
        qty_by_daypart: { MORNING: 20, AFTERNOON: 6, EVENING: 4 },
      },
      {
        _id: new ObjectId(),
        item_id: IDS.prodCroissant,
        item_code: 'CR_BO',
        sale_date: new Date('2026-10-16T00:00:00Z'),
        qty: 10,
        revenue_vnd: 450000,
        order_lines: 10,
        qty_by_daypart: { MORNING: 3, AFTERNOON: 5, EVENING: 2 },
      },
      {
        _id: new ObjectId(),
        item_id: IDS.prodHidden,
        item_code: 'MON_AN',
        sale_date: new Date('2026-10-16T00:00:00Z'),
        qty: 500,
        revenue_vnd: 27500000,
        order_lines: 400,
        qty_by_daypart: { MORNING: 200, AFTERNOON: 200, EVENING: 100 },
      },
    ],
    sales_transactions: [
      {
        _id: new ObjectId(),
        order_code: 'ORD-01',
        sale_date: new Date('2026-10-15T02:00:00Z'),
        item_id: IDS.prodMatcha,
        item_code: 'MATCHA',
        quantity: 60,
        unit_price_vnd: 59000,
        line_total_vnd: 3540000,
        customer_id: IDS.customerCluster,
      },
      {
        _id: new ObjectId(),
        order_code: 'ORD-02',
        sale_date: new Date('2026-10-16T04:00:00Z'),
        item_id: IDS.prodCfDen,
        item_code: 'CF_DEN',
        quantity: 2,
        unit_price_vnd: 40000,
        line_total_vnd: 80000,
        customer_id: IDS.customerNoCluster,
      },
    ],
    bookings: [
      {
        _id: IDS.bookingCluster,
        user_id: IDS.customerCluster,
        status: 'CHECKED_OUT',
      },
    ],
    booking_inclusions: [
      {
        _id: new ObjectId(),
        booking_id: IDS.bookingCluster,
        product_id: IDS.prodCroissant,
        quantity: 20,
      },
    ],
    booking_addons: [
      {
        _id: new ObjectId(),
        booking_id: IDS.bookingCluster,
        addon_id: IDS.addonMonitor,
        quantity: 40,
      },
    ],
    ingredients,
    recipes: [
      {
        _id: new ObjectId(),
        item_id: IDS.prodCfDen,
        item_code: 'CF_DEN',
        ingredient_id: IDS.ing1,
        ingredient_code: 'ING_001',
        quantity_per_item: 18,
        unit: 'g',
      },
    ],
    demand_forecasts: [
      {
        _id: new ObjectId(),
        item_id: IDS.prodCfDen,
        item_code: 'CF_DEN',
        forecast_date: tomorrow,
        predicted_qty: 20,
        lower_qty: 15,
        upper_qty: 25,
        model_version: 'LGBM_v1.2',
        generated_at: new Date(),
      },
      {
        _id: new ObjectId(),
        item_id: IDS.prodCroissant,
        item_code: 'CR_BO',
        forecast_date: tomorrow,
        predicted_qty: 12,
        lower_qty: 9,
        upper_qty: 15,
        model_version: 'LGBM_v1.2',
        generated_at: new Date(),
      },
      {
        _id: new ObjectId(),
        item_id: IDS.prodCfDen,
        item_code: 'CF_DEN',
        forecast_date: nextWeek,
        predicted_qty: 10,
        lower_qty: 8,
        upper_qty: 12,
        model_version: 'LGBM_v1.2',
        generated_at: new Date(),
      },
    ],
    ingredient_stock_movements: [
      {
        _id: new ObjectId('70c073c18dd280b0c8566b71'),
        ingredient_id: IDS.ing1,
        movement_type: 'IN',
        quantity_change: 5000,
        balance_after: 5000,
        reason: 'Tồn đầu kỳ',
        created_by: IDS.admin,
        created_at: new Date('2026-10-01T00:00:00Z'),
      },
      {
        _id: new ObjectId('70c073c18dd280b0c8566b72'),
        ingredient_id: IDS.ing1,
        movement_type: 'OUT',
        quantity_change: -42.83,
        balance_after: 4957.17,
        reason: 'Xuất pha chế',
        created_by: IDS.admin,
        created_at: new Date('2026-10-27T15:30:00Z'),
      },
    ],
    inventory_alerts: [
      {
        _id: IDS.alertOpen,
        ingredient_id: IDS.ing1,
        ingredient_code: 'ING_001',
        alert_type: 'LOW_STOCK',
        target_date: tomorrow,
        required_qty: 6000,
        on_hand_qty: 4957.17,
        shortfall_qty: 1042.83,
        severity: 'CRITICAL',
        status: 'OPEN',
        message: 'Hạt cà phê Robusta sắp dưới ngưỡng an toàn',
        model_version: 'LGBM_v1.2',
        generated_at: new Date(),
        acknowledged_by: null,
        acknowledged_at: null,
      },
      {
        _id: IDS.alertFrozen,
        ingredient_id: IDS.ing1,
        ingredient_code: 'ING_005',
        alert_type: 'DEFROST',
        target_date: tomorrow,
        required_qty: 500,
        on_hand_qty: 1200,
        shortfall_qty: 0,
        severity: 'WARNING',
        status: 'OPEN',
        message: 'Cần rã đông nguyên liệu đông lạnh trước 4 giờ',
        model_version: 'LGBM_v1.2',
        generated_at: new Date(),
        acknowledged_by: null,
        acknowledged_at: null,
      },
    ],
  };
}

async function withServer(db, sessionUser, fn) {
  const app = express();
  app.use(express.json());
  app.locals.db = db;
  app.use((req, _res, next) => {
    req.session = {
      user: sessionUser,
      destroy(cb) {
        cb && cb(null);
      },
    };
    next();
  });
  app.use('/api', recommendationRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api', catalogRouter);
  app.use('/api/admin/forecast', adminForecastRouter);

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(baseUrl);
  } finally {
    server.close();
  }
}

/* ------------------------------------------------ 1. Top Trending (Pop-up & Trang Top Trending không phân role) */

test('TC-REC-01..04, TC-REC-18: GET /api/recommendations & /api/recommendations/top-trending không phân role, trả cùng Top Trending và path /top-trending', async () => {
  const db = fakeDb(buildSeedData());
  let guestBody;
  let customerBody;
  let adminBody;

  await withServer(db, null, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/recommendations`);
    assert.equal(res.status, 200);
    guestBody = await res.json();
    assert.equal(guestBody.roleScoped, false);
    assert.equal(guestBody.topTrendingPath, '/top-trending');
    assert.equal(guestBody.strategy, 'TRENDING_POPULAR');
    assert.equal(guestBody.items[0].name, 'Cà phê đen');
    assert.equal(guestBody.items[0].listedPrice, 40000);
    assert.ok(guestBody.items.every((i) => i.is_active === true && i.name !== 'Món đã ẩn'));

    // Endpoint trang Top Trending (gắn footer)
    const resPage = await fetch(`${baseUrl}/api/recommendations/top-trending`);
    assert.equal(resPage.status, 200);
    const pageBody = await resPage.json();
    assert.equal(pageBody.roleScoped, false);
    assert.equal(pageBody.topTrendingPath, '/top-trending');
    assert.equal(pageBody.items[0].name, 'Cà phê đen');
  });

  // Customer có ml_cluster_id = 2 vẫn nhận Top Trending y hệt Guest (không phân role ở pop-up/top-trending)
  await withServer(db, { id: String(IDS.customerCluster), role: 'CUSTOMER', pwdAt: 0 }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/recommendations`);
    assert.equal(res.status, 200);
    customerBody = await res.json();
    assert.deepEqual(customerBody.items, guestBody.items);

    // Kiểm tra validation tham số
    const badSpace = await fetch(`${baseUrl}/api/recommendations?spaceId=abc!@#`);
    assert.equal(badSpace.status, 400);
    const badGuest = await fetch(`${baseUrl}/api/recommendations?guestCount=0`);
    assert.equal(badGuest.status, 422);
  });

  // Admin cũng nhận cùng Top Trending
  await withServer(db, { id: String(IDS.admin), role: 'ADMIN', pwdAt: 0 }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/recommendations`);
    assert.equal(res.status, 200);
    adminBody = await res.json();
    assert.deepEqual(adminBody.items, guestBody.items);
  });

  // Lịch sử rỗng -> fallback mặc định 200
  const emptyHistoryDb = fakeDb({ ...buildSeedData(), sales_history_daily: [] });
  await withServer(emptyHistoryDb, null, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/recommendations`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.hasHistory, false);
    assert.equal(body.strategy, 'DEFAULT_FALLBACK');
    assert.ok(body.items.length > 0);
  });
});

/* ------------------------------------------------ 2. Recommend theo nhóm Customer trong luồng Booking (Inclusion & Add-ons) */

test('TC-REC-17, TC-REC-24: Recommend theo nhóm Customer (ml_cluster_id) trong luồng Booking (/api/recommendations/booking, /api/bookings/recommendations, /api/products?recommend=true, /api/addons?recommend=true)', async () => {
  const db = fakeDb(buildSeedData());

  // Customer có ml_cluster_id = 2 -> Matcha Latte (sales_transactions) & Croissant (booking_inclusions) đứng đầu Inclusion; Màn hình rời (booking_addons) đứng đầu Add-on
  await withServer(db, { id: String(IDS.customerCluster), role: 'CUSTOMER', pwdAt: 0 }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/recommendations/booking?packageId=${IDS.pkgHalf}&limit=2`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.strategy, 'PERSONALIZED_ML_CLUSTER');
    assert.equal(body.fallbackUsed, false);
    assert.equal(body.customerGroup.mlClusterId, 2);
    assert.equal(body.inclusions[0].name, 'Matcha Latte');
    assert.equal(body.inclusions[0].isRecommended, true);
    assert.equal(body.inclusions[0].subsidyLimit, 50000);
    assert.equal(body.inclusions[0].surchargeAmount, 9000);
    assert.equal(body.addons[0].name, 'Màn hình rời 24 inch');
    assert.equal(body.addons[0].isRecommended, true);
    assert.ok(body.inclusions.every((i) => i.name !== 'Món đã ẩn'));
    assert.ok(body.addons.every((a) => a.name !== 'Món đã ẩn'));

    // Alias trong router /api/bookings/recommendations (không đụng /:id)
    const resAlias = await fetch(`${baseUrl}/api/bookings/recommendations?packageId=${IDS.pkgHalf}`);
    assert.equal(resAlias.status, 200);
    const bodyAlias = await resAlias.json();
    assert.equal(bodyAlias.strategy, 'PERSONALIZED_ML_CLUSTER');
    assert.equal(bodyAlias.inclusions[0].name, 'Matcha Latte');

    // Catalog opt-in ?recommend=true vẫn trả về mảng tương thích menu hiện tại nhưng đã sắp xếp + gắn cờ recommend
    const resProds = await fetch(`${baseUrl}/api/products?recommend=true&packageId=${IDS.pkgHalf}`);
    assert.equal(resProds.status, 200);
    const prods = await resProds.json();
    assert.ok(Array.isArray(prods));
    assert.equal(prods[0].name, 'Matcha Latte');
    assert.equal(prods[0].isRecommended, true);

    const resAddons = await fetch(`${baseUrl}/api/addons?recommend=true`);
    assert.equal(resAddons.status, 200);
    const addons = await resAddons.json();
    assert.ok(Array.isArray(addons));
    assert.equal(addons[0].name, 'Màn hình rời 24 inch');
    assert.equal(addons[0].isRecommended, true);
  });

  // Customer chưa có ml_cluster_id -> fallback xu hướng chung (Cà phê đen)
  await withServer(db, { id: String(IDS.customerNoCluster), role: 'CUSTOMER', pwdAt: 0 }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/recommendations/booking`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.strategy, 'TRENDING_FALLBACK');
    assert.equal(body.fallbackUsed, true);
    assert.equal(body.inclusions[0].name, 'Cà phê đen');
    assert.equal(body.addons[0].name, 'Cà phê đen');
  });

  // Guest -> fallback xu hướng chung, không lỗi
  await withServer(db, null, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/bookings/recommendations`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.fallbackUsed, true);
    assert.equal(body.customerGroup.isAuthenticated, false);
  });
});

/* ------------------------------------------------ 3. Admin Forecast (Số lượng món ngày hôm sau -> Nguyên vật liệu) */

test('TC-REC-05..09, TC-REC-13, TC-REC-16, TC-REC-19: GET /api/admin/forecast & /ingredients & /ingredients/:id (dự báo số lượng món ngày hôm sau rồi tính ra 38 nguyên vật liệu)', async () => {
  const seed = buildSeedData();
  const db = fakeDb(seed);
  const adminSess = { id: String(IDS.admin), role: 'ADMIN', pwdAt: 0 };
  const tomorrowStr = getTomorrowUtcDate().toISOString().slice(0, 10);
  const farRangeFrom = tomorrowStr;
  const farRangeTo = new Date(getTomorrowUtcDate().getTime() + 10 * DAY_MS).toISOString().slice(0, 10);

  await withServer(db, adminSess, async (baseUrl) => {
    const resTomorrow = await fetch(`${baseUrl}/api/admin/forecast/ingredients`);
    assert.equal(resTomorrow.status, 200);
    const bodyTomorrow = await resTomorrow.json();
    assert.equal(bodyTomorrow.targetDate, tomorrowStr);
    assert.equal(bodyTomorrow.dishes.length, 2);
    assert.equal(bodyTomorrow.items.length, 38);

    const cfDenDish = bodyTomorrow.dishes.find((d) => d.itemCode === 'CF_DEN');
    assert.equal(cfDenDish.predictedQty, 20);

    const ing1 = bodyTomorrow.items.find((x) => x.ingredientCode === 'ING_001');
    assert.equal(ing1.predictedDemand, 360);
    assert.equal(ing1.unit, 'g');
    assert.equal(ing1.forecastDate, tomorrowStr);
    assert.equal(ing1.dishBreakdown.length, 1);
    assert.equal(ing1.dishBreakdown[0].dishQty, 20);

    // Alias GET /api/admin/forecast
    const resRoot = await fetch(`${baseUrl}/api/admin/forecast`);
    assert.equal(resRoot.status, 200);
    const bodyRoot = await resRoot.json();
    assert.equal(bodyRoot.targetDate, tomorrowStr);
    assert.equal(bodyRoot.dishes.length, 2);

    // Lọc mở rộng
    const resFiltered = await fetch(`${baseUrl}/api/admin/forecast/ingredients?from=${farRangeFrom}&to=${farRangeTo}`);
    assert.equal(resFiltered.status, 200);
    const bodyFiltered = await resFiltered.json();
    const ing1Filtered = bodyFiltered.items.find((x) => x.ingredientCode === 'ING_001');
    assert.equal(ing1Filtered.predictedDemand, 540);

    // Chi tiết 1 nguyên vật liệu + lịch sử nhập/xuất kho
    const resDetail = await fetch(`${baseUrl}/api/admin/forecast/ingredients/${IDS.ing1}`);
    assert.equal(resDetail.status, 200);
    const bodyDetail = await resDetail.json();
    assert.equal(bodyDetail.ingredient.ingredient_code, 'ING_001');
    assert.equal(bodyDetail.movements.length, 2);
    assert.equal(bodyDetail.movements[0].movement_type, 'OUT');
    assert.equal(bodyDetail.movements[1].movement_type, 'IN');

    // 404 & 400
    assert.equal((await fetch(`${baseUrl}/api/admin/forecast/ingredients/000000000000000000000000`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/admin/forecast/ingredients/abc!@#`)).status, 400);
  });

  // Collection demand_forecasts rỗng -> 200 mảng rỗng kèm thông báo
  const emptyForecastDb = fakeDb({ ...buildSeedData(), demand_forecasts: [] });
  await withServer(emptyForecastDb, adminSess, async (baseUrl) => {
    const resEmpty = await fetch(`${baseUrl}/api/admin/forecast/ingredients`);
    assert.equal(resEmpty.status, 200);
    const bodyEmpty = await resEmpty.json();
    assert.deepEqual(bodyEmpty.items, []);
    assert.deepEqual(bodyEmpty.dishes, []);
    assert.ok(bodyEmpty.message);
  });

  // Dữ liệu ML hỏng không làm sập API
  const seedWithCorrupt = buildSeedData();
  seedWithCorrupt.demand_forecasts.push(
    { _id: new ObjectId(), item_id: null, forecast_date: 'not-a-date', predicted_qty: -50 },
    { _id: new ObjectId(), item_id: IDS.prodCfDen, forecast_date: null },
  );
  const corruptDb = fakeDb(seedWithCorrupt);
  await withServer(corruptDb, adminSess, async (baseUrl) => {
    const resCorrupt = await fetch(`${baseUrl}/api/admin/forecast/ingredients`);
    assert.equal(resCorrupt.status, 200);
    const bodyCorrupt = await resCorrupt.json();
    assert.equal(bodyCorrupt.skippedMalformedCount, 2);
    assert.equal(bodyCorrupt.items.length, 38);
    assert.equal(bodyCorrupt.dishes.length, 2);
  });
});

test('TC-REC-10..12: GET /api/admin/forecast/trends theo ngày, theo productId và lỗi 422 khi from > to', async () => {
  const db = fakeDb(buildSeedData());
  const adminSess = { id: String(IDS.admin), role: 'ADMIN', pwdAt: 0 };

  await withServer(db, adminSess, async (baseUrl) => {
    const resDaily = await fetch(`${baseUrl}/api/admin/forecast/trends?from=2026-10-01&to=2026-10-31`);
    assert.equal(resDaily.status, 200);
    const bodyDaily = await resDaily.json();
    assert.equal(bodyDaily.sourceCollection, 'sales_history_daily');
    assert.equal(bodyDaily.series.length, 2);

    const resProd = await fetch(
      `${baseUrl}/api/admin/forecast/trends?from=2026-10-01&to=2026-10-31&productId=${IDS.prodCfDen}`,
    );
    assert.equal(resProd.status, 200);
    const bodyProd = await resProd.json();
    assert.equal(bodyProd.sourceCollection, 'sales_transactions');
    assert.equal(bodyProd.totals.qty, 2);
    assert.equal(bodyProd.totals.revenueVnd, 80000);

    const resInvalid = await fetch(`${baseUrl}/api/admin/forecast/trends?from=2026-12-31&to=2026-01-01`);
    assert.equal(resInvalid.status, 422);
    const bodyInvalid = await resInvalid.json();
    assert.equal(bodyInvalid.code, 'VALIDATION_ERROR');
  });
});

test('TC-REC-14, TC-REC-20..23: Cảnh báo tồn kho & Nhập/Xuất kho', async () => {
  const db = fakeDb(buildSeedData());
  const adminSess = { id: String(IDS.admin), role: 'ADMIN', pwdAt: 0 };

  await withServer(db, adminSess, async (baseUrl) => {
    const resAlerts = await fetch(`${baseUrl}/api/admin/forecast/alerts`);
    assert.equal(resAlerts.status, 200);
    const bodyAlerts = await resAlerts.json();
    assert.equal(bodyAlerts.items.length, 2);

    const resDefrost = await fetch(`${baseUrl}/api/admin/forecast/alerts?alertType=DEFROST&severity=WARNING`);
    assert.equal(resDefrost.status, 200);
    const bodyDefrost = await resDefrost.json();
    assert.equal(bodyDefrost.items.length, 1);
    assert.equal(bodyDefrost.items[0].alert_type, 'DEFROST');

    const resAck = await fetch(`${baseUrl}/api/admin/forecast/alerts/${IDS.alertOpen}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
    });
    assert.equal(resAck.status, 200);
    const bodyAck = await resAck.json();
    assert.equal(bodyAck.alert.status, 'ACKNOWLEDGED');
    assert.equal(String(bodyAck.alert.acknowledged_by), String(IDS.admin));

    const resMovIn = await fetch(`${baseUrl}/api/admin/forecast/ingredients/${IDS.ing1}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movementType: 'IN', quantityChange: 1000, reason: 'Nhập thêm Robusta' }),
    });
    assert.equal(resMovIn.status, 200);
    const bodyMovIn = await resMovIn.json();
    assert.equal(bodyMovIn.movement.balance_after, 10957.17);
    assert.equal(bodyMovIn.ingredient.current_stock, 10957.17);

    const resMovBad = await fetch(`${baseUrl}/api/admin/forecast/ingredients/${IDS.ing1}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movementType: 'OUT', quantityChange: -999999 }),
    });
    assert.equal(resMovBad.status, 422);
  });
});

test('TC-REC-15: Phân quyền Security — Customer nhận 403 FORBIDDEN, Guest nhận 401 UNAUTHENTICATED khi truy cập /api/admin/forecast/*', async () => {
  const db = fakeDb(buildSeedData());

  await withServer(db, { id: String(IDS.customerNoCluster), role: 'CUSTOMER', pwdAt: 0 }, async (baseUrl) => {
    for (const path of ['/api/admin/forecast', '/api/admin/forecast/ingredients', '/api/admin/forecast/trends', '/api/admin/forecast/alerts']) {
      const r = await fetch(`${baseUrl}${path}`);
      assert.equal(r.status, 403);
    }
  });

  await withServer(db, null, async (baseUrl) => {
    for (const path of ['/api/admin/forecast', '/api/admin/forecast/ingredients', '/api/admin/forecast/trends', '/api/admin/forecast/alerts']) {
      const r = await fetch(`${baseUrl}${path}`);
      assert.equal(r.status, 401);
    }
  });
});

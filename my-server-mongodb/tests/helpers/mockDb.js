'use strict';
const { ObjectId } = require('mongodb');

function cloneDoc(val) {
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof ObjectId) return new ObjectId(String(val));
  if (val instanceof Date) return new Date(val.getTime());
  if (Array.isArray(val)) return val.map(cloneDoc);
  const out = {};
  for (const [k, v] of Object.entries(val)) out[k] = cloneDoc(v);
  return out;
}

function matchFilter(doc, filter = {}) {
  for (const [k, cond] of Object.entries(filter)) {
    if (k === '$or') {
      if (!cond.some((sub) => matchFilter(doc, sub))) return false;
      continue;
    }
    const val = doc[k];
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date)) {
      if ('$in' in cond && !cond.$in.some((x) => String(x) === String(val))) return false;
      if ('$ne' in cond && String(val) === String(cond.$ne)) return false;
      if ('$gt' in cond && !(val > cond.$gt)) return false;
      if ('$gte' in cond && !(val >= cond.$gte)) return false;
      if ('$lt' in cond && !(val < cond.$lt)) return false;
      if ('$lte' in cond && !(val <= cond.$lte)) return false;
    } else if (cond instanceof ObjectId || val instanceof ObjectId) {
      if (String(val) !== String(cond)) return false;
    } else if (val !== cond) {
      return false;
    }
  }
  return true;
}

function createMockDb(seed = {}) {
  const store = new Map();
  for (const [name, docs] of Object.entries(seed)) {
    store.set(
      name,
      docs.map((d) => cloneDoc(d)),
    );
  }

  // Theo dõi khóa ghi (document-level write lock) giữa các Transaction đang mở giống WiredTiger
  const activeWriteLocks = new Map(); // key: `${col}:${_id}` -> sessionId
  let nextSessionId = 1;

  const getCol = (name) => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name);
  };

  const acquireDocLock = (colName, docId, session) => {
    if (!session) return;
    const key = `${colName}:${String(docId)}`;
    const holder = activeWriteLocks.get(key);
    if (holder && holder !== session.id) {
      const err = new Error('WriteConflict during transaction');
      err.code = 112;
      err.errorLabels = ['TransientTransactionError'];
      throw err;
    }
    activeWriteLocks.set(key, session.id);
    session.lockedKeys.add(key);
  };

  const db = {
    client: {
      startSession() {
        const session = {
          id: nextSessionId++,
          lockedKeys: new Set(),
          snapshot: null,
          async withTransaction(fn) {
            // Lưu snapshot của các document mà session này thực sự khóa & sửa để rollback cô lập khi abort
            session.origDocs = new Map();
            session.insertedDocs = [];
            try {
              await fn();
            } catch (err) {
              // Rollback đúng những thay đổi của riêng transaction này
              for (const { colName, id } of session.insertedDocs) {
                const col = getCol(colName);
                const idx = col.findIndex((d) => String(d._id) === String(id));
                if (idx !== -1) col.splice(idx, 1);
              }
              for (const [key, orig] of session.origDocs.entries()) {
                const [colName] = key.split(':');
                const col = getCol(colName);
                const idx = col.findIndex((d) => String(d._id) === String(orig._id));
                if (idx !== -1) col[idx] = cloneDoc(orig);
              }
              throw err;
            } finally {
              for (const k of session.lockedKeys) {
                if (activeWriteLocks.get(k) === session.id) activeWriteLocks.delete(k);
              }
              session.lockedKeys.clear();
            }
          },
          async endSession() {},
        };
        return session;
      },
    },
    collection(name) {
      return {
        find(filter = {}) {
          let results = getCol(name).filter((d) => matchFilter(d, filter));
          const cursor = {
            sort(spec) {
              const [[field, dir]] = Object.entries(spec);
              results = [...results].sort((a, b) => (a[field] < b[field] ? -dir : dir));
              return cursor;
            },
            async toArray() {
              return results.map((d) => cloneDoc(d));
            },
          };
          return cursor;
        },
        async findOne(filter = {}, opts = {}) {
          let list = getCol(name).filter((d) => matchFilter(d, filter));
          if (opts && opts.sort) {
            const [[field, dir]] = Object.entries(opts.sort);
            list.sort((a, b) => (a[field] < b[field] ? -dir : dir));
          }
          return list[0] ? cloneDoc(list[0]) : null;
        },
        async insertOne(doc, opts = {}) {
          const session = opts && opts.session;
          acquireDocLock(name, doc._id, session);
          if (session && session.insertedDocs) {
            session.insertedDocs.push({ colName: name, id: doc._id });
          }
          // Nhường event loop 1 nhịp để mô phỏng độ trễ I/O thực tế khi chạy song song Promise.all
          await new Promise((r) => setImmediate(r));
          getCol(name).push(cloneDoc(doc));
          return { insertedId: doc._id };
        },
        async insertMany(docs, opts = {}) {
          const session = opts && opts.session;
          for (const d of docs) {
            acquireDocLock(name, d._id, session);
            if (session && session.insertedDocs) {
              session.insertedDocs.push({ colName: name, id: d._id });
            }
            getCol(name).push(cloneDoc(d));
          }
          return { insertedCount: docs.length };
        },
        async updateOne(filter, update, opts = {}) {
          const session = opts && opts.session;
          const col = getCol(name);
          const idx = col.findIndex((d) => matchFilter(d, filter));
          if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };
          const target = col[idx];
          acquireDocLock(name, target._id, session);
          const lockKey = `${name}:${String(target._id)}`;
          if (session && session.origDocs && !session.origDocs.has(lockKey)) {
            session.origDocs.set(lockKey, cloneDoc(target));
          }
          await new Promise((r) => setImmediate(r));
          // Kiểm tra lại filter sau khi nhường I/O
          if (!matchFilter(target, filter)) return { matchedCount: 0, modifiedCount: 0 };
          if (update.$inc) {
            for (const [k, v] of Object.entries(update.$inc)) {
              target[k] = Number(target[k] || 0) + v;
            }
          }
          if (update.$set) {
            Object.assign(target, cloneDoc(update.$set));
          }
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };
  return db;
}

// ---------- Dữ liệu mẫu chuẩn theo database/data ----------
const IDS = {
  zoneTapTrung: new ObjectId('0e0176a90c9ea9da481da85b'),
  spaceFocusPod: new ObjectId('c7185699b9a4ff8d7d94214d'),
  spaceWorkLounge: new ObjectId('ab6af5c9b01fa33f757de661'),
  pkgFpHalf: new ObjectId('ee70f0a3e502ddc3b760a715'), // FIXED 4h, PER_SPACE, 140k, 1 STANDARD_DRINK
  pkgWlFlex: new ObjectId('ac64f28f5bfd0e11f87bd5f2'), // HOURLY, PER_PERSON, 30k/h, WATER khi >= 2h
  incFpDrink: new ObjectId('789c8cb8ac3b2b88b0d32e5e'),
  incWlWater: new ObjectId('b5da13315a5ae87f5152e394'),
  prodMatcha: new ObjectId('6bf253898080b443d05ccd37'), // 55k (vượt định mức 50k -> phụ phí 5k)
  prodAmericano: new ObjectId('72e8fee2e96c48aa51f97b90'), // 40k (phụ phí 0đ)
  addonMonitor: new ObjectId('4937c361d6efe7b2437044c3'), // PER_BOOKING, 50k
  addonPrint: new ObjectId('b6c5a21170d23bde85fa4346'), // PER_ITEM, 20k
  voucherWelcome: new ObjectId('9ebd4b06b483e0bf0cd57715'), // PERCENT 10%, min 100k
  tierBasic: new ObjectId('ca68ee2efa756bc712052e05'),
  tierSilver: new ObjectId('725404ee13b6372c3e767bb2'),
  tierGold: new ObjectId('2a507cc925dab58fc21b02a7'),
  tierDiamond: new ObjectId('f30ccafea1385bb2264b022f'),
  user1: new ObjectId('450a77f9282618e177a8cd76'),
  user2: new ObjectId('e09f2905e3fd3b50719c28a6'),
  admin: new ObjectId('111111111111111111111111'),
};

function buildSeedDb() {
  return createMockDb({
    zones: [
      {
        _id: IDS.zoneTapTrung,
        zone_code: 'KEN_TAP_TRUNG',
        name: 'KÉN Tập Trung',
        is_bookable: true,
        is_active: true,
      },
    ],
    spaces: [
      {
        _id: IDS.spaceFocusPod,
        zone_id: IDS.zoneTapTrung,
        space_code: 'FP-01',
        name: 'Ô tập trung cá nhân (Focus Pod)',
        space_type: 'FOCUS_POD',
        booking_mode: 'EXCLUSIVE',
        capacity: 1,
        min_guests: 1,
        max_guests: 1,
        open_time: '08:00',
        close_time: '22:00',
        buffer_minutes: 15,
        status: 'ACTIVE',
        lock_version: 0,
      },
      {
        _id: IDS.spaceWorkLounge,
        zone_id: IDS.zoneTapTrung,
        space_code: 'WL-01',
        name: 'Khu làm việc chung (Work Lounge)',
        space_type: 'WORK_LOUNGE',
        booking_mode: 'SHARED',
        capacity: 20,
        min_guests: 1,
        max_guests: 20,
        open_time: '08:00',
        close_time: '22:00',
        buffer_minutes: 0,
        status: 'ACTIVE',
        lock_version: 0,
      },
    ],
    packages: [
      {
        _id: IDS.pkgFpHalf,
        zone_id: IDS.zoneTapTrung,
        package_code: 'PKG_FP_HALF',
        name: 'Tập trung nửa ngày (4 giờ)',
        package_type: 'FIXED',
        pricing_unit: 'PER_SPACE',
        duration_hours: 4,
        is_full_day: false,
        min_hours: 1,
        is_active: true,
      },
      {
        _id: IDS.pkgWlFlex,
        zone_id: IDS.zoneTapTrung,
        package_code: 'PKG_WL_FLEX',
        name: 'Gói Linh hoạt',
        package_type: 'HOURLY',
        pricing_unit: 'PER_PERSON',
        duration_hours: null,
        is_full_day: false,
        min_hours: 1,
        is_active: true,
      },
    ],
    package_prices: [
      { _id: new ObjectId(), package_id: IDS.pkgFpHalf, space_id: IDS.spaceFocusPod, price: 140000 },
      { _id: new ObjectId(), package_id: IDS.pkgWlFlex, space_id: IDS.spaceWorkLounge, price: 30000 },
    ],
    package_inclusions: [
      {
        _id: IDS.incFpDrink,
        package_id: IDS.pkgFpHalf,
        item_type: 'STANDARD_DRINK',
        product_id: null,
        label: 'Đồ uống Menu Tiêu chuẩn',
        quantity: 1,
        quantity_basis: 'PER_BOOKING',
        subsidy_limit: 50000,
        min_hours_required: 0,
        is_active: true,
      },
      {
        _id: IDS.incWlWater,
        package_id: IDS.pkgWlFlex,
        item_type: 'WATER',
        product_id: new ObjectId(),
        label: 'Nước suối',
        quantity: 1,
        quantity_basis: 'PER_GUEST',
        subsidy_limit: null,
        min_hours_required: 2,
        is_active: true,
      },
    ],
    products: [
      {
        _id: IDS.prodMatcha,
        name: 'Matcha Latte',
        category: 'DRINK',
        price: 55000,
        variants: [{ name: 'Lạnh, M (500 ml)', price: 55000 }],
        is_active: true,
      },
      {
        _id: IDS.prodAmericano,
        name: 'Americano',
        category: 'DRINK',
        price: 40000,
        variants: [{ name: 'Lạnh', price: 40000 }],
        is_active: true,
      },
    ],
    addons: [
      {
        _id: IDS.addonMonitor,
        name: 'Thuê màn hình rời 24 inch',
        unit: 'PER_BOOKING',
        price: 50000,
        variants: [],
        is_active: true,
      },
      {
        _id: IDS.addonPrint,
        name: 'In tài liệu dưới 20 trang A4',
        unit: 'PER_ITEM',
        price: 20000,
        variants: [],
        is_active: true,
      },
    ],
    vouchers: [
      {
        _id: IDS.voucherWelcome,
        code: 'WELCOME10',
        discount_type: 'PERCENT',
        discount_value: 10,
        min_order_value: 100000,
        valid_from: new Date('2026-01-01T00:00:00Z'),
        valid_to: new Date('2026-12-31T23:59:59Z'),
        usage_limit: 100,
        usage_count: 0,
        redeem_limit: 0,
        redeem_count: 0,
        coins_cost: 0,
        status: 'ACTIVE',
      },
    ],
    membership_tiers: [
      { _id: IDS.tierBasic, code: 'BASIC', min_points: 0, discount_rate: 0.0 },
      { _id: IDS.tierSilver, code: 'SILVER', min_points: 1000, discount_rate: 0.05 },
      { _id: IDS.tierGold, code: 'GOLD', min_points: 5000, discount_rate: 0.1 },
      { _id: IDS.tierDiamond, code: 'DIAMOND', min_points: 10000, discount_rate: 0.15 },
    ],
    users: [
      {
        _id: IDS.user1,
        full_name: 'Nguyễn Văn A',
        phone: '0901111111',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        tier_id: IDS.tierSilver,
        tier_points: 990,
        coin_balance: 50,
      },
      {
        _id: IDS.user2,
        full_name: 'Trần Thị B',
        phone: '0902222222',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        tier_id: IDS.tierBasic,
        tier_points: 0,
        coin_balance: 0,
      },
    ],
    bookings: [],
    booking_inclusions: [],
    booking_addons: [],
    payment_transactions: [],
    loyalty_transactions: [],
    user_vouchers: [],
  });
}

// ---------- 1. Kiểm thử quy trình chuẩn BR-D01 ----------

module.exports = {
  cloneDoc,
  matchFilter,
  createMockDb,
  IDS,
  buildSeedDb,
};

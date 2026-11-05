'use strict';
// Routes: Danh mục & Quản trị (CRUD)
// Admin: tạo/sửa/xóa. Customer/Public: chỉ đọc (GET active items).
// Collections: spaces, zones, packages, space_pricing, addons, products, recipes.
const express = require('express');
const { ObjectId } = require('mongodb');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { wrap, fail, str } = require('../utils/http');

const router = express.Router();
const pubLimit   = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }); // public read
const adminLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 60  }); // admin write
const ADMIN = [requireAuth, requireRole('ADMIN'), adminLimit];

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════
const oid  = (id) => new ObjectId(id);
const validId = (id) => id && ObjectId.isValid(id);

/** Tạo $set từ whitelist keys — bỏ qua key undefined */
function pick(body, keys) {
  const set = {};
  for (const k of keys) if (k in body && body[k] !== undefined) set[k] = body[k];
  return set;
}

/** Validate số nguyên VNĐ >= 0 */
function assertMoney(v, name) {
  if (!Number.isInteger(v) || v < 0)
    throw Object.assign(new Error(`${name} phải là số nguyên VNĐ >= 0`), { status: 422 });
}

function notFound(res, name = 'Mục') { return fail(res, 404, 'NOT_FOUND', `${name} không tồn tại`); }
function badId(res) { return fail(res, 422, 'VALIDATION_ERROR', 'id không hợp lệ'); }

// ═══════════════════════════════════════════════════
// ZONES — khu vực trong quán
// ═══════════════════════════════════════════════════
// GET /api/catalog/zones
router.get('/zones', pubLimit, wrap(async (req, res) => {
  const zones = await req.app.locals.db.collection('zones')
    .find({ status: { $ne: 'INACTIVE' } }).sort({ name: 1 }).toArray();
  res.json(zones.map(fmtZone));
}));

// POST /api/catalog/zones [ADMIN]
router.post('/zones', ...ADMIN, wrap(async (req, res) => {
  const { name, description, status = 'ACTIVE' } = req.body;
  if (!str(name)) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
  const now = new Date();
  const { insertedId } = await req.app.locals.db.collection('zones').insertOne({
    name: str(name), description: str(description), status, created_at: now, updated_at: now,
  });
  res.status(201).json({ id: String(insertedId) });
}));

// PATCH /api/catalog/zones/:id [ADMIN]
router.patch('/zones/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = pick(req.body, ['name', 'description', 'status']);
  if ('name' in set) set.name = str(set.name);
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('zones').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Zone');
  res.json({ updated: true });
}));

// DELETE /api/catalog/zones/:id [ADMIN] — soft delete
router.delete('/zones/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('zones')
    .updateOne({ _id: oid(id) }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
  if (!r.matchedCount) return notFound(res, 'Zone');
  res.json({ deleted: true });
}));

const fmtZone = (z) => ({ id: String(z._id), name: z.name, description: z.description, status: z.status });

// ═══════════════════════════════════════════════════
// SPACES — phòng / không gian đặt chỗ
// ═══════════════════════════════════════════════════
// GET /api/catalog/spaces
router.get('/spaces', pubLimit, wrap(async (req, res) => {
  const filter = {};
  if (req.query.zoneId && validId(req.query.zoneId)) filter.zone_id = oid(req.query.zoneId);
  if (!req.session?.user || req.session.user.role !== 'ADMIN') filter.status = 'ACTIVE';
  const spaces = await req.app.locals.db.collection('spaces')
    .find(filter).sort({ name: 1 }).toArray();
  res.json(spaces.map(fmtSpace));
}));

// GET /api/catalog/spaces/:id
router.get('/spaces/:id', pubLimit, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const space = await req.app.locals.db.collection('spaces').findOne({ _id: oid(id) });
  if (!space) return notFound(res, 'Space');
  res.json(fmtSpace(space));
}));

// POST /api/catalog/spaces [ADMIN]
router.post('/spaces', ...ADMIN, wrap(async (req, res) => {
  const { name, zoneId, mode, minGuests, maxGuests, capacity, bufferMinutes, description, status = 'ACTIVE' } = req.body;
  if (!str(name)) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
  if (!['EXCLUSIVE', 'SHARED'].includes(mode))
    return fail(res, 422, 'VALIDATION_ERROR', 'mode phải là EXCLUSIVE hoặc SHARED');
  if (!Number.isInteger(minGuests) || !Number.isInteger(maxGuests) || !Number.isInteger(capacity))
    return fail(res, 422, 'VALIDATION_ERROR', 'minGuests, maxGuests, capacity phải là số nguyên');

  const now = new Date();
  const doc = {
    name: str(name), zone_id: zoneId && validId(zoneId) ? oid(zoneId) : null,
    mode, min_guests: minGuests, max_guests: maxGuests, capacity,
    buffer_minutes: Number.isInteger(bufferMinutes) ? bufferMinutes : 15,
    description: str(description), status, created_at: now, updated_at: now,
  };
  const { insertedId } = await req.app.locals.db.collection('spaces').insertOne(doc);
  res.status(201).json({ id: String(insertedId) });
}));

// PATCH /api/catalog/spaces/:id [ADMIN]
router.patch('/spaces/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = pick(req.body, ['name', 'description', 'status', 'mode', 'minGuests', 'maxGuests', 'capacity', 'bufferMinutes', 'zoneId']);
  if ('name' in set) set.name = str(set.name);
  // Rename camelCase → snake_case
  if ('minGuests'     in set) { set.min_guests     = set.minGuests;     delete set.minGuests; }
  if ('maxGuests'     in set) { set.max_guests     = set.maxGuests;     delete set.maxGuests; }
  if ('bufferMinutes' in set) { set.buffer_minutes = set.bufferMinutes; delete set.bufferMinutes; }
  if ('zoneId'        in set) { set.zone_id = validId(set.zoneId) ? oid(set.zoneId) : null; delete set.zoneId; }
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('spaces').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Space');
  res.json({ updated: true });
}));

// DELETE /api/catalog/spaces/:id [ADMIN] — soft delete
router.delete('/spaces/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('spaces')
    .updateOne({ _id: oid(id) }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
  if (!r.matchedCount) return notFound(res, 'Space');
  res.json({ deleted: true });
}));

const fmtSpace = (s) => ({
  id: String(s._id), name: s.name, zoneId: s.zone_id ? String(s.zone_id) : null,
  mode: s.mode, minGuests: s.min_guests, maxGuests: s.max_guests, capacity: s.capacity,
  bufferMinutes: s.buffer_minutes, description: s.description, status: s.status,
});

// ═══════════════════════════════════════════════════
// PACKAGES — gói đặt phòng
// ═══════════════════════════════════════════════════
router.get('/packages', pubLimit, wrap(async (req, res) => {
  const filter = req.session?.user?.role === 'ADMIN' ? {} : { status: 'ACTIVE' };
  if (req.query.spaceId && validId(req.query.spaceId)) filter.space_id = oid(req.query.spaceId);
  const pkgs = await req.app.locals.db.collection('packages').find(filter).sort({ name: 1 }).toArray();
  res.json(pkgs.map(fmtPkg));
}));

router.get('/packages/:id', pubLimit, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const pkg = await req.app.locals.db.collection('packages').findOne({ _id: oid(id) });
  if (!pkg) return notFound(res, 'Package');
  res.json(fmtPkg(pkg));
}));

router.post('/packages', ...ADMIN, wrap(async (req, res) => {
  const { name, spaceId, description, status = 'ACTIVE' } = req.body;
  if (!str(name)) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
  const now = new Date();
  const { insertedId } = await req.app.locals.db.collection('packages').insertOne({
    name: str(name),
    space_id: spaceId && validId(spaceId) ? oid(spaceId) : null,
    description: str(description), status, created_at: now, updated_at: now,
  });
  res.status(201).json({ id: String(insertedId) });
}));

router.patch('/packages/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = pick(req.body, ['name', 'description', 'status', 'spaceId']);
  if ('name' in set) set.name = str(set.name);
  if ('spaceId' in set) { set.space_id = validId(set.spaceId) ? oid(set.spaceId) : null; delete set.spaceId; }
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('packages').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Package');
  res.json({ updated: true });
}));

router.delete('/packages/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('packages')
    .updateOne({ _id: oid(id) }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
  if (!r.matchedCount) return notFound(res, 'Package');
  res.json({ deleted: true });
}));

const fmtPkg = (p) => ({
  id: String(p._id), name: p.name, spaceId: p.space_id ? String(p.space_id) : null,
  description: p.description, status: p.status,
});

// ═══════════════════════════════════════════════════
// SPACE PRICING — giá theo space + thời điểm
// ═══════════════════════════════════════════════════
router.get('/pricing', pubLimit, wrap(async (req, res) => {
  const filter = {};
  if (req.query.spaceId && validId(req.query.spaceId)) filter.space_id = oid(req.query.spaceId);
  const pricing = await req.app.locals.db.collection('space_pricing').find(filter).toArray();
  res.json(pricing.map(fmtPrice));
}));

router.post('/pricing', ...ADMIN, wrap(async (req, res) => {
  const { spaceId, label, unitPrice, unit = 'HOUR' } = req.body;
  if (!validId(spaceId)) return fail(res, 422, 'VALIDATION_ERROR', 'spaceId không hợp lệ');
  try { assertMoney(unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, 'VALIDATION_ERROR', e.message); }
  if (!str(label)) return fail(res, 422, 'VALIDATION_ERROR', 'label bắt buộc');
  const now = new Date();
  const { insertedId } = await req.app.locals.db.collection('space_pricing').insertOne({
    space_id: oid(spaceId), label: str(label), unit_price: unitPrice, unit,
    created_at: now, updated_at: now,
  });
  res.status(201).json({ id: String(insertedId) });
}));

router.patch('/pricing/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = pick(req.body, ['label', 'unitPrice', 'unit']);
  if ('unitPrice' in set) {
    try { assertMoney(set.unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, 'VALIDATION_ERROR', e.message); }
    set.unit_price = set.unitPrice; delete set.unitPrice;
  }
  if ('label' in set) set.label = str(set.label);
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('space_pricing').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Pricing');
  res.json({ updated: true });
}));

router.delete('/pricing/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('space_pricing').deleteOne({ _id: oid(id) });
  if (!r.deletedCount) return notFound(res, 'Pricing');
  res.json({ deleted: true });
}));

const fmtPrice = (p) => ({
  id: String(p._id), spaceId: String(p.space_id), label: p.label,
  unitPrice: p.unit_price, unit: p.unit,
});

// ═══════════════════════════════════════════════════
// ADD-ONS — dịch vụ thêm (hoa, bánh, setup…)
// ═══════════════════════════════════════════════════
router.get('/addons', pubLimit, wrap(async (req, res) => {
  const filter = req.session?.user?.role === 'ADMIN' ? {} : { status: 'ACTIVE' };
  const addons = await req.app.locals.db.collection('addons').find(filter).sort({ name: 1 }).toArray();
  res.json(addons.map(fmtAddon));
}));

router.post('/addons', ...ADMIN, wrap(async (req, res) => {
  const { name, unitPrice, description, status = 'ACTIVE' } = req.body;
  if (!str(name)) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
  try { assertMoney(unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, 'VALIDATION_ERROR', e.message); }
  const now = new Date();
  const { insertedId } = await req.app.locals.db.collection('addons').insertOne({
    name: str(name), unit_price: unitPrice, description: str(description),
    status, created_at: now, updated_at: now,
  });
  res.status(201).json({ id: String(insertedId) });
}));

router.patch('/addons/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = pick(req.body, ['name', 'unitPrice', 'description', 'status']);
  if ('name' in set) set.name = str(set.name);
  if ('unitPrice' in set) {
    try { assertMoney(set.unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, 'VALIDATION_ERROR', e.message); }
    set.unit_price = set.unitPrice; delete set.unitPrice;
  }
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('addons').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Addon');
  res.json({ updated: true });
}));

router.delete('/addons/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('addons')
    .updateOne({ _id: oid(id) }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
  if (!r.matchedCount) return notFound(res, 'Addon');
  res.json({ deleted: true });
}));

const fmtAddon = (a) => ({
  id: String(a._id), name: a.name, unitPrice: a.unit_price,
  description: a.description, status: a.status,
});

// ═══════════════════════════════════════════════════
// PRODUCTS — đồ uống / thực phẩm bán kèm
// ═══════════════════════════════════════════════════
router.get('/products', pubLimit, wrap(async (req, res) => {
  const filter = req.session?.user?.role === 'ADMIN' ? {} : { status: 'ACTIVE' };
  const products = await req.app.locals.db.collection('products').find(filter).sort({ name: 1 }).toArray();
  res.json(products.map(fmtProduct));
}));

router.post('/products', ...ADMIN, wrap(async (req, res) => {
  const { name, unitPrice, unit = 'ITEM', description, status = 'ACTIVE' } = req.body;
  if (!str(name)) return fail(res, 422, 'VALIDATION_ERROR', 'name bắt buộc');
  try { assertMoney(unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, 'VALIDATION_ERROR', e.message); }
  const now = new Date();
  const { insertedId } = await req.app.locals.db.collection('products').insertOne({
    name: str(name), unit_price: unitPrice, unit, description: str(description),
    status, created_at: now, updated_at: now,
  });
  res.status(201).json({ id: String(insertedId) });
}));

router.patch('/products/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = pick(req.body, ['name', 'unitPrice', 'unit', 'description', 'status']);
  if ('name' in set) set.name = str(set.name);
  if ('unitPrice' in set) {
    try { assertMoney(set.unitPrice, 'unitPrice'); } catch (e) { return fail(res, 422, 'VALIDATION_ERROR', e.message); }
    set.unit_price = set.unitPrice; delete set.unitPrice;
  }
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('products').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Product');
  res.json({ updated: true });
}));

router.delete('/products/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('products')
    .updateOne({ _id: oid(id) }, { $set: { status: 'INACTIVE', updated_at: new Date() } });
  if (!r.matchedCount) return notFound(res, 'Product');
  res.json({ deleted: true });
}));

const fmtProduct = (p) => ({
  id: String(p._id), name: p.name, unitPrice: p.unit_price,
  unit: p.unit, description: p.description, status: p.status,
});

// ═══════════════════════════════════════════════════
// RECIPES — công thức (product → nguyên liệu)
// ═══════════════════════════════════════════════════
router.get('/recipes', wrap(async (req, res) => {
  const filter = {};
  if (req.query.productId && validId(req.query.productId)) filter.product_id = oid(req.query.productId);
  const recipes = await req.app.locals.db.collection('recipes').find(filter).toArray();
  res.json(recipes.map(fmtRecipe));
}));

router.post('/recipes', ...ADMIN, wrap(async (req, res) => {
  const { productId, ingredients } = req.body;
  if (!validId(productId)) return fail(res, 422, 'VALIDATION_ERROR', 'productId không hợp lệ');
  if (!Array.isArray(ingredients) || !ingredients.length)
    return fail(res, 422, 'VALIDATION_ERROR', 'ingredients phải là mảng không rỗng');
  const now = new Date();
  const { insertedId } = await req.app.locals.db.collection('recipes').insertOne({
    product_id: oid(productId),
    ingredients: ingredients.map((i) => ({
      name: str(i.name), quantity: Number(i.quantity), unit: str(i.unit),
    })),
    created_at: now, updated_at: now,
  });
  res.status(201).json({ id: String(insertedId) });
}));

router.patch('/recipes/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const set = {};
  if (req.body.ingredients) {
    if (!Array.isArray(req.body.ingredients) || !req.body.ingredients.length)
      return fail(res, 422, 'VALIDATION_ERROR', 'ingredients phải là mảng không rỗng');
    set.ingredients = req.body.ingredients.map((i) => ({
      name: str(i.name), quantity: Number(i.quantity), unit: str(i.unit),
    }));
  }
  if (!Object.keys(set).length) return fail(res, 422, 'VALIDATION_ERROR', 'Không có gì để cập nhật');
  set.updated_at = new Date();
  const r = await req.app.locals.db.collection('recipes').updateOne({ _id: oid(id) }, { $set: set });
  if (!r.matchedCount) return notFound(res, 'Recipe');
  res.json({ updated: true });
}));

router.delete('/recipes/:id', ...ADMIN, wrap(async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return badId(res);
  const r = await req.app.locals.db.collection('recipes').deleteOne({ _id: oid(id) });
  if (!r.deletedCount) return notFound(res, 'Recipe');
  res.json({ deleted: true });
}));

const fmtRecipe = (r) => ({
  id: String(r._id), productId: String(r.product_id), ingredients: r.ingredients,
});

module.exports = router;

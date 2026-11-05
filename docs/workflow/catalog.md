# Workflow: Catalog — Danh mục & Quản trị CRUD

> Khi nhận issue liên quan đến spaces, zones, packages, giá, add-ons, products, recipes → đọc file này.

---

## 📂 Files liên quan

| File | Vai trò |
|------|---------|
| `my-server-mongodb/src/routes/catalog.js` | Toàn bộ CRUD catalog — 7 collections |
| `my-server-mongodb/src/config/indexes.js` | Indexes cho spaces, packages, pricing, addons, products, recipes |
| `my-server-mongodb/src/middleware/auth.js` | `requireAuth`, `requireRole('ADMIN')` |
| `my-server-mongodb/test/payment_catalog.test.js` | Tests requireRole + catalog helpers |

---

## 🗄️ Collections MongoDB

| Collection | Mô tả | Soft delete? |
|------------|-------|-------------|
| `zones` | Khu vực trong quán | ✅ `status: INACTIVE` |
| `spaces` | Phòng / không gian đặt chỗ | ✅ `status: INACTIVE` |
| `packages` | Gói đặt phòng | ✅ `status: INACTIVE` |
| `space_pricing` | Giá theo space + label | ❌ hard delete |
| `addons` | Dịch vụ thêm (hoa, bánh…) | ✅ `status: INACTIVE` |
| `products` | Đồ uống / thực phẩm | ✅ `status: INACTIVE` |
| `recipes` | Công thức (product → nguyên liệu) | ❌ hard delete |

---

## 🔧 Routes

| Resource | GET (public) | POST | PATCH | DELETE | Ghi chú |
|----------|-------------|------|-------|--------|---------|
| Zones | ✅ | ADMIN | ADMIN | ADMIN (soft) | filter: status ≠ INACTIVE |
| Spaces | ✅ | ADMIN | ADMIN | ADMIN (soft) | filter: status=ACTIVE (non-admin) |
| Packages | ✅ | ADMIN | ADMIN | ADMIN (soft) | filter: status=ACTIVE (non-admin) |
| Pricing | ✅ | ADMIN | ADMIN | ADMIN (hard) | — |
| Add-ons | ✅ | ADMIN | ADMIN | ADMIN (soft) | filter: status=ACTIVE (non-admin) |
| Products | ✅ | ADMIN | ADMIN | ADMIN (soft) | filter: status=ACTIVE (non-admin) |
| Recipes | ✅ | ADMIN | ADMIN | ADMIN (hard) | public read |

---

## 🔧 Helpers trong catalog.js

| Helper | Mô tả |
|--------|-------|
| `pick(body, keys)` | Chỉ lấy keys trong whitelist, bỏ undefined — chống over-posting |
| `assertMoney(v, name)` | Throw 422 nếu không phải integer ≥ 0 |
| `validId(id)` | `id && ObjectId.isValid(id)` |
| `oid(id)` | `new ObjectId(id)` |
| `notFound(res, name)` | Trả `fail(res, 404, 'NOT_FOUND', ...)` |
| `badId(res)` | Trả `fail(res, 422, 'VALIDATION_ERROR', 'id không hợp lệ')` |
| `fmtZone/Space/Pkg/Price/Addon/Product/Recipe` | Format output (camelCase, stringify ObjectId) |

---

## 🔄 Pattern CRUD chuẩn

```
GET  /api/catalog/<resource>       → public, filter status=ACTIVE (non-admin)
GET  /api/catalog/<resource>/:id   → public, 404 nếu không tìm thấy
POST /api/catalog/<resource>       → ADMIN, validate → insertOne → 201 { id }
PATCH /api/catalog/<resource>/:id  → ADMIN, pick whitelist → $set → 404/200
DELETE /api/catalog/<resource>/:id → ADMIN, soft: $set{status:INACTIVE} | hard: deleteOne
```

---

## 🔐 Phân quyền Admin/Customer

```js
// Middleware chain cho ADMIN routes
const ADMIN = [requireAuth, requireRole('ADMIN'), adminLimit];

// Dùng như spread array:
router.post('/spaces', ...ADMIN, wrap(async (req, res) => { ... }));

// Customer/Public chỉ GET:
router.get('/spaces', pubLimit, wrap(...));
```

**Quy tắc**:
- `GET` — public (không cần auth), nhưng ADMIN thấy cả `INACTIVE`
- `POST/PATCH/DELETE` — phải là ADMIN

---

## 🔍 Search keywords khi debug

- **403 khi tạo/sửa/xóa**: tìm `requireRole('ADMIN')`, `ADMIN` array, middleware chain
- **Soft delete không hoạt động**: tìm `status: 'INACTIVE'`, `matchedCount`
- **Giá không phải integer**: tìm `assertMoney`, `unit_price`
- **camelCase↔snake_case mapping**: tìm `minGuests→min_guests`, `unitPrice→unit_price`
- **pick() bị bỏ field**: tìm `pick(req.body, [...])`

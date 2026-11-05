# Tech Spec: Catalog & Admin CRUD

---

## 📌 Collections & Schema

### `zones`
```js
{ _id, name: String, description: String, status: 'ACTIVE'|'INACTIVE', created_at, updated_at }
```

### `spaces`
```js
{
  _id, name: String, zone_id: ObjectId|null,
  mode: 'EXCLUSIVE'|'SHARED',
  min_guests: Number, max_guests: Number, capacity: Number,
  buffer_minutes: Number,          // mặc định 15
  description: String,
  status: 'ACTIVE'|'MAINTENANCE'|'INACTIVE',
  created_at, updated_at,
}
// Indexes: { zone_id, status }
```

### `packages`
```js
{ _id, name, space_id: ObjectId|null, description, status: 'ACTIVE'|'INACTIVE', created_at, updated_at }
// Indexes: { space_id, status }
```

### `space_pricing`
```js
{ _id, space_id: ObjectId, label: String, unit_price: Number (VNĐ integer), unit: String, created_at, updated_at }
// Indexes: { space_id }
```

### `addons`
```js
{ _id, name, unit_price: Number, description, status: 'ACTIVE'|'INACTIVE', created_at, updated_at }
// Indexes: { status }
```

### `products`
```js
{ _id, name, unit_price: Number, unit: String, description, status: 'ACTIVE'|'INACTIVE', created_at, updated_at }
// Indexes: { status }
```

### `recipes`
```js
{
  _id, product_id: ObjectId,
  ingredients: [{ name: String, quantity: Number, unit: String }],
  created_at, updated_at,
}
// Indexes: { product_id }
```

---

## 🔐 Phân quyền

| Hành động | Customer/Public | Admin |
|-----------|----------------|-------|
| GET (list/detail) | ✅ chỉ ACTIVE | ✅ cả INACTIVE |
| POST (tạo mới) | ❌ | ✅ |
| PATCH (cập nhật) | ❌ | ✅ |
| DELETE (xoá) | ❌ | ✅ |

---

## 🗑️ Soft vs Hard Delete

| Collection | Delete type | Lý do |
|------------|------------|-------|
| zones, spaces, packages, addons, products | Soft: `status=INACTIVE` | Có booking/order reference |
| space_pricing, recipes | Hard: `deleteOne` | Không có reference từ booking |

---

## 📡 API Endpoints

| Resource | Base Path |
|----------|-----------|
| Zones | `/api/catalog/zones` |
| Spaces | `/api/catalog/spaces` |
| Packages | `/api/catalog/packages` |
| Pricing | `/api/catalog/pricing` |
| Add-ons | `/api/catalog/addons` |
| Products | `/api/catalog/products` |
| Recipes | `/api/catalog/recipes` |

Mỗi resource hỗ trợ: `GET /`, `GET /:id` (trừ recipes), `POST /`, `PATCH /:id`, `DELETE /:id`.

---

## ⚠️ Known Limitations & TODO

| Item | Priority |
|------|----------|
| Chưa có pagination cho GET list | Medium |
| Chưa validate `mode` khi PATCH space | Low |
| `recipes` chưa có GET /:id | Low |
| Chưa check `space_id` tồn tại khi tạo package/pricing | Medium |

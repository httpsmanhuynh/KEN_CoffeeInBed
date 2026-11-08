'use strict';
// Catalog API test (node:test). Chạy: npm run test:api
// Mặc định dùng mock server; test backend thật: TEST_BASE_URL=http://localhost:3000 ADMIN_TOKEN=... CUSTOMER_TOKEN=... npm run test:api
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, call, validSpace, uid } = require('../helpers/api');

before(start);
after(stop);

const createAdmin = async (col, body) => {
  const r = await call('POST', `/api/catalog/${col}`, { as: 'admin', body });
  assert.equal(r.status, 201, `Tạo ${col} thất bại: ${JSON.stringify(r.body)}`);
  return r.data;
};

describe('1. RBAC - BR-A04, BR-A05', () => {
  for (const col of ['spaces', 'zones', 'packages', 'products']) {
    test(`TC-CAT-A-001 [${col}]: Guest POST => 401`, async () => {
      const r = await call('POST', `/api/catalog/${col}`, { as: 'guest', body: validSpace() });
      assert.equal(r.status, 401);
    });
    test(`TC-CAT-A-002 [${col}]: Customer POST => 403`, async () => {
      const r = await call('POST', `/api/catalog/${col}`, { as: 'customer', body: validSpace() });
      assert.equal(r.status, 403);
    });
  }
  test('TC-CAT-A-003: Admin POST /spaces => 201 và trả về bản ghi ACTIVE', async () => {
    const r = await call('POST', '/api/catalog/spaces', { as: 'admin', body: validSpace({ name: 'Phòng họp A' }) });
    assert.equal(r.status, 201);
    assert.equal(r.data.name, 'Phòng họp A');
    assert.equal(r.data.status, 'ACTIVE');
    assert.ok(r.data.id);
  });
  test('TC-CAT-A-004: Guest/Customer không được PUT hoặc DELETE', async () => {
    const s = await createAdmin('spaces', validSpace());
    assert.equal((await call('PUT', `/api/catalog/spaces/${s.id}`, { as: 'guest', body: { name: 'x' } })).status, 401);
    assert.equal((await call('PUT', `/api/catalog/spaces/${s.id}`, { as: 'customer', body: { name: 'x' } })).status, 403);
    assert.equal((await call('DELETE', `/api/catalog/spaces/${s.id}`, { as: 'customer' })).status, 403);
    const after = await call('GET', `/api/catalog/spaces/${s.id}`, { as: 'admin' });
    assert.equal(after.data.status, 'ACTIVE'); // dữ liệu không đổi
  });
});

describe('2. Validation & Over-posting - NFR-03', () => {
  for (const [label, patch] of [
    ['capacity = -5', { capacity: -5 }],
    ['capacity = 0', { capacity: 0 }],
    ['unitPrice = -100', { unitPrice: -100 }],
    ['unitPrice là chữ', { unitPrice: 'abc' }],
    ['thiếu name', { name: '' }],
    ['status không hợp lệ', { status: 'DELETED' }],
  ]) {
    test(`TC-CAT-V-001: tạo Space với ${label} => 422`, async () => {
      const r = await call('POST', '/api/catalog/spaces', { as: 'admin', body: validSpace(patch) });
      assert.equal(r.status, 422);
    });
  }
  test('TC-CAT-V-002: 422 không tạo bản ghi rác trong danh sách', async () => {
    const name = `Bad-${uid()}`;
    await call('POST', '/api/catalog/spaces', { as: 'admin', body: validSpace({ name, capacity: -5 }) });
    const list = await call('GET', '/api/catalog/spaces', { as: 'admin' });
    assert.equal(list.data.some((s) => s.name === name), false);
  });
  test('TC-CAT-V-003: PUT với giá âm => 422 và giá cũ giữ nguyên', async () => {
    const s = await createAdmin('spaces', validSpace({ unitPrice: 200000 }));
    const r = await call('PUT', `/api/catalog/spaces/${s.id}`, { as: 'admin', body: { unitPrice: -1 } });
    assert.equal(r.status, 422);
    assert.equal((await call('GET', `/api/catalog/spaces/${s.id}`, { as: 'admin' })).data.unitPrice, 200000);
  });
  test('TC-CAT-V-004: Update chèn trường rác {is_admin:true} => bỏ qua, chỉ update name', async () => {
    const z = await createAdmin('zones', { name: 'Zone cũ' });
    const r = await call('PUT', `/api/catalog/zones/${z.id}`, { as: 'admin', body: { name: 'Zone 1', is_admin: true, role: 'ADMIN', id: 'hacked' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, 'Zone 1');
    assert.equal(r.data.is_admin, undefined);
    assert.equal(r.data.role, undefined);
    assert.equal(r.data.id, z.id); // id không bị ghi đè
  });
  test('TC-CAT-V-005: Create chèn trường rác không được lưu', async () => {
    const r = await call('POST', '/api/catalog/spaces', { as: 'admin', body: validSpace({ is_admin: true, createdBy: 'x' }) });
    assert.equal(r.status, 201);
    assert.equal(r.data.is_admin, undefined);
    assert.equal(r.data.createdBy, undefined);
  });
  test('TC-CAT-V-006: body rỗng không làm server lỗi 5xx', async () => {
    const r = await call('POST', '/api/catalog/spaces', { as: 'admin', body: undefined });
    assert.ok([201, 400, 422].includes(r.status)); // body rỗng không được làm server crash (5xx)
  });
});

describe('3. Soft delete - FR-3.1', () => {
  test('TC-CAT-D-001: DELETE zone => bản ghi còn, status = INACTIVE', async () => {
    const z = await createAdmin('zones', { name: `Zone-${uid()}` });
    const del = await call('DELETE', `/api/catalog/zones/${z.id}`, { as: 'admin' });
    assert.ok([200, 204].includes(del.status));
    const get = await call('GET', `/api/catalog/zones/${z.id}`, { as: 'admin' });
    assert.equal(get.status, 200);
    assert.equal(get.data.id, z.id);
    assert.equal(get.data.status, 'INACTIVE');
  });
  test('TC-CAT-D-002: bản ghi xóa mềm vẫn nằm trong danh sách của Admin', async () => {
    const s = await createAdmin('spaces', validSpace());
    await call('DELETE', `/api/catalog/spaces/${s.id}`, { as: 'admin' });
    const list = await call('GET', '/api/catalog/spaces', { as: 'admin' });
    assert.equal(list.data.find((x) => x.id === s.id)?.status, 'INACTIVE');
  });
  test('TC-CAT-D-003: bản ghi xóa mềm ẩn với Guest (list + detail)', async () => {
    const s = await createAdmin('spaces', validSpace());
    await call('DELETE', `/api/catalog/spaces/${s.id}`, { as: 'admin' });
    const list = await call('GET', '/api/catalog/spaces');
    assert.equal(list.data.some((x) => x.id === s.id), false);
    assert.equal((await call('GET', `/api/catalog/spaces/${s.id}`)).status, 404);
  });
  test('TC-CAT-D-004: DELETE id không tồn tại => 404', async () => {
    assert.equal((await call('DELETE', '/api/catalog/zones/khong-ton-tai', { as: 'admin' })).status, 404);
  });
  test('TC-CAT-D-005: DELETE lặp lại (idempotent) không lỗi 5xx', async () => {
    const z = await createAdmin('zones', { name: `Zone-${uid()}` });
    await call('DELETE', `/api/catalog/zones/${z.id}`, { as: 'admin' });
    const again = await call('DELETE', `/api/catalog/zones/${z.id}`, { as: 'admin' });
    assert.ok(again.status < 500);
    assert.equal((await call('GET', `/api/catalog/zones/${z.id}`, { as: 'admin' })).data.status, 'INACTIVE');
  });
});

describe('4. Read-only cho Guest', () => {
  test('TC-CAT-R-001: Guest GET /packages chỉ thấy ACTIVE (ẩn INACTIVE, MAINTENANCE)', async () => {
    const tag = uid();
    const act = await createAdmin('packages', { name: `ACT-${tag}`, unitPrice: 100000 });
    const ina = await createAdmin('packages', { name: `INA-${tag}`, unitPrice: 100000, status: 'INACTIVE' });
    const mnt = await createAdmin('packages', { name: `MNT-${tag}`, unitPrice: 100000, status: 'MAINTENANCE' });
    const r = await call('GET', '/api/catalog/packages'); // không JWT
    assert.equal(r.status, 200);
    assert.ok(r.data.length > 0);
    assert.ok(r.data.every((p) => p.status === 'ACTIVE'), 'Có item không ACTIVE bị lộ cho Guest');
    const ids = r.data.map((p) => p.id);
    assert.ok(ids.includes(act.id));
    assert.ok(!ids.includes(ina.id));
    assert.ok(!ids.includes(mnt.id));
  });
  test('TC-CAT-R-002: Admin thấy đủ cả 3 trạng thái', async () => {
    const r = await call('GET', '/api/catalog/packages', { as: 'admin' });
    const set = new Set(r.data.map((p) => p.status));
    for (const s of ['ACTIVE', 'INACTIVE', 'MAINTENANCE']) assert.ok(set.has(s), `Admin thiếu ${s}`);
  });
  test('TC-CAT-R-003: Customer cũng chỉ thấy ACTIVE', async () => {
    const r = await call('GET', '/api/catalog/spaces', { as: 'customer' });
    assert.ok(r.data.every((s) => s.status === 'ACTIVE'));
  });
  test('TC-CAT-R-004: Space chuyển MAINTENANCE => biến mất khỏi danh sách Guest', async () => {
    const s = await createAdmin('spaces', validSpace());
    assert.ok((await call('GET', '/api/catalog/spaces')).data.some((x) => x.id === s.id));
    await call('PUT', `/api/catalog/spaces/${s.id}`, { as: 'admin', body: { status: 'MAINTENANCE' } });
    assert.equal((await call('GET', '/api/catalog/spaces')).data.some((x) => x.id === s.id), false);
  });
});

describe('5. Dropdown liên kết (Package -> Space)', () => {
  test('TC-CAT-L-001: GET /spaces?status=ACTIVE (Admin) không chứa Space đã xóa mềm', async () => {
    const keep = await createAdmin('spaces', validSpace());
    const gone = await createAdmin('spaces', validSpace());
    await call('DELETE', `/api/catalog/spaces/${gone.id}`, { as: 'admin' });
    const r = await call('GET', '/api/catalog/spaces?status=ACTIVE', { as: 'admin' });
    const ids = r.data.map((x) => x.id);
    assert.ok(ids.includes(keep.id));
    assert.ok(!ids.includes(gone.id));
    assert.ok(r.data.every((x) => x.status === 'ACTIVE'));
  });
  test('TC-CAT-L-002: Package lưu đúng spaceIds & Product lưu imageUrl', async () => {
    const s = await createAdmin('spaces', validSpace());
    const p = await createAdmin('packages', { name: `Pkg-${uid()}`, unitPrice: 500000, spaceIds: [s.id] });
    assert.deepEqual((await call('GET', `/api/catalog/packages/${p.id}`, { as: 'admin' })).data.spaceIds, [s.id]);
    const pr = await createAdmin('products', { name: `Prd-${uid()}`, unitPrice: 30000, imageUrl: 'https://example.com/a.jpg' });
    assert.equal(pr.imageUrl, 'https://example.com/a.jpg');
  });
});

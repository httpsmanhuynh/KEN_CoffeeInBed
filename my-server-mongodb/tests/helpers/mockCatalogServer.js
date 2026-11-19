'use strict';
// Server mô phỏng đặc tả Catalog để chạy test ngay mà không cần Backend/MongoDB.
// Không đặt TEST_BASE_URL => test tự bật server này.
// Test backend thật: đặt TEST_BASE_URL=http://localhost:3000 + token (xem README).
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const V = require('./validators');

const TOKENS = { 'admin-token': 'ADMIN', 'customer-token': 'CUSTOMER' };
const PICK = {
  zones: ['name', 'description', 'status'],
  spaces: ['name', 'zoneId', 'capacity', 'unitPrice', 'status'],
  packages: ['name', 'unitPrice', 'spaceIds', 'inclusions', 'status'],
  products: ['name', 'unitPrice', 'imageUrl', 'status'],
};

function createServer() {
  const db = { zones: [], spaces: [], packages: [], products: [] };

  function validate(col, d, partial) {
    const has = (k) => d[k] !== undefined;
    if (!partial || has('name')) {
      if (typeof d.name !== 'string' || !d.name.trim()) throw new V.ValidationError('name bắt buộc', 'name');
    }
    if (col !== 'zones' && (!partial || has('unitPrice'))) V.assertMoney(d.unitPrice, 'unitPrice');
    if (col === 'spaces' && (!partial || has('capacity'))) V.assertPositiveInt(d.capacity, 'capacity');
    if (has('status')) V.assertEnum(d.status, V.STATUSES);
  }

  const handler = (req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        const url = new URL(req.url, 'http://x');
        const parts = url.pathname.split('/').filter(Boolean); // api catalog <col> [id]
        if (parts[0] !== 'api' || parts[1] !== 'catalog' || !PICK[parts[2]]) return send(404, { message: 'Not found' });
        const col = parts[2];
        const id = parts[3];
        const auth = (req.headers.authorization || '').replace('Bearer ', '');
        const role = TOKENS[auth] || null;
        const isAdmin = role === 'ADMIN';

        if (req.method === 'GET') {
          if (!id) {
            let list = db[col];
            if (!isAdmin) list = list.filter((x) => x.status === 'ACTIVE'); // Read-only cho Guest/Customer
            else if (url.searchParams.get('status')) list = list.filter((x) => x.status === url.searchParams.get('status'));
            return send(200, { data: list });
          }
          const item = db[col].find((x) => x.id === id);
          if (!item || (!isAdmin && item.status !== 'ACTIVE')) return send(404, { message: 'Not found' });
          return send(200, { data: item });
        }

        // Ghi dữ liệu: chỉ ADMIN (BR-A04, BR-A05)
        if (!role) return send(401, { message: 'Unauthorized' });
        if (!isAdmin) return send(403, { message: 'Forbidden' });
        const body = raw ? JSON.parse(raw) : {};

        if (req.method === 'POST' && !id) {
          const data = V.pick(body, PICK[col]);
          validate(col, data, false);
          const item = { id: randomUUID(), status: 'ACTIVE', ...data };
          db[col].push(item);
          return send(201, { data: item });
        }
        const item = db[col].find((x) => x.id === id);
        if (!item) return send(404, { message: 'Not found' });
        if (req.method === 'PUT' || req.method === 'PATCH') {
          const data = V.pick(body, PICK[col]);
          validate(col, data, true);
          Object.assign(item, data);
          return send(200, { data: item });
        }
        if (req.method === 'DELETE') { item.status = 'INACTIVE'; return send(200, { data: item }); } // Soft delete FR-3.1
        return send(405, { message: 'Method not allowed' });
      } catch (e) {
        if (e instanceof V.ValidationError) return send(422, { message: e.message, field: e.field });
        if (e instanceof SyntaxError) return send(400, { message: 'Invalid JSON' });
        return send(500, { message: e.message });
      }
    });
  };
  return http.createServer(handler);
}

module.exports = { createServer };

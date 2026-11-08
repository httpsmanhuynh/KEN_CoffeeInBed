'use strict';
// Helper dùng chung: tự bật mock server nếu không có TEST_BASE_URL.
const { createServer } = require('../../src/mockCatalogServer');

const TOKENS = {
  admin: process.env.ADMIN_TOKEN || 'admin-token',
  customer: process.env.CUSTOMER_TOKEN || 'customer-token',
  guest: null,
};
let server;
let base = process.env.TEST_BASE_URL;

async function start() {
  if (base) return base;
  server = createServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}
async function stop() { if (server) await new Promise((r) => server.close(r)); }

async function call(method, path, { as = 'guest', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKENS[as]) headers.Authorization = `Bearer ${TOKENS[as]}`;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch { /* body rỗng */ }
  return { status: res.status, body: json, data: json && json.data };
}

const uid = () => Math.random().toString(36).slice(2, 8);
const validSpace = (o = {}) => ({ name: `Space-${uid()}`, capacity: 10, unitPrice: 150000, ...o });

module.exports = { start, stop, call, validSpace, uid };

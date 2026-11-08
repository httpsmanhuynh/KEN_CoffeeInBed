'use strict';
// Client dùng chung cho các module (Admin, Payment). Tự bật mock nếu không có baseUrl.
const uid = () => Math.random().toString(36).slice(2, 8);

function makeClient({ factory, baseEnv }) {
  const tokens = {
    admin: process.env.ADMIN_TOKEN || 'admin-token',
    customer: process.env.CUSTOMER_TOKEN || 'customer-token',
    customer2: process.env.CUSTOMER2_TOKEN || 'customer2-token',
    guest: null,
  };
  let server;
  let base = process.env[baseEnv] || process.env.TEST_BASE_URL;
  return {
    async start() {
      if (base) return base;
      server = factory();
      await new Promise((r) => server.listen(0, r));
      base = `http://127.0.0.1:${server.address().port}`;
      return base;
    },
    async stop() { if (server) await new Promise((r) => server.close(r)); },
    get server() { return server; },
    async call(method, path, { as = 'guest', body, headers = {} } = {}) {
      const h = { 'Content-Type': 'application/json', ...headers };
      if (tokens[as]) h.Authorization = `Bearer ${tokens[as]}`;
      const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      let json = null;
      try { json = await res.json(); } catch { /* rỗng */ }
      return { status: res.status, body: json, data: json && json.data };
    },
  };
}
module.exports = { makeClient, uid };

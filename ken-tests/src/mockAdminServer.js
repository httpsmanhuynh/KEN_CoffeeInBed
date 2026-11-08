'use strict';
// Server mô phỏng đặc tả Admin Management & Dashboard (mục 3.11, 4.2).
// Test backend thật: đặt ADMIN_BASE_URL (hoặc TEST_BASE_URL) + ADMIN_TOKEN / CUSTOMER_TOKEN.
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const USERS = {
  'admin@ken.vn': { id: 'u-admin', name: 'Quản trị viên', password: 'Admin@123', role: 'ADMIN', locked: false },
  'an@ken.vn': { id: 'u-an', name: 'Nguyễn Văn An', password: 'Cust@123', role: 'CUSTOMER', locked: false },
  'binh@ken.vn': { id: 'u-binh', name: 'Trần Thị Bình', password: 'Cust@456', role: 'CUSTOMER', locked: false },
  'khoa@ken.vn': { id: 'u-khoa', name: 'Tài khoản bị khóa', password: 'Lock@123', role: 'CUSTOMER', locked: true },
};
const TOKENS = { 'admin-token': 'u-admin', 'customer-token': 'u-an', 'customer2-token': 'u-binh' };
const BY_ID = Object.fromEntries(Object.values(USERS).map((u) => [u.id, u]));
const FLOW = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], CANCELLED: [], EXPIRED: [],
};

function createServer() {
  const bookings = [];
  const handler = (req, res) => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        const url = new URL(req.url, 'http://x');
        const p = url.pathname.split('/').filter(Boolean);
        const body = raw ? JSON.parse(raw) : {};
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const me = BY_ID[TOKENS[token]] || null;
        const pub = (u) => ({ id: u.id, name: u.name, role: u.role }); // không lộ password/OTP

        if (req.method === 'POST' && url.pathname === '/api/auth/login') {
          const u = USERS[body.email];
          if (!body.email || !body.password) return send(422, { message: 'Thiếu email/mật khẩu' });
          if (!u || u.password !== body.password) return send(401, { message: 'Sai thông tin đăng nhập' });
          if (u.locked) return send(403, { message: 'Tài khoản bị khóa' });
          const t = u.role === 'ADMIN' ? 'admin-token' : u.id === 'u-an' ? 'customer-token' : 'customer2-token';
          return send(200, { token: t, user: pub(u) });
        }
        if (req.method === 'POST' && url.pathname === '/api/bookings') { // khách tạo booking để có dữ liệu
          if (!me) return send(401, { message: 'Unauthorized' });
          const total = Number(body.total);
          if (!Number.isFinite(total) || total < 0) return send(422, { message: 'total không hợp lệ' });
          const b = { id: randomUUID(), customerId: me.id, status: 'PENDING', paymentStatus: 'UNPAID', total, createdAt: new Date().toISOString() };
          bookings.push(b);
          return send(201, { data: b });
        }
        if (p[0] !== 'api' || p[1] !== 'admin') return send(404, { message: 'Not found' });
        if (!me) return send(401, { message: 'Unauthorized' });
        if (me.role !== 'ADMIN') return send(403, { message: 'Forbidden' });

        const view = (b) => ({ ...b, customer: pub(BY_ID[b.customerId]) });
        if (req.method === 'GET' && p[2] === 'bookings' && !p[3]) {
          let l = bookings;
          const st = url.searchParams.get('status'), q = url.searchParams.get('q'), from = url.searchParams.get('from');
          if (st) { if (!FLOW[st]) return send(422, { message: 'status không hợp lệ' }); l = l.filter((b) => b.status === st); }
          if (q) l = l.filter((b) => BY_ID[b.customerId].name.toLowerCase().includes(q.toLowerCase()) || b.id.startsWith(q));
          if (from) l = l.filter((b) => b.createdAt >= from);
          return send(200, { data: l.map(view), total: l.length });
        }
        if (p[2] === 'bookings' && p[3]) {
          const b = bookings.find((x) => x.id === p[3]);
          if (!b) return send(404, { message: 'Not found' });
          if (req.method === 'GET') return send(200, { data: view(b) });
          if (req.method === 'PATCH' && p[4] === 'status') {
            const to = body.status;
            if (!FLOW[to]) return send(422, { message: 'status không hợp lệ' });
            if (!FLOW[b.status].includes(to)) return send(409, { message: `Không thể chuyển ${b.status} -> ${to}` });
            b.status = to; // chỉ lấy "status", bỏ qua total/customerId do client gửi
            return send(200, { data: view(b) });
          }
        }
        if (req.method === 'GET' && p[2] === 'dashboard') {
          const byStatus = Object.fromEntries(Object.keys(FLOW).map((s) => [s, bookings.filter((b) => b.status === s).length]));
          const revenue = bookings.filter((b) => b.paymentStatus === 'PAID' && b.status !== 'CANCELLED').reduce((s, b) => s + b.total, 0);
          return send(200, { data: { totalBookings: bookings.length, byStatus, revenue } });
        }
        if (req.method === 'GET' && p[2] === 'customers' && p[3]) {
          const u = BY_ID[p[3]];
          if (!u || u.role !== 'CUSTOMER') return send(404, { message: 'Not found' });
          return send(200, { data: { ...pub(u), bookingCount: bookings.filter((b) => b.customerId === u.id).length } });
        }
        return send(404, { message: 'Not found' });
      } catch (e) {
        return send(e instanceof SyntaxError ? 400 : 500, { message: e.message });
      }
    });
  };
  const server = http.createServer(handler);
  server.__bookings = bookings; // cho test đặt trạng thái thanh toán (mô phỏng Payment module)
  return server;
}
module.exports = { createServer };

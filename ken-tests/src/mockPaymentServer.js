'use strict';
// Server mô phỏng Booking + Thanh toán (mục 3.6, 3.7). Số tiền luôn do SERVER tính (NFR-03).
// Test backend thật: PAYMENT_BASE_URL, ADMIN_TOKEN, CUSTOMER_TOKEN, CUSTOMER2_TOKEN, PAYMENT_WEBHOOK_SECRET.
const http = require('node:http');
const crypto = require('node:crypto');

const SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'gateway-secret';
const TOKENS = { 'admin-token': { id: 'u-admin', role: 'ADMIN' }, 'customer-token': { id: 'u-an', role: 'CUSTOMER' }, 'customer2-token': { id: 'u-binh', role: 'CUSTOMER' } };
const PACKAGES = { 'pkg-basic': 500000, 'pkg-pro': 800000 };
const ADDONS = { cafe: 30000, banh: 25000 };
const METHODS = ['VNPAY', 'MOMO', 'BANK_TRANSFER'];
const HOLD_MS = 15 * 60 * 1000;

function createServer() {
  const bookings = [];
  const payments = [];
  const expireIfNeeded = (b) => {
    if (b.status === 'PENDING' && Date.now() > b.expiresAt) b.status = 'EXPIRED';
  };

  const handler = (req, res) => {
    const send = (c, body) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    let raw = '';
    req.on('data', (d) => (raw += d));
    req.on('end', () => {
      try {
        const url = new URL(req.url, 'http://x');
        const p = url.pathname.split('/').filter(Boolean);
        const body = raw ? JSON.parse(raw) : {};
        const me = TOKENS[(req.headers.authorization || '').replace('Bearer ', '')] || null;
        const canSee = (ownerId) => me && (me.role === 'ADMIN' || me.id === ownerId);

        if (url.pathname === '/__expire' && req.method === 'POST') { // chỉ mock: ép booking hết hạn giữ chỗ
          const b = bookings.find((x) => x.id === body.id); if (b) b.expiresAt = 0; return send(200, {});
        }
        // ---- Webhook từ cổng thanh toán (xác thực bằng chữ ký, không dùng JWT)
        if (req.method === 'POST' && p[1] === 'payments' && p[3] === 'callback') {
          const sig = req.headers['x-signature'] || '';
          const expect = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
          if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return send(401, { message: 'Chữ ký không hợp lệ' });
          const pay = payments.find((x) => x.id === p[2]);
          if (!pay) return send(404, { message: 'Not found' });
          const b = bookings.find((x) => x.id === pay.bookingId);
          if (!['SUCCESS', 'FAILED'].includes(body.result)) return send(422, { message: 'result không hợp lệ' });
          if (body.result === 'SUCCESS') {
            if (pay.status === 'PAID') return send(200, { data: pay, idempotent: true });
            if (pay.status !== 'PENDING') return send(409, { message: `Payment đang ở ${pay.status}` });
            if (body.amount !== pay.amount) return send(422, { message: 'Số tiền không khớp' });
            pay.status = 'PAID'; b.status = 'CONFIRMED'; b.paymentStatus = 'PAID';
            return send(200, { data: pay });
          }
          if (pay.status === 'PAID' || pay.status === 'REFUNDED') return send(409, { message: 'Giao dịch đã thanh toán' });
          pay.status = 'FAILED';
          return send(200, { data: pay });
        }

        if (!me) return send(401, { message: 'Unauthorized' });

        if (req.method === 'POST' && url.pathname === '/api/bookings') {
          const base = PACKAGES[body.packageId];
          if (base === undefined) return send(422, { message: 'packageId không hợp lệ' });
          let total = base;
          for (const a of body.addons || []) {
            if (ADDONS[a.id] === undefined || !Number.isInteger(a.qty) || a.qty <= 0) return send(422, { message: 'addon không hợp lệ' });
            total += ADDONS[a.id] * a.qty;
          }
          const b = { id: crypto.randomUUID(), customerId: me.id, status: 'PENDING', paymentStatus: 'UNPAID', total, expiresAt: Date.now() + HOLD_MS };
          bookings.push(b); // bỏ qua mọi "total" do client gửi
          return send(201, { data: b });
        }
        if (req.method === 'GET' && p[1] === 'bookings' && p[2]) {
          const b = bookings.find((x) => x.id === p[2]); if (!b) return send(404, {});
          if (!canSee(b.customerId)) return send(403, {});
          expireIfNeeded(b); return send(200, { data: b });
        }
        if (req.method === 'POST' && url.pathname === '/api/payments') {
          const b = bookings.find((x) => x.id === body.bookingId);
          if (!b) return send(404, { message: 'Booking không tồn tại' });
          if (me.id !== b.customerId) return send(403, { message: 'Forbidden' });
          if (!METHODS.includes(body.method)) return send(422, { message: 'method không hợp lệ' });
          expireIfNeeded(b);
          if (b.status !== 'PENDING') return send(409, { message: `Booking đang ở ${b.status}` });
          const key = req.headers['idempotency-key'];
          const open = payments.find((x) => x.bookingId === b.id && x.status === 'PENDING');
          if (open) {
            if (key && open.idempotencyKey === key) return send(200, { data: open, idempotent: true });
            return send(409, { message: 'Đang có giao dịch chờ thanh toán' });
          }
          const pay = { id: crypto.randomUUID(), bookingId: b.id, amount: b.total, method: body.method, status: 'PENDING', idempotencyKey: key || null };
          payments.push(pay);
          return send(201, { data: { ...pay, paymentUrl: `https://pay.example/${pay.id}` } });
        }
        if (req.method === 'GET' && p[1] === 'payments' && p[2]) {
          const pay = payments.find((x) => x.id === p[2]); if (!pay) return send(404, {});
          const b = bookings.find((x) => x.id === pay.bookingId);
          return canSee(b.customerId) ? send(200, { data: pay }) : send(403, {});
        }
        if (req.method === 'POST' && p[1] === 'payments' && p[3] === 'refund') {
          if (me.role !== 'ADMIN') return send(403, { message: 'Forbidden' });
          const pay = payments.find((x) => x.id === p[2]); if (!pay) return send(404, {});
          if (pay.status !== 'PAID') return send(409, { message: 'Chỉ hoàn tiền giao dịch đã thanh toán' });
          pay.status = 'REFUNDED'; bookings.find((x) => x.id === pay.bookingId).status = 'CANCELLED';
          return send(200, { data: pay });
        }
        return send(404, { message: 'Not found' });
      } catch (e) {
        return send(e instanceof SyntaxError ? 400 : 500, { message: e.message });
      }
    });
  };
  return http.createServer(handler);
}
module.exports = { createServer };

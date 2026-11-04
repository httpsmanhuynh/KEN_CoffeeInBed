'use strict';
// Rate limit trong RAM (dev/đồ án). Chạy nhiều instance thì dùng Redis/express-rate-limit.
// key: hàm (req) => string; mặc định theo IP. Gắn vào TỪNG route (không router.use) để request
// không khớp route nào không bị đếm, và route mount nhiều chỗ không bị đếm đôi.
function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const k = String(key(req)).slice(0, 120); // chặn key quá dài làm phình Map
    let h = hits.get(k);
    if (!h || h.reset <= now) { h = { count: 0, reset: now + windowMs }; hits.set(k, h); }
    if (++h.count > max) return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Thử lại sau ít phút' });
    next();
  };
}
module.exports = { rateLimit };

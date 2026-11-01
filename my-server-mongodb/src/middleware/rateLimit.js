'use strict';
// Rate limit đơn giản trong RAM (dev/đồ án). Chạy nhiều instance thì dùng Redis/express-rate-limit.
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.count > max) return res.status(429).json({ code: 'TOO_MANY_REQUESTS', message: 'Thử lại sau ít phút' });
    next();
  };
}
module.exports = { rateLimit };

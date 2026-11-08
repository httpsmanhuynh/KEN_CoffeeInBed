'use strict';
const crypto = require('node:crypto');
const { makeClient, uid } = require('./client');
const { createServer } = require('../../src/mockPaymentServer');
const api = makeClient({ factory: createServer, baseEnv: 'PAYMENT_BASE_URL' });
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'gateway-secret';

// Mô phỏng cổng thanh toán gọi webhook (ký HMAC-SHA256 trên đúng chuỗi body)
api.callback = (paymentId, body, { signature } = {}) => {
  const sig = signature ?? crypto.createHmac('sha256', SECRET).update(JSON.stringify(body)).digest('hex');
  return api.call('POST', `/api/payments/${paymentId}/callback`, { body, headers: { 'X-Signature': sig } });
};
api.expire = (id) => fetch(`${process.env.PAYMENT_BASE_URL || `http://127.0.0.1:${api.server.address().port}`}/__expire`, { method: 'POST', body: JSON.stringify({ id }) });
api.uid = uid;
module.exports = api;

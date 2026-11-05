const test = require('node:test');
const assert = require('node:assert');
const otp = require('../src/services/otp');

test('issueOtp luôn sinh mã đủ 6 chữ số', async () => {
  const db = {
    collection: () => ({
      updateMany: async () => ({}),
      insertOne: async () => ({ insertedId: 'x' }),
    }),
  };

  const codes = [];
  const origLog = console.log;
  console.log = (...args) => {
    const m = String(args.join(' ')).match(/cua ban:\s*(\d+)/);
    if (m) codes.push(m[1]);
  };

  try {
    for (let i = 0; i < 1000; i++) {
      await otp.issueOtp(db, { phone: '0909123456', purpose: 'REGISTER', pendingData: {} });
    }
  } finally {
    console.log = origLog;
  }

  assert.strictEqual(codes.length, 1000);
  for (const c of codes) assert.match(c, /^\d{6}$/);
});

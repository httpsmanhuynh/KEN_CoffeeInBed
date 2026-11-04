   const test = require('node:test');
   const assert = require('node:assert');
   const { destroySession } = require('../src/middleware/auth');

   test('destroySession reject khi session.destroy lỗi', async () => {
     const req = { session: { destroy: (cb) => cb(new Error('store error')) } };
     const res = { clearCookie: () => {} };
     await assert.rejects(() => destroySession(req, res), /store error/);
   });
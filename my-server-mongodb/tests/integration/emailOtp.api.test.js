'use strict';
/**
 * Kiểm thử tích hợp toàn diện luồng phát hành & xác thực OTP qua Email (TC-EMAIL-01..05)
 * Kênh gửi: nếu có Email -> gửi qua Email; không có Email -> SMS mock terminal.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { ObjectId } = require('mongodb');

const authRouter = require('../../src/routes/auth');
const profileRouter = require('../../src/routes/profile');

function createTestDb() {
  const collections = {
    users: [],
    otp_codes: [],
    membership_tiers: [
      { _id: new ObjectId(), code: 'BASIC', level_order: 1, min_points: 0, discount_rate: 0 }
    ],
  };

  return {
    collection(name) {
      const rows = collections[name] || (collections[name] = []);
      return {
        async findOne(filter) {
          if (filter.$or && Array.isArray(filter.$or)) {
            for (const sub of filter.$or) {
              const found = await this.findOne(sub);
              if (found) return found;
            }
            return null;
          }
          return rows.find(r => {
            return Object.entries(filter).every(([k, v]) => {
              if (v && typeof v === 'object' && v.$type) return true;
              if (v instanceof ObjectId) return String(r[k]) === String(v);
              return String(r[k]) === String(v);
            });
          }) || null;
        },
        async insertOne(doc) {
          const inserted = { _id: new ObjectId(), ...doc };
          rows.push(inserted);
          return { insertedId: inserted._id };
        },
        async updateOne(filter, update) {
          const doc = rows.find(r => {
            return Object.entries(filter).every(([k, v]) => {
              if (v && typeof v === 'object' && v.$lt !== undefined) return (r[k] || 0) < v.$lt;
              if (v instanceof ObjectId) return String(r[k]) === String(v);
              return String(r[k]) === String(v);
            });
          });
          if (!doc) return { matchedCount: 0 };
          if (update.$set) Object.assign(doc, update.$set);
          if (update.$inc) {
            for (const [k, val] of Object.entries(update.$inc)) {
              doc[k] = (doc[k] || 0) + val;
            }
          }
          return { matchedCount: 1 };
        },
        async updateMany(filter, update) {
          let count = 0;
          for (const doc of rows) {
            const matches = Object.entries(filter).every(([k, v]) => String(doc[k]) === String(v));
            if (matches) {
              if (update.$set) Object.assign(doc, update.$set);
              count++;
            }
          }
          return { matchedCount: count };
        },
      };
    },
    _raw: collections
  };
}

test('TC-EMAIL-01: Đăng ký có Email -> phát hành OTP về Email và xác thực tạo user thành công', async () => {
  const db = createTestDb();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false, cookie: { maxAge: 3600000 } }));
  app.locals.db = db;
  app.use('/api', authRouter);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  let capturedEmail = null;
  let capturedOtp = null;
  const origLog = console.log;
  console.log = (...args) => {
    origLog(...args);
    const line = args.join(' ');
    const emailMatch = line.match(/\[EMAIL(?: mock)?\]\s*([^:]+):/);
    if (emailMatch) capturedEmail = emailMatch[1].trim();
    const otpMatch = line.match(/cua ban:\s*(\d{6})/);
    if (otpMatch) capturedOtp = otpMatch[1];
  };

  try {
    const regRes = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Huỳnh Tuyết Mẫn',
        phone: '0912345678',
        email: 'manhuynh.test@gmail.com',
        dateOfBirth: '2002-05-15',
        password: 'Password123@'
      })
    });
    assert.equal(regRes.status, 201);
    assert.equal(capturedEmail, 'manhuynh.test@gmail.com');
    assert.ok(capturedOtp && /^\d{6}$/.test(capturedOtp));

    const verifyRes = await fetch(`${baseUrl}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0912345678', code: capturedOtp })
    });
    assert.equal(verifyRes.status, 200);

    const userInDb = await db.collection('users').findOne({ phone: '0912345678' });
    assert.ok(userInDb);
    assert.equal(userInDb.email, 'manhuynh.test@gmail.com');
    assert.equal(userInDb.status, 'ACTIVE');
  } finally {
    console.log = origLog;
    server.close();
  }
});

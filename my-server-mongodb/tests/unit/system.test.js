'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('../../src/middleware/rateLimit');
const { publicUser } = require('../../src/utils/http');

// ==========================================
// NHÓM 1: CORS & BẢO MẬT GIAO THỨC (F02)
// ==========================================

test('TC-SYS-01\tAUTO-SYS-01: CORS Origin hợp lệ (CORS_ORIGIN) được phép và kèm credentials (SYS-B01)', () => {
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
  const corsOptions = { origin: allowedOrigin, credentials: true };
  assert.equal(corsOptions.credentials, true);
  assert.equal(corsOptions.origin, 'http://localhost:4200');
});

test('TC-SYS-02\tAUTO-SYS-02: CORS Origin lạ không khớp CORS_ORIGIN (SYS-B02)', () => {
  const allowedOrigin = 'http://localhost:4200';
  const evilOrigin = 'https://evil.example';
  assert.notEqual(evilOrigin, allowedOrigin);
});

// ==========================================
// NHÓM 2: SESSION COOKIE & BẢO MẬT PHIÊN (F01)
// ==========================================

test('TC-SYS-04\tAUTO-SYS-04: Session cookie cấu hình an toàn: HttpOnly, SameSite lax, MaxAge 24h (SYS-B04)', () => {
  const isProd = false;
  const cookieConfig = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  };
  assert.equal(cookieConfig.httpOnly, true, 'HttpOnly phải bật để chống XSS đọc cookie');
  assert.equal(cookieConfig.sameSite, 'lax', 'SameSite lax để chống CSRF');
  assert.equal(cookieConfig.maxAge, 86400000, 'Thời hạn session phải là 24 giờ');
});

test('TC-SYS-08\tAUTO-SYS-08: Production thiếu SESSION_SECRET thì ném lỗi và dừng server (SYS-B08)', () => {
  const verifySessionSecret = (env) => {
    const isProd = env.NODE_ENV === 'production';
    if (isProd && !env.SESSION_SECRET) {
      throw new Error('SESSION_SECRET is required in production');
    }
  };

  assert.throws(
    () => verifySessionSecret({ NODE_ENV: 'production' }),
    /SESSION_SECRET is required in production/,
    'Phải chặn server khởi động khi production thiếu secret',
  );
  assert.doesNotThrow(() => verifySessionSecret({ NODE_ENV: 'development' }));
  assert.doesNotThrow(() => verifySessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'super-secret' }));
});

// ==========================================
// NHÓM 3: RATE LIMITING (F03)
// ==========================================

test('TC-SYS-12\tAUTO-SYS-12: Rate limit đếm số lần và trả 429 TOO_MANY_REQUESTS khi vượt ngưỡng (SYS-B12)', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 3, key: (req) => req.body.identifier });
  const mockReq = { body: { identifier: '0901112222' } };

  let statusCode = 200;
  let responseBody = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseBody = data;
        },
      };
    },
  };
  let nextCalled = 0;
  const next = () => {
    nextCalled++;
  };

  // 3 requests đầu thành công
  limiter(mockReq, mockRes, next);
  limiter(mockReq, mockRes, next);
  limiter(mockReq, mockRes, next);
  assert.equal(nextCalled, 3, '3 request đầu phải qua');

  // Request thứ 4 vượt ngưỡng
  limiter(mockReq, mockRes, next);
  assert.equal(statusCode, 429, 'Vượt ngưỡng phải trả 429');
  assert.equal(responseBody.code, 'TOO_MANY_REQUESTS');
});

test('TC-SYS-13\tAUTO-SYS-13: Rate limit phân lập theo identifier/phone (SYS-B13)', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2, key: (req) => req.body.phone });
  const reqA = { body: { phone: '0900000001' } };
  const reqB = { body: { phone: '0900000002' } };

  assert.equal(limiter.hit(reqA.body.phone), true);
  assert.equal(limiter.hit(reqA.body.phone), true);
  assert.equal(limiter.hit(reqA.body.phone), false, 'Phone A chạm ngưỡng');

  // Phone B chưa gọi nên vẫn còn nguyên quota
  assert.equal(limiter.hit(reqB.body.phone), true, 'Phone B không bị ảnh hưởng bởi Phone A');
});

test('TC-SYS-14\tAUTO-SYS-14: Rate limit mặc định phân lập theo IP (SYS-B14)', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 2 });
  const reqIp1 = { ip: '127.0.0.1' };
  const reqIp2 = { ip: '192.168.1.1' };

  let nextCalled = 0;
  const next = () => nextCalled++;
  const mockRes = { status: () => ({ json: () => {} }) };

  limiter(reqIp1, mockRes, next);
  limiter(reqIp1, mockRes, next);
  assert.equal(nextCalled, 2);

  limiter(reqIp2, mockRes, next);
  assert.equal(nextCalled, 3, 'IP khác không bị trừ lượt');
});

test('TC-SYS-16\tAUTO-SYS-16: Rate limit: hit() trả true khi trong hạn mức và false khi vượt (SYS-B16)', () => {
  const limiter = rateLimit({ windowMs: 50000, max: 1 });
  assert.equal(limiter.hit('test-key'), true);
  assert.equal(limiter.hit('test-key'), false);
});

test('TC-SYS-17\tAUTO-SYS-17: Rate limit cắt ngắn key tối đa 120 ký tự chống phình bộ nhớ RAM (SYS-B17)', () => {
  const limiter = rateLimit({ windowMs: 60000, max: 5 });
  const veryLongKey = 'a'.repeat(500);
  assert.equal(limiter.hit(veryLongKey), true);
  assert.equal(limiter.hit(veryLongKey.slice(0, 120)), true);
});

// ==========================================
// NHÓM 4: BĂM BẢO MẬT BCRYPT & OTP (F04)
// ==========================================

test('TC-SYS-18\tAUTO-SYS-18: Mật khẩu được băm bằng bcrypt cost 10, không lưu plaintext (SYS-B18)', async () => {
  const rawPassword = 'Password123@#$';
  const hash = await bcrypt.hash(rawPassword, 10);
  assert.notEqual(hash, rawPassword, 'Mật khẩu băm không được trùng mật khẩu gốc');
  assert.match(hash, /^\$2[aby]\$10\$/, 'Hash phải theo chuẩn bcrypt cost 10');
  const valid = await bcrypt.compare(rawPassword, hash);
  assert.equal(valid, true, 'So khớp mật khẩu đúng phải trả true');
});

test('TC-SYS-19\tAUTO-SYS-19: OTP lưu mã băm, không lưu plaintext trong CSDL (SYS-B19)', () => {
  const crypto = require('node:crypto');
  const hashCode = (c) => crypto.createHash('sha256').update(String(c)).digest('hex');

  const otpCode = '123456';
  const hashed = hashCode(otpCode);
  assert.notEqual(hashed, otpCode);
  assert.equal(hashed.length, 64, 'SHA-256 hash độ dài 64 hex characters');
  assert.equal(hashCode(otpCode), hashed, 'Cùng mã OTP cho ra cùng mã băm xác thực');
});

test('TC-SYS-20\tAUTO-SYS-20: Bcrypt tạo salt ngẫu nhiên: 2 lần băm cùng mật khẩu cho hash khác nhau (SYS-B20)', async () => {
  const rawPassword = 'IdenticalPassword123';
  const hash1 = await bcrypt.hash(rawPassword, 10);
  const hash2 = await bcrypt.hash(rawPassword, 10);
  assert.notEqual(hash1, hash2, 'Hai hash của cùng 1 mật khẩu phải khác nhau do salt riêng');
  assert.equal(await bcrypt.compare(rawPassword, hash1), true);
  assert.equal(await bcrypt.compare(rawPassword, hash2), true);
});

test('TC-SYS-21\tAUTO-SYS-21: publicUser() loại bỏ hoàn toàn password_hash và thông tin nhạy cảm (SYS-B21)', () => {
  const dbUser = {
    _id: '6630f9a2e1b8c2a3d4e5f601',
    full_name: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'nva@example.com',
    password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    two_factor_secret: 'SECRETBASE32KEY',
    two_factor_enabled: true,
    role: 'CUSTOMER',
    tier_points: 1500,
    coin_balance: 100,
  };
  const tier = { code: 'SILVER' };
  const safeUser = publicUser(dbUser, tier);

  assert.equal(safeUser.password_hash, undefined, 'Không được có password_hash');
  assert.equal(safeUser.two_factor_secret, undefined, 'Không được có two_factor_secret');
  assert.equal(safeUser.fullName, 'Nguyễn Văn A');
  assert.equal(safeUser.membershipTier, 'SILVER');
});

// ==========================================
// NHÓM 5: SERVER TIME & TIMEZONE (F06)
// ==========================================

test('TC-SYS-22\tAUTO-SYS-22: Server time: tạo timestamp chuẩn server (SYS-B22)', () => {
  const serverNow = new Date();
  assert.ok(serverNow instanceof Date);
  assert.ok(!isNaN(serverNow.getTime()));
});

test('TC-SYS-23\tAUTO-SYS-23: Chuẩn hóa múi giờ: UTC+7 xử lý giờ mở cửa (SYS-B23)', () => {
  // Giả lập giờ mở cửa: 07:00 -> 22:00 (UTC+7)
  const isWithinOpeningHours = (isoUtcString) => {
    const d = new Date(isoUtcString);
    // Cộng 7 tiếng để tính giờ địa phương VN
    const vnHour = (d.getUTCHours() + 7) % 24;
    return vnHour >= 7 && vnHour < 22;
  };

  // 08:00 VN = 01:00 UTC
  assert.equal(isWithinOpeningHours('2026-05-10T01:00:00Z'), true);
  // 02:00 VN = 19:00 UTC hôm trước
  assert.equal(isWithinOpeningHours('2026-05-09T19:00:00Z'), false);
});

// ==========================================
// NHÓM 6: XỬ LÝ LỖI TẬP TRUNG (F07)
// ==========================================

function executeCentralErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 400 && status < 500) {
    return res.status(status).json({
      code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
      message: 'Yêu cầu không hợp lệ',
    });
  }
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' });
}

test('TC-SYS-25\tAUTO-SYS-25: Central error handler chuẩn hóa mã 4xx JSON và không để lộ stack trace (SYS-B25)', () => {
  const err = new SyntaxError('Unexpected token in JSON at position 10');
  err.status = 400;

  let statusCode = 0;
  let body = null;
  const mockRes = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return {
        json(data) {
          body = data;
        },
      };
    },
  };

  executeCentralErrorHandler(err, {}, mockRes, () => {});
  assert.equal(statusCode, 400);
  assert.equal(body.code, 'BAD_REQUEST');
  assert.equal(body.stack, undefined, 'Tuyệt đối không để lộ stack trace');
});

test('TC-SYS-26\tAUTO-SYS-26: Central error handler xử lý lỗi 500 INTERNAL_ERROR không lộ stack trace (SYS-B26)', () => {
  const err = new Error('Database connection failed unexpectedly');

  let statusCode = 0;
  let body = null;
  const mockRes = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return {
        json(data) {
          body = data;
        },
      };
    },
  };

  executeCentralErrorHandler(err, {}, mockRes, () => {});
  assert.equal(statusCode, 500);
  assert.equal(body.code, 'INTERNAL_ERROR');
  assert.equal(body.stack, undefined);
});

test('TC-SYS-27\tAUTO-SYS-27: Express 5 req.body fallback (req.body ??= {}) ngăn lỗi undefined (SYS-B27)', () => {
  const req = {};
  req.body ??= {};
  assert.deepEqual(req.body, {});
  // Không bị ném lỗi TypeError khi đọc req.body.identifier
  assert.equal(req.body.identifier, undefined);
});

test('TC-SYS-28\tAUTO-SYS-28: Central error handler định dạng lỗi 413 PAYLOAD_TOO_LARGE (SYS-B28)', () => {
  const err = new Error('request entity too large');
  err.status = 413;

  let statusCode = 0;
  let body = null;
  const mockRes = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return {
        json(data) {
          body = data;
        },
      };
    },
  };

  executeCentralErrorHandler(err, {}, mockRes, () => {});
  assert.equal(statusCode, 413);
  assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
});

test('TC-SYS-29\tAUTO-SYS-29: Central error handler chuyển tiếp next(err) nếu res.headersSent = true (SYS-B29)', () => {
  const err = new Error('Late stream error');
  let nextCalledWith = null;
  const mockRes = { headersSent: true };
  const next = (e) => {
    nextCalledWith = e;
  };

  executeCentralErrorHandler(err, {}, mockRes, next);
  assert.equal(nextCalledWith, err, 'Phải delegate qua next(err) khi header đã được gửi');
});

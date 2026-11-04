'use strict';
async function ensureIndexes(db) {
  await db.collection('users').createIndex({ phone: 1 }, { unique: true }); // BR-A02
  await db
    .collection('users')
    .createIndex(
      { email: 1 },
      { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
    );
  await db.collection('otp_codes').createIndex({ expires_at: 1 }, { expireAfterSeconds: 86400 }); // dọn OTP cũ

  // Loyalty indexes: chống cộng điểm 2 lần cho cùng booking (idempotent)
  await db
    .collection('loyalty_transactions')
    .createIndex({ booking_id: 1, type: 1 }, { unique: true, partialFilterExpression: { booking_id: { $exists: true } } });
  // Truy vấn lịch sử theo user, sắp theo thời gian
  await db.collection('loyalty_transactions').createIndex({ user_id: 1, created_at: -1 });
  await db.collection('loyalty_histories').createIndex({ user_id: 1, created_at: -1 });
}
module.exports = { ensureIndexes };

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
}
module.exports = { ensureIndexes };

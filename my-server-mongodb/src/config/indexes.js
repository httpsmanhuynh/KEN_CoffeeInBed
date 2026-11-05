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
    .createIndex(
      { booking_id: 1, type: 1 },
      { unique: true, partialFilterExpression: { booking_id: { $type: 'objectId' } } },
    );
  await db.collection('loyalty_transactions').createIndex({ user_id: 1, created_at: -1 });
  await db.collection('user_vouchers').createIndex({ user_id: 1, redeemed_at: -1 });

  // Payment indexes
  await db
    .collection('payment_transactions')
    .createIndex(
      { gateway_ref: 1 },
      { unique: true, partialFilterExpression: { gateway_ref: { $type: 'string' } } },
    );
  await db.collection('payment_transactions').createIndex({ booking_id: 1, created_at: -1 });

  // Catalog & Booking indexes
  await db.collection('spaces').createIndex({ zone_id: 1, status: 1 });
  await db.collection('packages').createIndex({ zone_id: 1, is_active: 1 });
  await db.collection('package_prices').createIndex({ space_id: 1, package_id: 1 }, { unique: true });
  await db.collection('addons').createIndex({ is_active: 1 });
  await db.collection('products').createIndex({ is_active: 1, category: 1 });
  await db.collection('recipes').createIndex({ item_id: 1 });

  // Review indexes: chặn đánh giá trùng (tối đa 01 đánh giá / Booking — BR-H01)
  await db.collection('reviews').createIndex({ booking_id: 1 }, { unique: true, name: 'uq_reviews_booking' });
  await db.collection('reviews').createIndex({ user_id: 1, created_at: -1 });
}
module.exports = { ensureIndexes };

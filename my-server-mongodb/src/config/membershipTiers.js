'use strict';

const TIERS = Object.freeze([
  { code: 'BASIC', name: 'KÉN Mới', level_order: 1, min_points: 0, discount_rate: 0 },
  { code: 'SILVER', name: 'KÉN Bạc', level_order: 2, min_points: 1000, discount_rate: 0.05 },
  { code: 'GOLD', name: 'KÉN Vàng', level_order: 3, min_points: 5000, discount_rate: 0.1 },
  { code: 'DIAMOND', name: 'KÉN Kim Cương', level_order: 4, min_points: 10000, discount_rate: 0.15 },
]);

async function ensureMembershipTiers(db) {
  const tiers = db.collection('membership_tiers');
  for (const tier of TIERS) {
    const existing = await tiers.findOne({ code: tier.code });
    if (!existing) await tiers.insertOne(tier);
  }
}

module.exports = { ensureMembershipTiers };

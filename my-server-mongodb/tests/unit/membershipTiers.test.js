'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureMembershipTiers } = require('../../src/config/membershipTiers');

function createDb() {
  const tiers = new Map();
  return {
    tiers,
    collection(name) {
      assert.equal(name, 'membership_tiers');
      return {
        async findOne(filter) {
          return tiers.get(filter.code) || null;
        },
        async insertOne(tier) {
          tiers.set(tier.code, tier);
        },
      };
    },
  };
}

test('seeds all membership tiers idempotently without overwriting existing values', async () => {
  const db = createDb();
  db.tiers.set('BASIC', { code: 'BASIC', min_points: 0, discount_rate: 0, name: 'Existing name' });

  await ensureMembershipTiers(db);
  await ensureMembershipTiers(db);

  assert.deepEqual([...db.tiers.keys()], ['BASIC', 'SILVER', 'GOLD', 'DIAMOND']);
  assert.equal(db.tiers.get('BASIC').name, 'Existing name');
  assert.equal(db.tiers.get('SILVER').discount_rate, 0.05);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRfmRows, clusterCustomersByRfm } = require('../../src/domain/customerRfm');

const REFERENCE_DATE = new Date('2026-10-28T00:00:00.000Z');

test('RFM counts unique booking IDs and sums item line totals using the reference date', () => {
  const rows = buildRfmRows([
    { customer_id: 'a', booking_id: 'b1', sale_date: '2026-10-27T00:00:00Z', line_total_vnd: 40000 },
    { customer_id: 'a', booking_id: 'b1', sale_date: '2026-10-27T00:00:00Z', line_total_vnd: 50000 },
    { customer_id: 'a', booking_id: 'b2', sale_date: '2026-10-20T00:00:00Z', line_total_vnd: 30000 },
    { customer_id: 'ignored', order_code: 'b3', sale_date: '2026-10-28T00:00:00Z', line_total_vnd: 90000 },
  ], REFERENCE_DATE);

  assert.deepEqual(rows, [{
    customerId: 'a',
    recency: 1,
    frequency: 2,
    monetary: 120000,
  }]);
});

test('RFM K-means is deterministic and orders three clusters by monetary value', () => {
  const transactions = [];
  const groups = [
    { recency: 2, bookings: 64, amount: 5600000 },
    { recency: 11, bookings: 18, amount: 1600000 },
    { recency: 116, bookings: 10, amount: 835000 },
  ];
  groups.forEach((group, groupIndex) => {
    for (let customer = 0; customer < 10; customer++) {
      for (let booking = 0; booking < group.bookings; booking++) {
        transactions.push({
          customer_id: `g${groupIndex}-c${customer}`,
          booking_id: `g${groupIndex}-c${customer}-b${booking}`,
          sale_date: new Date(REFERENCE_DATE.getTime() - (group.recency + (customer % 2)) * 86400000),
          line_total_vnd: Math.floor(group.amount / group.bookings),
        });
      }
    }
  });

  const first = clusterCustomersByRfm(transactions, { referenceDate: REFERENCE_DATE });
  const second = clusterCustomersByRfm(transactions, { referenceDate: REFERENCE_DATE });

  assert.ok(first.selectedK >= 2 && first.selectedK <= 8);
  assert.deepEqual([...first.assignmentsByCustomer], [...second.assignmentsByCustomer]);
  assert.deepEqual(first.clusters.map((cluster) => cluster.id), first.clusters.map((_cluster, index) => index));
  assert.ok(first.clusters.every((cluster) => cluster.size >= Math.ceil(30 * 0.05)));
  assert.ok(first.clusters.every((cluster, index) =>
    index === 0 || first.clusters[index - 1].meanMonetary >= cluster.meanMonetary));
  assert.equal(first.assignmentsByCustomer.size, 30);
});

test('RFM model does not assign clusters when the customer sample is too small', () => {
  const result = clusterCustomersByRfm([
    { customer_id: 'a', booking_id: 'a1', sale_date: REFERENCE_DATE, line_total_vnd: 10000 },
    { customer_id: 'b', booking_id: 'b1', sale_date: REFERENCE_DATE, line_total_vnd: 20000 },
  ], { referenceDate: REFERENCE_DATE });

  assert.equal(result.selectedK, null);
  assert.equal(result.assignmentsByCustomer.size, 0);
});

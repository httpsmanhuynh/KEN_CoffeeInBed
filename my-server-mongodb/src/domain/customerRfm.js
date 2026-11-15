'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REFERENCE_DATE = new Date('2026-10-28T00:00:00.000Z');

function buildRfmRows(transactions, referenceDate = DEFAULT_REFERENCE_DATE) {
  const customers = new Map();
  for (const tx of transactions || []) {
    if (!tx || tx.customer_id == null || tx.booking_id == null) continue;
    const purchasedAt = new Date(tx.sale_date || tx.created_at);
    const lineTotal = Number(tx.line_total_vnd);
    if (Number.isNaN(purchasedAt.getTime()) || !Number.isFinite(lineTotal) || lineTotal < 0) continue;

    const customerId = String(tx.customer_id);
    let customer = customers.get(customerId);
    if (!customer) {
      customer = { customerId, lastPurchaseAt: purchasedAt, bookingIds: new Set(), monetary: 0 };
      customers.set(customerId, customer);
    }
    if (purchasedAt > customer.lastPurchaseAt) customer.lastPurchaseAt = purchasedAt;
    customer.bookingIds.add(String(tx.booking_id));
    customer.monetary += lineTotal;
  }

  return [...customers.values()]
    .map(({ customerId, lastPurchaseAt, bookingIds, monetary }) => ({
      customerId,
      recency: Math.max(0, Math.floor((referenceDate.getTime() - lastPurchaseAt.getTime()) / DAY_MS)),
      frequency: bookingIds.size,
      monetary,
    }))
    .sort((a, b) => a.customerId.localeCompare(b.customerId));
}

function standardize(rows) {
  const means = [0, 0, 0];
  for (const row of rows) {
    means[0] += row.recency;
    means[1] += row.frequency;
    means[2] += row.monetary;
  }
  for (let i = 0; i < means.length; i++) means[i] /= rows.length;

  const deviations = [0, 0, 0];
  for (const row of rows) {
    const values = [row.recency, row.frequency, row.monetary];
    for (let i = 0; i < values.length; i++) deviations[i] += (values[i] - means[i]) ** 2;
  }
  for (let i = 0; i < deviations.length; i++) deviations[i] = Math.sqrt(deviations[i] / rows.length);

  return rows.map((row) => [row.recency, row.frequency, row.monetary]
    .map((value, i) => deviations[i] === 0 ? 0 : (value - means[i]) / deviations[i]));
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function squaredDistance(a, b) {
  return a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);
}

function initializeCentroids(points, k, random) {
  const centroids = [points[Math.floor(random() * points.length)]];
  while (centroids.length < k) {
    const distances = points.map((point) => Math.min(...centroids.map((center) => squaredDistance(point, center))));
    const total = distances.reduce((sum, distance) => sum + distance, 0);
    if (total === 0) return null;
    let target = random() * total;
    let selected = distances.findIndex((distance) => (target -= distance) < 0);
    if (selected < 0) selected = distances.length - 1;
    centroids.push(points[selected]);
  }
  return centroids.map((point) => [...point]);
}

function fitKmeans(points, k, seed, nInit, maxIterations) {
  let best = null;
  for (let run = 0; run < nInit; run++) {
    const centroids = initializeCentroids(points, k, makeRandom(seed + run));
    if (!centroids) continue;
    let assignments = Array(points.length).fill(-1);
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const next = points.map((point) => {
        let closest = 0;
        let distance = squaredDistance(point, centroids[0]);
        for (let i = 1; i < centroids.length; i++) {
          const candidateDistance = squaredDistance(point, centroids[i]);
          if (candidateDistance < distance) {
            closest = i;
            distance = candidateDistance;
          }
        }
        return closest;
      });
      if (next.every((cluster, i) => cluster === assignments[i])) break;
      assignments = next;

      const sums = Array.from({ length: k }, () => [0, 0, 0]);
      const counts = Array(k).fill(0);
      points.forEach((point, i) => {
        counts[assignments[i]]++;
        point.forEach((value, dimension) => sums[assignments[i]][dimension] += value);
      });
      if (counts.some((count) => count === 0)) break;
      for (let cluster = 0; cluster < k; cluster++) {
        centroids[cluster] = sums[cluster].map((sum) => sum / counts[cluster]);
      }
    }

    const counts = Array(k).fill(0);
    assignments.forEach((cluster) => counts[cluster]++);
    if (counts.some((count) => count === 0)) continue;
    const inertia = points.reduce((sum, point, i) => sum + squaredDistance(point, centroids[assignments[i]]), 0);
    if (!best || inertia < best.inertia) best = { assignments, centroids, counts, inertia };
  }
  return best;
}

function silhouetteScore(points, assignments, clusterCount) {
  const members = Array.from({ length: clusterCount }, () => []);
  assignments.forEach((cluster, i) => members[cluster].push(i));
  if (members.some((group) => group.length === 0)) return -1;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const own = members[assignments[i]];
    if (own.length < 2) continue;
    const ownDistance = own.reduce((sum, j) => sum + Math.sqrt(squaredDistance(points[i], points[j])), 0) / (own.length - 1);
    let nearestOther = Infinity;
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      if (cluster === assignments[i]) continue;
      const group = members[cluster];
      const average = group.reduce((sum, j) => sum + Math.sqrt(squaredDistance(points[i], points[j])), 0) / group.length;
      nearestOther = Math.min(nearestOther, average);
    }
    const denominator = Math.max(ownDistance, nearestOther);
    total += denominator === 0 ? 0 : (nearestOther - ownDistance) / denominator;
  }
  return total / points.length;
}

function clusterCustomersByRfm(transactions, options = {}) {
  const rows = buildRfmRows(transactions, options.referenceDate || DEFAULT_REFERENCE_DATE);
  const assignmentsByCustomer = new Map();
  if (rows.length < 3) {
    return { assignmentsByCustomer, clusters: [], selectedK: null, silhouetteScore: null, rows };
  }

  const points = standardize(rows);
  const minimumClusterSize = Math.ceil(rows.length * (options.minClusterFraction ?? 0.05));
  const minK = options.minK ?? 2;
  const maxK = Math.min(options.maxK ?? 8, rows.length - 1);
  let best = null;

  for (let k = minK; k <= maxK; k++) {
    const candidate = fitKmeans(points, k, options.randomState ?? 42, options.nInit ?? 20, options.maxIterations ?? 20);
    if (!candidate || candidate.counts.some((count) => count < minimumClusterSize)) continue;
    const silhouette = silhouetteScore(points, candidate.assignments, k);
    if (!best || silhouette > best.silhouette) best = { ...candidate, k, silhouette };
  }

  if (!best) return { assignmentsByCustomer, clusters: [], selectedK: null, silhouetteScore: null, rows };

  const clusterOrder = best.centroids
    .map((centroid, cluster) => ({ cluster, monetary: centroid[2] }))
    .sort((a, b) => b.monetary - a.monetary);
  const normalizedId = new Map(clusterOrder.map((item, index) => [item.cluster, index]));
  rows.forEach((row, i) => assignmentsByCustomer.set(row.customerId, normalizedId.get(best.assignments[i])));

  const clusters = clusterOrder.map(({ cluster }, rank) => {
    const members = rows.filter((_row, i) => best.assignments[i] === cluster);
    const mean = (key) => members.reduce((sum, row) => sum + row[key], 0) / members.length;
    return {
      id: rank,
      size: members.length,
      meanRecency: mean('recency'),
      meanFrequency: mean('frequency'),
      meanMonetary: mean('monetary'),
      persona: best.k === 3
        ? ['Khách thân thiết chi mạnh', 'Khách đều đặn', 'Khách ngủ đông (lâu chưa quay lại)'][rank]
        : null,
    };
  });

  return {
    assignmentsByCustomer,
    clusters,
    selectedK: best.k,
    silhouetteScore: best.silhouette,
    rows,
  };
}

module.exports = { buildRfmRows, clusterCustomersByRfm };

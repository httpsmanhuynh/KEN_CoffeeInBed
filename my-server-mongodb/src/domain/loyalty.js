'use strict';
const { POINT_UNIT_VND } = require('../config/constants');

// BR-H04: 4 hạng, sắp xếp tăng dần theo ngưỡng. Nguồn: Report 4.2.4
const TIERS = Object.freeze([
  { code: 'NONE', minPoints: 0, percent: 0 },
  { code: 'SILVER', minPoints: 1000, percent: 5 },
  { code: 'GOLD', minPoints: 5000, percent: 10 },
  { code: 'DIAMOND', minPoints: 10000, percent: 15 },
]);

const tierIndex = (code) => {
  const i = TIERS.findIndex((t) => t.code === code);
  if (i < 0) throw new RangeError(`unknown tier ${code}`);
  return i;
};
const tierByCode = (code) => TIERS[tierIndex(code)];

function tierForPoints(points) {
  let best = TIERS[0];
  for (const t of TIERS) if (points >= t.minPoints) best = t;
  return best;
}

// BR-H03: 10.000đ thực trả = 1 Điểm + 1 Coin
function earnFromAmount(finalAmount) {
  if (!Number.isInteger(finalAmount) || finalAmount < 0) throw new RangeError('finalAmount must be non-negative integer');
  const n = Math.floor(finalAmount / POINT_UNIT_VND);
  return { points: n, coins: n };
}

// Cộng sau CHECKED_OUT. Chỉ lên hạng, không hạ giữa năm (BR-H04).
function applyEarn(account, finalAmount) {
  const { points, coins } = earnFromAmount(finalAmount);
  const tierPoints = account.tierPoints + points;
  const candidate = tierForPoints(tierPoints);
  const tier = tierIndex(candidate.code) > tierIndex(account.tier) ? candidate.code : account.tier;
  return { tier, tierPoints, coins: account.coins + coins, earned: { points, coins } };
}

// Qua năm: hạ đúng 1 bậc, tierPoints = ngưỡng hạng mới; NONE giữ nguyên điểm; Coins về 0 (BR-H03, H04, H05)
function yearRollover(account) {
  const i = tierIndex(account.tier);
  const next = i === 0 ? TIERS[0] : TIERS[i - 1];
  return {
    tier: next.code,
    tierPoints: i === 0 ? account.tierPoints : next.minPoints,
    coins: 0,
    coinsExpired: account.coins, // ghi lịch sử EXPIRE nếu > 0 (BR-H05)
  };
}

// BR-H06: chỉ trừ Coins, không đụng Điểm/hạng
function redeemCoins(account, cost) {
  if (!Number.isInteger(cost) || cost <= 0) throw new RangeError('cost must be positive integer');
  if (account.coins < cost) return { ok: false, reason: 'INSUFFICIENT_COINS' };
  return { ok: true, coins: account.coins - cost };
}

module.exports = { TIERS, tierByCode, tierForPoints, earnFromAmount, applyEarn, yearRollover, redeemCoins };

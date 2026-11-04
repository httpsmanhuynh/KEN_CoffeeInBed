# Workflow: Loyalty — Hạng thành viên, Điểm & Coins

> Khi nhận issue liên quan đến điểm thưởng, hạng thành viên, coins, lịch sử giao dịch → đọc file này.

---

## 📂 Files liên quan

| File | Vai trò |
|------|---------|
| `my-server-mongodb/src/domain/loyalty.js` | **Business logic thuần** — không có DB, chỉ pure functions |
| `my-server-mongodb/src/routes/loyalty.js` | HTTP endpoints — kết nối domain với MongoDB |
| `my-server-mongodb/src/config/constants.js` | Hằng số `POINT_UNIT_VND = 10000` |
| `my-server-mongodb/src/config/indexes.js` | Index MongoDB cho loyalty_transactions, loyalty_histories |
| `my-server-mongodb/test/loyalty.test.js` | 29 test cases domain + integration |
| `my-server-mongodb/src/middleware/auth.js` | `requireAuth`, `requireRole` dùng trong route |
| `my-server-mongodb/src/utils/http.js` | `wrap()`, `fail()` dùng trong route |

---

## 🗄️ Collections MongoDB

| Collection | Mô tả |
|------------|-------|
| `users` | Lưu `tier_id`, `tier_points`, `coin_balance` |
| `membership_tiers` | 4 hạng: BASIC / SILVER / GOLD / DIAMOND |
| `loyalty_transactions` | Từng giao dịch: EARN / REDEEM / EXPIRE |
| `loyalty_histories` | Snapshot trước/sau mỗi thay đổi hạng/điểm/coins |
| `bookings` | Nguồn trigger EARN — cần `status = CHECKED_OUT` và `final_amount` |

---

## 🔧 Functions / Classes quan trọng

### `src/domain/loyalty.js` (pure functions)

| Function | Mô tả |
|----------|-------|
| `earnFromAmount(finalAmount)` | Tính số điểm + coins từ số tiền (10.000đ = 1 điểm + 1 coin) |
| `applyEarn(account, finalAmount)` | Cộng điểm vào account, lên hạng nếu đạt ngưỡng (không hạ giữa năm) |
| `yearRollover(account)` | Cuối năm: hạ 1 hạng, coins về 0, BASIC giữ điểm |
| `redeemCoins(account, cost)` | Trừ coins, không đụng điểm/hạng |
| `tierForPoints(points)` | Tra hạng theo điểm tích lũy |
| `TIERS` | Array 4 hạng: `[{code, minPoints, percent}]` |

### `src/routes/loyalty.js` (HTTP endpoints)

| Route | Method | Auth | Mô tả |
|-------|--------|------|-------|
| `/api/loyalty/tiers` | GET | Public | Bảng hạng thành viên |
| `/api/loyalty/earn` | POST | requireAuth | Cộng điểm khi checkout |
| `/api/loyalty/redeem` | POST | requireAuth | Đổi coins |
| `/api/loyalty/history` | GET | requireAuth | Lịch sử giao dịch (paginated) |
| `/api/loyalty/year-rollover` | POST | requireRole('ADMIN') | Rollover cuối năm |

---

## 🔄 Luồng xử lý chính

### EARN (Cộng điểm khi checkout)
```
POST /api/loyalty/earn { bookingId }
  → validate bookingId (ObjectId.isValid)
  → findOne bookings { _id: bookingId } → kiểm tra status === 'CHECKED_OUT'
  → findOne loyalty_transactions { booking_id, type: 'EARN' } → 409 nếu đã có (idempotent)
  → findOne users { _id: booking.user_id }
  → findOne membership_tiers { _id: user.tier_id } → lấy currentTierCode
  → applyEarn(account, booking.final_amount) → result
  → findOne membership_tiers { code: result.tier } → newTierDoc
  → insertOne loyalty_transactions (type: EARN)
  → insertOne loyalty_histories
  → updateOne users { tier_id, tier_points, coin_balance }
  → res.json(result)
```

### YEAR ROLLOVER (Cuối năm)
```
POST /api/loyalty/year-rollover  [ADMIN only]
  → find users { role: 'CUSTOMER' }
  → for each user:
      yearRollover(account) → result
      if coinsExpired > 0 → insertOne loyalty_transactions (type: EXPIRE)
      insertOne loyalty_histories (action: YEAR_ROLLOVER)
      updateOne users
  → res.json({ processed })
```

---

## 🔍 Search keywords khi debug

- **Điểm không cộng**: tìm `ALREADY_EARNED`, `idempotent`, `loyalty_transactions.findOne`
- **Hạng không lên**: tìm `applyEarn`, `tierForPoints`, `tierIndex`
- **Coins không trừ**: tìm `redeemCoins`, `INSUFFICIENT_COINS`
- **Rollover sai**: tìm `yearRollover`, `coinsExpired`, `YEAR_ROLLOVER`
- **Index lỗi**: tìm `ensureIndexes`, `partialFilterExpression`, `booking_id`

---

## ✅ Business Rules đã implement

| BR | Nội dung | Nơi implement |
|----|----------|---------------|
| BR-H03 | 10.000đ = 1 Điểm + 1 Coin | `earnFromAmount()` |
| BR-H04 | Mốc 1.000/5.000/10.000 điểm, lên hạng ngay checkout, không hạ giữa năm | `applyEarn()`, `TIERS` |
| BR-H04 | Cuối năm hạ 1 hạng | `yearRollover()` |
| BR-H05 | Cuối năm Coins về 0 | `yearRollover()` → `coinsExpired` |
| BR-H06 | Đổi Coins không ảnh hưởng Điểm/hạng | `redeemCoins()` |
| — | Chống cộng điểm 2 lần | `findOne` trước insert + unique index |

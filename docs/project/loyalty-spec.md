# Tech Spec: Loyalty — Hạng thành viên, Điểm & Coins

---

## 📌 Tóm tắt business rules

| BR | Nội dung |
|----|----------|
| BR-H03 | 10.000đ thực trả = 1 Điểm + 1 Coin |
| BR-H04 | 4 hạng: BASIC (0đ) / SILVER (1.000đ) / GOLD (5.000đ) / DIAMOND (10.000đ) |
| BR-H04 | Lên hạng ngay khi checkout, không hạ hạng giữa năm |
| BR-H04 | Cuối năm: hạ đúng 1 bậc |
| BR-H05 | Cuối năm: Coins về 0 (expire) |
| BR-H06 | Đổi Coins chỉ trừ Coins, không ảnh hưởng Điểm/Hạng |

---

## 🏗️ Kiến trúc module

```
Domain (pure, no DB)              Route (HTTP + DB)
─────────────────────             ──────────────────────────────
loyalty.js                        routes/loyalty.js
  ├── TIERS[]                       ├── GET  /tiers
  ├── earnFromAmount(amount)         ├── POST /earn       → applyEarn
  ├── applyEarn(account, amount)     ├── POST /redeem     → redeemCoins
  ├── yearRollover(account)          ├── GET  /history
  ├── redeemCoins(account, cost)     └── POST /year-rollover → yearRollover
  └── tierForPoints(points)
```

---

## 📊 Bảng hạng

| Hạng | Ngưỡng điểm | Giảm giá |
|------|-------------|----------|
| BASIC | 0 | 0% |
| SILVER | 1.000 | 5% |
| GOLD | 5.000 | 10% |
| DIAMOND | 10.000 | 15% |

---

## 🔄 State diagram: Hạng thành viên

```
       checkout (tích đủ điểm)
BASIC ──────────────────────► SILVER ──► GOLD ──► DIAMOND
  ▲                              │          │          │
  │          year rollover       │          │          │
  └──────────────────────────────┘          │          │
  ▲                                         │          │
  └─────────────────────────────────────────┘          │
  ▲                                                     │
  └─────────────────────────────────────────────────────┘

Ghi chú:
- Lên hạng: ngay khi checkout đủ điểm
- Xuống hạng: CHỈ cuối năm, hạ đúng 1 bậc
- BASIC: cuối năm giữ nguyên hạng và điểm
```

---

## 🗄️ DB Collections

### `loyalty_transactions`

Ghi lại từng giao dịch:

```js
{
  _id: ObjectId,
  user_id: ObjectId,
  booking_id: ObjectId,       // chỉ khi type = EARN
  type: 'EARN'|'REDEEM'|'EXPIRE',
  points: Number,             // 0 nếu REDEEM/EXPIRE
  coins: Number,              // âm nếu REDEEM/EXPIRE
  amount: Number,             // số tiền gốc — chỉ EARN
  description: String,
  created_at: Date,
}
```

**Indexes:**
```js
// Unique: chống cộng điểm 2 lần cho 1 đơn
{ booking_id: 1, type: 1 } unique, partial (booking_id exists)

// Query lịch sử user
{ user_id: 1, created_at: -1 }
```

### `loyalty_histories`

Audit trail — snapshot trước/sau mỗi thay đổi:

```js
{
  _id: ObjectId,
  user_id: ObjectId,
  booking_id: ObjectId,       // optional
  action: 'EARN'|'REDEEM'|'YEAR_ROLLOVER',
  points_before: Number,
  points_after: Number,
  coins_before: Number,
  coins_after: Number,
  tier_before: String,        // 'BASIC'|'SILVER'|'GOLD'|'DIAMOND'
  tier_after: String,
  tier_changed: Boolean,
  created_at: Date,
}
```

**Index:** `{ user_id: 1, created_at: -1 }`

---

## ⚡ Idempotency

**Vấn đề**: Nếu `/earn` được gọi 2 lần cho cùng 1 booking (network retry, bug), user sẽ bị cộng điểm 2 lần.

**Giải pháp (defense in depth)**:
1. **Application check**: `findOne(loyalty_transactions, {booking_id, type: 'EARN'})` → 409 nếu tồn tại.
2. **DB unique index**: `{booking_id, type}` unique → reject ở DB nếu pass được app check (race condition).

---

## ⚠️ Known Limitations & TODO

| Item | Mô tả | Priority |
|------|-------|----------|
| Race condition `/earn` | Hai request đồng thời có thể vượt app check | Medium — cần catch `code 11000` từ insertOne |
| `year-rollover` không atomic | Crash giữa chừng → partial update | Medium — thêm `last_rollover_year` vào users |
| Không có cron job | Rollover phải gọi thủ công qua API | Low — cân nhắc node-cron |
| `/earn` chưa kiểm tra user ownership | Bất kỳ user đăng nhập nào cũng có thể earn cho booking của người khác | High — cần check `booking.user_id === session.user.id` hoặc require ADMIN |

---

## 🧪 Test coverage

| Test file | Tests | Pass |
|-----------|-------|------|
| `test/loyalty.test.js` | 29 | 29 ✅ |
| `test/domain.test.js` | 7 (loyalty portion: 3) | 7 ✅ |

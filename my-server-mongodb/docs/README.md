# 📚 KÉN — Coffee In Bed (`my-server-mongodb` — Nhánh `Tman`)

Tài liệu tổng hợp toàn bộ kiến trúc, quy trình nghiệp vụ, danh sách API và bộ kiểm thử hiện tại của Backend trên nhánh **`Tman`** (tuân thủ chặt chẽ `Report.docx` và `database/schemas/*.validator.json`).

---

## 1. Cấu trúc thư mục `my-server-mongodb`

```text
my-server-mongodb/
├── index.js                         # Entry point Express 5 + MongoDB + Session + Cronjob 1 phút (UC-36)
├── docs/
│   ├── README.md                    # Tổng quan kiến trúc, API & 13 Module (file này)
│   ├── workflow/
│   │   ├── booking-5-steps.md       # Quy trình Đặt không gian 5 bước (BR-D01), Vận hành & Chống đặt trùng
│   │   ├── catalog-payment-loyalty.md # Quy trình Catalog CRUD, Voucher, Payment Idempotent & Loyalty
│   │   └── review-management.md     # Quy trình Quản lý Đánh giá sau sử dụng (UC-16, BR-H01, FR-4.3)
│   ├── memory/
│   │   ├── decisions.md             # Các quyết định kiến trúc đã chốt (Auth, Booking, Concurrency, Validator)
│   │   └── open-questions.md        # Các câu hỏi mở / hạng mục tiếp theo
│   ├── principle/
│   │   └── lessons.md               # Quy tắc cốt lõi (Rate limit, Session BR-A05, Express 5, Schema Atlas)
│   └── project/
│       └── changes.md               # Lịch sử thay đổi cấu hình, env, scripts & files
├── src/
│   ├── config/
│   │   ├── constants.js             # Hằng số nghiệp vụ (HOLD=15p, BUFFER=15p, CUTOFF=120p, REVIEW_RATING=1..5...)
│   │   └── indexes.js               # ensureIndexes() cho users, otp_codes, loyalty, payment, catalog, reviews
│   ├── domain/                      # Pure business logic (không phụ thuộc DB)
│   │   ├── availability.js          # Kiểm tra chỗ trống EXCLUSIVE (kèm buffer 15p) & SHARED (theo capacity)
│   │   ├── bookingStateMachine.js   # Vòng đời 7 trạng thái đơn & kiểm tra điều kiện chuyển trạng thái
│   │   ├── loyalty.js               # Tính Điểm/Coins (10.000đ = 1 Điểm + 1 Coin), nâng hạng, rollover đầu năm
│   │   ├── payment.js               # Kiểm tra điều kiện thanh toán (BR-E01/E02/E03)
│   │   ├── pricing.js               # Tính giá tự động: Package + Inclusion + Add-on - Voucher - Hạng (BR-B03)
│   │   └── review.js                # Kiểm tra dữ liệu đánh giá, điều kiện chính chủ & CHECKED_OUT, cờ nhắc đánh giá
│   ├── middleware/
│   │   ├── auth.js                  # requireAuth (đọc lại DB thu hồi session BR-A05), requireRole, startSession
│   │   └── rateLimit.js             # Bộ giới hạn tần suất theo IP / SĐT / User ID (BR-A08)
│   ├── services/
│   │   ├── bookingService.js        # Dịch vụ Đặt chỗ 5 bước, Transaction + lock_version, Check-in/out, Cron
│   │   ├── otp.js                   # Phát hành & xác thực OTP băm HMAC-SHA256 (chống race condition)
│   │   └── reviewService.js         # Dịch vụ Tạo/Xem đánh giá trong Transaction, chống trùng & gắn lời nhắc đánh giá
│   ├── routes/
│   │   ├── auth.js                  # Đăng ký, OTP, Đăng nhập, 2FA, Quên/Đổi MK, Đăng xuất (/api & /api/auth)
│   │   ├── profile.js               # Xem/Sửa hồ sơ, Đổi MK, Đổi SĐT, Bật/Tắt 2FA (/api/profile)
│   │   ├── catalog.js               # Khám phá chỗ trống (UC-04/05) & Admin CRUD Catalog (/api & /api/catalog)
│   │   ├── bookings.js              # Quy trình Booking 5 bước, Vận hành đơn & Lịch sử kèm lời nhắc đánh giá (/api/bookings)
│   │   ├── payments.js              # Giao dịch thanh toán Idempotent & lịch sử (/api/payments)
│   │   ├── loyalty.js               # Hạng thành viên, Cộng điểm, Đổi Coins/Voucher, Rollover (/api/loyalty)
│   │   └── reviews.js               # Tạo & Xem đánh giá, kiểm tra điều kiện & lời nhắc đánh giá (/api/reviews)
│   └── utils/
│       └── http.js                  # Helper wrap, fail, str, publicUser, tierOf
└── tests/
    ├── helpers/
    │   └── mockDb.js                    # In-Memory MongoDB Mock hỗ trợ Transaction & WriteConflict
    ├── unit/
    │   ├── auth.test.js                 # 21 test cases OTP & Session (TC-OTP-01..17, TC-MW-06..09)
    │   ├── availability.test.js         # Kiểm tra chỗ trống EXCLUSIVE + buffer & SHARED (TC-AVAIL-01)
    │   ├── bookingStateMachine.test.js  # Vòng đời 7 trạng thái đơn (TC-BSM-01)
    │   ├── loyalty.test.js              # 20 test cases Loyalty Management đồng bộ Excel (TC-LOY-01..20)
    │   ├── pricing.test.js              # 5 test cases Pricing & Catalog (TC-PRC-01..05)
    │   └── system.test.js               # 18 test cases System Config (TC-SYS-01..29)
    ├── integration/
    │   ├── auth.api.test.js             # 12 test cases middleware xác thực & thu hồi session (bao gồm 9 TC-MW-01..09 trên Excel)
    │   ├── booking.api.test.js          # 7 kịch bản tích hợp Booking & Concurrency (TC-BK-02..08)
    │   ├── payment.api.test.js          # 15 test cases Payment domain, Idempotency & RBAC (TC-PAY-01..15)
    │   ├── review.api.test.js           # 18 test cases Review Management đồng bộ Excel (TC-REV-01..18)
    │   └── voucher.api.test.js          # 28 test cases Voucher Management đồng bộ Excel (TC-VCH-01..28)
    └── e2e/
        └── customer-flow.test.js        # Quy trình chuẩn 5 bước End-to-End (TC-BK-01)
```

---

## 2. Tình trạng 13 Module hiện tại trên nhánh `Tman`

| STT | Module | Trạng thái | File thực thi chính |
| :-: | :--- | :---: | :--- |
| **1** | **Authentication & Authorization** | ✅ **100%** | `src/routes/auth.js`, `src/routes/profile.js`, `src/middleware/auth.js`, `src/services/otp.js` |
| **2** | **Space & Zone Management** | ✅ **100%** | `src/routes/catalog.js`, `src/services/bookingService.js` |
| **3** | **Package & Inclusion Management** | ✅ **100%** | `src/routes/catalog.js`, `src/services/bookingService.js` |
| **4** | **Add-on & Product Management** | ✅ **100%** | `src/routes/catalog.js` |
| **5** | **Booking Management** | ✅ **100%** | `src/services/bookingService.js`, `src/routes/bookings.js`, `src/domain/availability.js`, `src/domain/bookingStateMachine.js` |
| **6** | **Pricing Management** | ✅ **100%** | `src/domain/pricing.js`, `src/services/bookingService.js` |
| **7** | **Payment Management** | ✅ **100%** | `src/services/bookingService.js`, `src/routes/bookings.js`, `src/domain/payment.js`, `src/routes/payments.js` |
| **8** | **Voucher Management** | ✅ **100%** | `src/routes/catalog.js`, `src/routes/loyalty.js`, `src/services/bookingService.js` |
| **9** | **Loyalty Management** | ✅ **100%** | `src/domain/loyalty.js`, `src/routes/loyalty.js`, `src/services/bookingService.js` |
| **10** | **Review Management** | ✅ **100%** | `src/domain/review.js`, `src/services/reviewService.js`, `src/routes/reviews.js`, `src/routes/bookings.js` |
| **11** | **Admin Management & Dashboard** | 🟡 **Một phần** | Đã có Admin xem/lọc danh sách Booking (`GET /api/bookings`); chưa có Khóa/Mở khóa User & Thống kê Dashboard |
| **12** | **Recommendation & Forecast API** | ⏳ **Chưa làm** | *(Dự kiến: đọc `demand_forecasts`, `inventory_alerts`, `sales_history_daily`, `sales_transactions`)* |
| **13** | **System Configuration** | ✅ **100%** | `index.js`, `src/config/constants.js`, `src/config/indexes.js`, `src/middleware/rateLimit.js`, `src/utils/http.js` |

---

## 3. Tổng hợp toàn bộ API Endpoints hiện có

### 3.1. Xác thực & Hồ sơ (`/api`, `/api/auth`, `/api/profile`)
| Method | Endpoint | Phân quyền | Mô tả |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/register` | Guest | Đăng ký tài khoản bước 1 (kiểm tra trùng SĐT/Email, gửi OTP `REGISTER`) |
| `POST` | `/api/verify-otp` | Guest | Xác thực OTP đăng ký → Tạo user hạng `BASIC` và đăng nhập |
| `POST` | `/api/login` | Guest | Đăng nhập bằng SĐT/Email + mật khẩu (trả `requires2FA: true` nếu bật 2FA, khôi phục `pendingBooking` nếu có) |
| `POST` | `/api/login/2fa` | Guest | Xác thực OTP bước 2 khi đăng nhập 2FA |
| `POST` | `/api/logout` | Auth | Hủy session trong MongoDB và xóa cookie `connect.sid` |
| `POST` | `/api/forgot-password` | Guest | Yêu cầu mã OTP khôi phục mật khẩu (`FORGOT_PASSWORD`) |
| `POST` | `/api/reset-password` | Guest | Đặt lại mật khẩu bằng OTP và thu hồi mọi phiên cũ (`password_changed_at`) |
| `GET` | `/api/me` | Auth | Lấy thông tin người dùng hiện tại kèm hạng thành viên |
| `PATCH` | `/api/profile/me` | Auth | Cập nhật họ tên, ngày sinh, email |
| `POST` | `/api/profile/me/otp` | Auth | Yêu cầu gửi OTP cho thao tác nhạy cảm (`CHANGE_PASSWORD`, `CHANGE_PHONE`, `TOGGLE_2FA`) |
| `POST` | `/api/profile/me/password` | Auth | Đổi mật khẩu (yêu cầu mật khẩu cũ + OTP) |
| `POST` | `/api/profile/me/phone` | Auth | Đổi số điện thoại (yêu cầu OTP gửi tới SĐT mới) |
| `POST` | `/api/profile/me/2fa` | Auth | Bật/Tắt xác thực 2 yếu tố (yêu cầu OTP) |

### 3.2. Danh mục, Khám phá chỗ trống & Admin Catalog CRUD (`/api` & `/api/catalog`)
| Method | Endpoint | Phân quyền | Mô tả |
| :---: | :--- | :---: | :--- |
| `GET` | `/api/zones` | Public | Danh sách khu vực (`?bookable=true` lọc khu đặt chỗ) |
| `POST / PATCH / DELETE` | `/api/zones`, `/api/zones/:id` | Admin | Thêm mới, cập nhật, ẩn khu vực (`is_active: false`) |
| `GET` | `/api/spaces` | Public | **Bước 1 (`UC-04`):** Truyền `?startAt=...&guestCount=...` để khám phá chỗ trống kèm gói và giá; hoặc lọc danh sách không gian |
| `GET` | `/api/spaces/:id` | Public | Chi tiết Space (theo `_id` hoặc `space_code`) kèm Zone, Packages, giá và Inclusions |
| `POST / PATCH / DELETE` | `/api/spaces`, `/api/spaces/:id` | Admin | Thêm mới, cập nhật thông tin/sức chứa, đổi trạng thái (`ACTIVE`/`MAINTENANCE`/`INACTIVE`) |
| `GET / POST / PATCH / DELETE` | `/api/packages`, `/api/packages/:id` | Public / Admin | Xem danh sách/chi tiết gói dịch vụ; Admin thêm/sửa/ẩn gói (`FIXED`/`HOURLY`, `PER_SPACE`/`PER_PERSON`) |
| `GET / POST / PATCH / DELETE` | `/api/pricing`, `/api/pricing/:id` | Public / Admin | Bảng giá gói theo từng không gian (`package_prices`) |
| `GET / POST` | `/api/package-inclusions` | Public / Admin | Xem và cấu hình quyền lợi đi kèm gói (`STANDARD_DRINK` hỗ trợ 50.000đ, `PASTRY`, `WATER`, `EQUIPMENT`) |
| `GET / POST / PATCH / DELETE` | `/api/products`, `/api/products/:id` | Public / Admin | Menu 13 món F&B (`DRINK`, `PASTRY`, `SNACK`) và Admin CRUD |
| `GET / POST / PATCH / DELETE` | `/api/addons`, `/api/addons/:id` | Public / Admin | Dịch vụ mua thêm (`PER_ITEM`, `PER_BOOKING`) và Admin CRUD |
| `GET / POST / PATCH` | `/api/vouchers`, `/api/vouchers/:id` | Public / Admin | Danh sách Voucher đang hoạt động; Admin tạo/cập nhật/bật tắt Voucher |
| `GET` | `/api/recipes` | Public / Admin | Xem công thức định lượng nguyên vật liệu (`recipes`) |
| `POST` | `/api/availability` | Public | Kiểm tra chỗ trống chế độ Read-only (`BR-C07`) cho Bước 1 (`UC-04`) hoặc Bước 2 (`UC-05`) |

### 3.3. Quy trình Đặt không gian 5 bước & Vận hành (`/api/bookings`)
| Method | Endpoint | Phân quyền | Mô tả |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/bookings/select-package` | Guest / Auth | **Bước 2 (`UC-05`, `BR-A03`):** Chọn Space + Package. Nếu chưa đăng nhập → lưu `req.session.pendingBooking` và trả `401 AUTH_GUARD_REQUIRED`; nếu đã đăng nhập → kiểm tra chỗ trống và lưu ngữ cảnh chọn gói |
| `POST` | `/api/bookings/quote` | Auth | **Bước 3 & 4 (`UC-06`, `UC-07`):** Báo giá tạm tính tự động tại Backend (Package + Phụ phí Inclusion vượt 50k + Add-on − Voucher − % Hạng) |
| `POST` | `/api/bookings` | Auth | **Bước 4 (`UC-08`):** Xác nhận Checkout → Khóa `spaces.lock_version` trong ACID Transaction, tạo đơn `PENDING_PAYMENT` giữ chỗ 15 phút (hoặc `CONFIRMED` ngay nếu `final_amount = 0`) |
| `POST` | `/api/bookings/:id/pay` | Auth | **Bước 5 (`UC-09`, `UC-10`):** Mô phỏng thanh toán (`SUCCESS` / `FAILED`). Nếu thành công → chuyển `CONFIRMED`, ghi `payment_transactions` và gửi SMS xác nhận |
| `GET` | `/api/bookings/me` | Auth | Danh sách lịch sử đặt chỗ của khách hàng đang đăng nhập kèm cờ nhắc đánh giá (`review_reminder`, `can_review`, `has_review`, `review`) |
| `GET` | `/api/bookings` | Admin | Danh sách toàn bộ đơn đặt chỗ (lọc theo `status`, `spaceId`, `userId`) |
| `GET` | `/api/bookings/:id` | Auth / Admin | Chi tiết đơn đặt chỗ kèm `inclusions`, `addons`, `transactions`, `review` và cờ nhắc đánh giá |
| `GET` | `/api/bookings/:id/review` | Auth | Kiểm tra điều kiện đánh giá & xem đánh giá của đơn đặt chỗ (`UC-16`) |
| `POST` | `/api/bookings/:id/review` | Auth | Gửi đánh giá cho đơn đặt chỗ chính chủ đã `CHECKED_OUT` (`BR-H01`) |
| `POST` | `/api/bookings/:id/cancel` | Auth | **Hủy đơn (`UC-11`, `UC-12`, `UC-14`):** Hủy đơn `PENDING_PAYMENT` (còn hạn) hoặc hủy đơn `CONFIRMED` trước Cut-off Time (120 phút), hoàn lượt Voucher và hoàn tiền |
| `POST` | `/api/bookings/:id/reschedule` | Auth | **Đổi lịch (`UC-13`, `UC-15`):** Đổi giờ bắt đầu của đơn `CONFIRMED` trước Cut-off Time (cùng gói & thời lượng, kiểm tra chống trùng trong Transaction) |
| `POST` | `/api/bookings/:id/check-in` | Admin | **Check-in (`UC-25`, `BR-F01`):** Chuyển `CONFIRMED → CHECKED_IN` trong cửa sổ `[start_at - 15p, start_at + 30p]` |
| `POST` | `/api/bookings/:id/check-out` | Admin | **Check-out (`UC-26`, `BR-H03`):** Chuyển `CHECKED_IN → CHECKED_OUT`, tự động cộng KÉN Điểm & Coins và xét nâng hạng trong cùng Transaction |
| `POST` | `/api/bookings/:id/no-show` | Admin | **No-show (`UC-27`, `BR-F02`):** Đánh dấu `CONFIRMED → NO_SHOW` khi quá `start_at + 30p` |
| `POST` | `/api/bookings/:id/refund-reconcile` | Admin | **Đối soát hoàn tiền (`UC-28`):** Xử lý thủ công các đơn hủy có `refund_status = FAILED` sang `MANUALLY_RESOLVED` |
| `POST` | `/api/bookings/expire-holds` | Admin | **Cronjob thu hồi giữ chỗ (`UC-36`, `BR-E03`):** Quét và chuyển các đơn `PENDING_PAYMENT` quá hạn 15 phút sang `EXPIRED`, hoàn trả lượt Voucher |

### 3.4. Thanh toán Idempotent & Loyalty (`/api/payments`, `/api/loyalty`)
| Method | Endpoint | Phân quyền | Mô tả |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/payments` | Auth | Tạo giao dịch thanh toán Idempotent theo `idempotencyKey` (`gateway_ref`) |
| `POST` | `/api/payments/:id/cancel` | Auth | Hủy giao dịch thanh toán đang ở trạng thái `PENDING` |
| `GET` | `/api/payments/booking/:bookingId` | Auth / Admin | Lịch sử giao dịch thanh toán của một đơn đặt chỗ |
| `GET` | `/api/payments` | Admin | Danh sách giao dịch thanh toán toàn hệ thống (phân trang) |
| `GET` | `/api/loyalty/tiers` | Public | Bảng 4 hạng thành viên (`BASIC` 0%, `SILVER` 5%, `GOLD` 10%, `DIAMOND` 15%) |
| `POST` | `/api/loyalty/earn` | Auth | Ghi nhận điểm & Coins cho đơn `CHECKED_OUT` (idempotent theo `booking_id`) |
| `POST` | `/api/loyalty/redeem` | Auth | Đổi KÉN Coins lấy Voucher vào ví `user_vouchers` (hoặc trừ Coins trực tiếp), không ảnh hưởng Điểm/Hạng (`BR-H06`) |
| `GET` | `/api/loyalty/my-vouchers` | Auth | Xem ví Voucher đã đổi bằng Coins của khách hàng (`user_vouchers`) |
| `GET` | `/api/loyalty/history` | Auth | Xem lịch sử biến động Điểm & Coins (`loyalty_transactions`) |
| `POST` | `/api/loyalty/year-rollover` | Admin | Rollover đầu năm (`UC-37`, `BR-H04`, `BR-H05`): hạ 1 bậc hạng, đặt lại điểm tối thiểu của hạng mới và đưa Coins về 0 |

### 3.5. Quản lý Đánh giá sau sử dụng (`/api/reviews`, `/api/spaces/:id/reviews`)
| Method | Endpoint | Phân quyền | Mô tả |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/reviews` | Auth | **Tạo đánh giá (`UC-16`, `BR-H01`, `FR-4.3`):** Kiểm tra đơn chính chủ đã `CHECKED_OUT` trong Transaction, chặn đánh giá trùng (tối đa 01 đánh giá/Booking), lưu `rating` (1..5) & `comment` ($\le 500$ ký tự) |
| `GET` | `/api/reviews/booking/:bookingId` | Auth | Kiểm tra điều kiện đánh giá (`canReview`, `reviewReminder`) và xem đánh giá của 01 Booking (chế độ chỉ xem nếu đã đánh giá — `AF2`) |
| `GET` | `/api/reviews/me` | Auth | Xem danh sách đánh giá khách hàng đã gửi kèm danh sách các đơn `CHECKED_OUT` đang chờ đánh giá (`pendingReminders`) |
| `GET` | `/api/reviews/space/:spaceId` | Public | Xem danh sách đánh giá của Không gian (theo `_id` hoặc `space_code`) kèm `averageRating`, `totalReviews` và phân bố 1..5 sao |
| `GET` | `/api/spaces/:id/reviews` | Public | Alias xem đánh giá theo Không gian trong nhóm Catalog |
| `GET` | `/api/reviews` | Public | Danh sách đánh giá có bộ lọc (`spaceId`, `bookingId`, `userId`, `rating`) |

---

## 4. Hướng dẫn chạy kiểm thử (109 Tests — 100% Pass)

```powershell
cd d:\hk7\PTWKDNC\KEN\my-server-mongodb
# Chạy toàn bộ 109 test cases
npm test

# Chạy kèm báo cáo độ phủ dòng lệnh (Line / Branch / Function Coverage)
node --test --experimental-test-coverage
```

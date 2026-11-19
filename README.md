# KÉN — Coffee In Bed (Workspace & Cafe Booking Platform)

Nền tảng đặt không gian làm việc, học tập và thưởng thức cà phê **KÉN — Coffee In Bed**, hỗ trợ quy trình đặt chỗ 5 bước theo thời gian thực, thanh toán idempotent, chương trình khách hàng thân thiết (KÉN Điểm & KÉN Coins), hệ thống quản trị vận hành và pipeline Học máy (Machine Learning) phục vụ gợi ý món và dự báo nguyên vật liệu.

- **Live Demo (Vercel):** https://ken-coffee-in-bed-five.vercel.app/
- **Backend API (Render):** https://ken-coffeeinbed.onrender.com

---

## 1. Giới thiệu dự án

**KÉN — Coffee In Bed** kết hợp mô hình quán cà phê và không gian làm việc/học tập chia thành nhiều phân khu (như Kết nối, Khu làm việc chung, Ô tập trung cá nhân Focus Pod, Phòng họp nhỏ). Hệ thống đáp ứng trọn vẹn hai nhóm người dùng:

- **Khách hàng (Customer):** Khám phá không gian theo khu vực/chỗ trống thực tế, đặt chỗ theo quy trình 5 bước, tùy chọn quyền lợi đi kèm gói (Inclusion) và dịch vụ/món mua thêm (Add-on), áp dụng Voucher & ưu đãi hạng thành viên, thanh toán giữ chỗ, đổi lịch/hủy đơn, tích KÉN Điểm & KÉN Coins, đổi quà và gửi đánh giá sau khi trả phòng.
- **Quản trị viên (Admin):** Quản lý danh mục không gian, gói dịch vụ, bảng giá, quyền lợi, sản phẩm F&B, add-on, voucher; vận hành Check-in / Check-out / No-show / đối soát hoàn tiền; quản lý tài khoản khách hàng (khóa/mở khóa); theo dõi Dashboard thống kê doanh thu thực thu, tỷ lệ lấp đầy (Occupancy Rate) và cảnh báo tồn kho nguyên vật liệu từ mô hình dự báo ML.

---

## 2. Kiến trúc & Công nghệ sử dụng

Hệ thống được tổ chức theo kiến trúc Monorepo gồm 4 thành phần chính:

| Thành phần | Thư mục | Công nghệ chính |
| :--- | :--- | :--- |
| **Frontend** | `my-app/` | Angular 22 (`@angular/core`, `@angular/router`, `@angular/forms` `^22.1.0`), TypeScript (`~6.0.2`), RxJS (`~7.8.0`), GSAP (`^3.15.1`), Lenis (`^1.3.27`), Lucide Angular (`lucide-angular`, `@lucide/angular`), Vitest (`^4.0.8`) |
| **Backend API** | `my-server-mongodb/` | Node.js, Express 5 (`^5.3.0`), MongoDB Native Driver (`^7.7.0`, database `ken_space_booking`), `express-session` + `connect-mongo`, `bcryptjs`, `nodemailer`, `cors`, `morgan`, `cookie-parser`, Node.js built-in test runner (`node --test`) |
| **Machine Learning** | `ken_ml/` | Python ($\ge 3.10$), `scikit-learn==1.9.1`, `pandas`, `numpy`, `pymongo[srv]`, `joblib`, `python-dotenv`, `matplotlib`, `seaborn`, `jupyter` |
| **API Testing** | `postman/` | Bộ Postman Collections cho 13 module nghiệp vụ, `KEN_Postman_Runner_Collection.json` và cấu hình environment/globals |

---

## 3. Cấu trúc thư mục toàn dự án

```text
KEN/
├── README.md                              # Tài liệu tổng quan toàn dự án
├── KEN.code-workspace                     # Cấu hình workspace VS Code
├── my-app/                                # Frontend Angular 22
│   ├── angular.json                       # Cấu hình build/serve Angular
│   ├── package.json                       # Dependencies & scripts (start, build, test)
│   ├── proxy.conf.json                    # Proxy /api và /images/* tới http://localhost:3002
│   ├── vercel.json                        # Cấu hình triển khai Vercel
│   ├── public/                            # Tài nguyên tĩnh, hình ảnh không gian/F&B/addon
│   └── src/app/
│       ├── app-routing-module.ts          # Định tuyến toàn bộ trang Customer & Admin
│       ├── core/                          # AuthService, CustomerApiService, Guards, Interceptor, NavLinks
│       ├── shared/                        # Header, Footer, CustomerLayout, OTP Input, Suggestion Popup, Confirm Dialog
│       └── pages/
│           ├── customer/                  # Trang chủ, Auth, Đặt chỗ 5 bước (ken-booking), Spaces, Menu, Top Trending, Loyalty, Profile, Reviews, Support
│           └── admin/                     # AdminLayout, Dashboard, Bookings, Customers, Areas, Spaces, Service Packages, Addons, Voucher, Forecast
├── my-server-mongodb/                     # Backend Express 5 + MongoDB
│   ├── index.js                           # Entry point Express, Session MongoStore, Mount Routes & Cronjob thu hồi giữ chỗ
│   ├── package.json                       # Scripts vận hành, setup index, test & chạy ML
│   ├── docs/                              # Tài liệu kiến trúc chi tiết, workflow, quyết định thiết kế & lịch sử thay đổi
│   ├── src/
│   │   ├── config/                        # constants.js (HOLD=15p, BUFFER=15p, CANCEL_CUTOFF=120p...), indexes.js (ensureIndexes)
│   │   ├── domain/                        # Nghiệp vụ thuần: availability, bookingStateMachine, pricing, payment, loyalty, review, dashboard, adminUser, forecast
│   │   ├── middleware/                    # auth.js (requireAuth, requireRole, startSession), rateLimit.js
│   │   ├── services/                      # bookingService.js, adminService.js, forecastService.js, reviewService.js, otp.js
│   │   ├── routes/                        # auth, profile, catalog, bookings, payments, loyalty, reviews, admin, forecast
│   │   └── utils/                         # http.js (wrap, fail, str, publicUser, tierOf)
│   └── tests/                             # Kiểm thử tự động (unit/, integration/, e2e/, realdb/, helpers/)
├── ken_ml/                                # Pipeline Học máy Python
│   ├── run.js                             # Cross-platform CLI runner (tích hợp vào npm scripts của backend)
│   ├── requirements.txt                   # Danh sách thư viện Python phụ thuộc
│   ├── data/                              # Dữ liệu master_ken_data.csv sau tiền xử lý
│   ├── models/                            # Mô hình đã huấn luyện (rf_forecast.joblib, kmeans_cluster.joblib)
│   ├── notebooks/                         # EDA_Analysis.ipynb
│   ├── outputs/                           # Biểu đồ (figures/) và kết quả CSV (clustering_*, demand_forecast_*)
│   ├── src/                               # Preparation.py, 01_Trending.py, 02_Forecasting_*.py, 03_Clustering_*.py, Common.py, database.py, safe_write.py
│   └── tests/                             # trending_test.py, forecasting_test.py, clustering_test.py
└── postman/                               # Bộ kiểm thử API Postman
    ├── KEN_Postman_Runner_Collection.json # Collection tổng hợp chạy tự động
    ├── collections/                       # 13 bộ test cho Module 01 -> Module 13
    ├── environments/                      # KÉN Local Environment & environment.json
    └── globals/                           # workspace.globals.yaml
```

---

## 4. Các phân hệ chức năng chính (13 Modules)

1. **Xác thực, Phân quyền & Bảo mật (`auth.js`, `profile.js`, `otp.js`, `rateLimit.js`):**
   - Đăng ký tài khoản kèm xác thực OTP băm HMAC-SHA256 (`REGISTER`), đăng nhập bằng SĐT/Email, hỗ trợ xác thực 2 yếu tố (`2FA`), quên/đặt lại mật khẩu (`FORGOT_PASSWORD`).
   - Quản lý hồ sơ cá nhân, đổi mật khẩu, đổi SĐT, bật/tắt 2FA kèm OTP.
   - Cơ chế `requireAuth` đối chiếu lại trạng thái tài khoản trong DB (`ACTIVE`/`LOCKED`) và `password_changed_at` để thu hồi phiên khi bị khóa hoặc đổi mật khẩu; giới hạn tần suất (Rate Limiting) theo IP / SĐT / User ID.
2. **Danh mục Không gian, Gói dịch vụ & Sản phẩm F&B (`catalog.js`):**
   - Quản lý **Zones** (Khu vực), **Spaces** (phân loại `EXCLUSIVE` áp dụng buffer 15 phút giữa các lượt và `SHARED` tính theo sức chứa), **Packages** (`FIXED` / `HOURLY`, `PER_SPACE` / `PER_PERSON`), **Package Prices**, **Package Inclusions** (đồ uống tiêu chuẩn, bánh, nước, thiết bị...), **Products** (F&B: `DRINK`, `PASTRY`, `SNACK`), **Add-ons** (`PER_ITEM`, `PER_BOOKING`) và **Recipes** (định lượng nguyên vật liệu).
3. **Quy trình Đặt chỗ 5 bước & Vận hành (`bookingService.js`, `bookings.js`, `availability.js`, `bookingStateMachine.js`, `pricing.js`):**
   - **Bước 1:** Khám phá không gian và kiểm tra chỗ trống theo thời gian thực (`/api/spaces`, `/api/availability`).
   - **Bước 2:** Chọn Space + Package (`/api/bookings/select-package`). Nếu chưa đăng nhập, lưu `req.session.pendingBooking` và trả về `401` (`AUTH_GUARD_REQUIRED`) để khôi phục sau khi đăng nhập.
   - **Bước 3:** Tùy chọn Inclusion & Add-on (kèm gợi ý cá nhân hóa từ ML), tính báo giá tự động ở Backend (`/api/bookings/quote`): `Package + Phụ phí Inclusion + Add-on - Voucher - Giảm giá hạng thành viên`.
   - **Bước 4:** Checkout (`/api/bookings`) khóa `spaces.lock_version` trong ACID Transaction để chống đặt trùng, tạo đơn `PENDING_PAYMENT` giữ chỗ trong `15` phút (hoặc `CONFIRMED` ngay nếu `final_amount = 0`).
   - **Bước 5 & Vận hành:** Thanh toán (`/api/bookings/:id/pay`), hủy đơn trước `120` phút (`CANCEL_CUTOFF_MINUTES`), đổi lịch (`/reschedule`), Admin Check-in (`[start_at - 15p, start_at + 30p]`), Check-out, No-show (`> start_at + 30p`), đối soát hoàn tiền và Cronjob chạy mỗi phút tự động thu hồi đơn `PENDING_PAYMENT` quá hạn 15 phút sang `EXPIRED`.
4. **Thanh toán Idempotent (`payments.js`, `payment.js`):**
   - Hỗ trợ `idempotencyKey` (`gateway_ref`) tránh ghi nhận giao dịch trùng lặp khi người dùng hoặc cổng thanh toán gửi lại yêu cầu, kèm lịch sử giao dịch và hủy giao dịch `PENDING`.
5. **Voucher & Khách hàng thân thiết (`loyalty.js`):**
   - 4 hạng thành viên: `BASIC` (0%), `SILVER` (5%), `GOLD` (10%), `DIAMOND` (15%).
   - Tự động tích lũy KÉN Điểm & KÉN Coins khi đơn chuyển `CHECKED_OUT` (mỗi `10.000đ` tương ứng đơn vị quy đổi theo `POINT_UNIT_VND`), đổi Coins lấy Voucher vào ví `user_vouchers` mà không làm giảm Điểm/Hạng, và hỗ trợ Rollover đầu năm (`/api/loyalty/year-rollover`).
6. **Quản lý Đánh giá sau sử dụng (`reviews.js`, `reviewService.js`, `review.js`):**
   - Cho phép chủ đơn đã `CHECKED_OUT` gửi tối đa 01 đánh giá (`rating` 1..5 sao, `comment` $\le 500$ ký tự) trong Transaction; gắn cờ nhắc đánh giá (`review_reminder`, `can_review`, `has_review`) trên lịch sử đặt chỗ và thống kê điểm trung bình theo từng không gian.
7. **Quản trị Hệ thống & Dashboard (`admin.js`, `adminService.js`, `dashboard.js`, `adminUser.js`):**
   - Danh sách và hồ sơ khách hàng kèm thông tin `loyalty` và `bookingStats`; khóa/mở khóa tài khoản khách hàng (`ACTIVE` $\leftrightarrow$ `LOCKED`).
   - Dashboard thống kê theo khoảng ngày (giờ VN) và theo Zone: số đơn theo 7 trạng thái, Occupancy Rate, Top Add-ons và Doanh thu thực thu ($\Sigma\ \text{PAYMENT} - \Sigma\ \text{REFUND}$ thành công kèm phân rã Package / Phụ phí Inclusion / Add-on / Giảm giá).
8. **Hệ thống Học máy & Dự báo (`ken_ml/`, `forecast.js`, `forecastService.js`):**
   - **Bài toán 1 — Global Trending (`01_Trending.py`):** Tính điểm xu hướng kết hợp độ phổ biến và phân rã theo thời gian, phục vụ Pop-up gợi ý (`GET /api/recommendations`) và trang `/top-trending` (`GET /api/recommendations/top-trending`).
   - **Bài toán 2 — Demand Forecasting (`02_Forecasting_train.py`, `02_Forecasting_run.py`):** Mô hình Random Forest (`rf_forecast.joblib`) dự báo số lượng món F&B tiêu thụ, Backend quy đổi ra nhu cầu nguyên vật liệu theo công thức `recipes`, ghi nhận nhập/xuất kho (`/api/admin/forecast/ingredients/:id/movements`) và quản lý cảnh báo tồn kho (`/api/admin/forecast/alerts`).
   - **Bài toán 3 — Customer Clustering (`03_Clustering_train.py`, `03_Clustering_run.py`):** Phân cụm khách hàng bằng RFM + K-Means (`kmeans_cluster.joblib`) để gán `ml_cluster_id` và gợi ý menu Inclusion & Add-ons cá nhân hóa trong luồng Booking (`GET /api/recommendations/booking` và `GET /api/bookings/recommendations`).

---

## 5. Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu môi trường
- **Node.js** $\ge 20$ và **npm**
- **Python** $\ge 3.10$ (nếu chạy pipeline Học máy `ken_ml/`)
- **MongoDB** (Local hoặc MongoDB Atlas URI)

### Bước 1: Cấu hình biến môi trường

Tạo file `my-server-mongodb/.env` (dựa theo `my-server-mongodb/.env.example`) với các biến cấu hình cần thiết:

```env
PORT=3002
MONGODB_URI=mongodb://127.0.0.1:27017
SESSION_SECRET=replace-with-a-strong-local-secret
OTP_TTL_SECONDS=300
OTP_MAX_ATTEMPTS=5
SMS_PROVIDER=console
CORS_ORIGIN=http://localhost:4200
# Tùy chọn gửi OTP qua Email (nếu cấu hình SMTP)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

> Lưu ý: Không commit file `.env` thật lên Git (đã được khai báo trong `.gitignore`). Khi chạy ở `NODE_ENV=production`, hệ thống bắt buộc phải có `SESSION_SECRET` và tự bật `trust proxy = 1`.

### Bước 2: Cài đặt thư viện phụ thuộc

Từ thư mục gốc `KEN/`:

```bash
# 1. Cài đặt dependencies Backend
cd my-server-mongodb
npm install

# 2. Cài đặt dependencies Frontend
cd ../my-app
npm install

# 3. Cài đặt dependencies Machine Learning (nếu sử dụng ken_ml)
cd ../ken_ml
pip install -r requirements.txt
```

### Bước 3: Khởi tạo Index MongoDB

Tại thư mục `my-server-mongodb/`, chạy lệnh tạo index cho database `ken_space_booking`:

```bash
cd my-server-mongodb
npm run setup
```

### Bước 4: Khởi chạy hệ thống

Mở 2 terminal riêng biệt từ thư mục gốc `KEN/`:

**Terminal 1 — Khởi chạy Backend (`http://localhost:3002`):**

```bash
cd my-server-mongodb
npm start
# Hoặc chạy không dùng nodemon: npm run start:prod
```

**Terminal 2 — Khởi chạy Frontend (`http://localhost:4200`):**

```bash
cd my-app
npm start
```

Truy cập `http://localhost:4200`. File `my-app/proxy.conf.json` sẽ tự động chuyển tiếp các yêu cầu `/api`, `/images/addons`, `/images/spaces` và `/images/zones` sang Backend tại `http://localhost:3002`.

### Bước 5: Chạy pipeline Machine Learning (`ken_ml`)

Bạn có thể chạy trực tiếp thông qua npm scripts trong `my-server-mongodb/` (sử dụng `ken_ml/run.js`):

| Lệnh npm (chạy tại `my-server-mongodb/`) | Chức năng |
| :--- | :--- |
| `npm run ml:check` | Kiểm tra kết nối MongoDB và các collection cần thiết |
| `npm run ml:prep` | Trích xuất và tiền xử lý dữ liệu ra `ken_ml/data/master_ken_data.csv` |
| `npm run ml:dry` | Chạy thử nghiệm cả 3 bài toán ML ở chế độ an toàn (Dry-run, không ghi DB) |
| `npm run ml:trending` | Chạy Bài toán 1 (Global Trending) và ghi kết quả vào MongoDB |
| `npm run ml:forecast` | Chạy Bài toán 2 (Demand Forecasting) và ghi kết quả vào MongoDB |
| `npm run ml:cluster` | Chạy Bài toán 3 (Customer Clustering) và ghi nhãn cụm/gợi ý vào MongoDB |
| `npm run ml:all` | Chạy tuần tự cả 3 bài toán và ghi kết quả vào MongoDB |

---

## 6. Kiểm thử & Đảm bảo chất lượng

### Backend (`my-server-mongodb/`)

```bash
cd my-server-mongodb

# Chạy toàn bộ test (Unit, Integration, E2E)
npm test

# Chỉ chạy Unit tests
npm run test:unit

# Chạy kiểm thử trên MongoDB thật (yêu cầu kết nối DB hợp lệ)
npm run test:realdb
```

### Machine Learning (`ken_ml/`)

```bash
# Chạy từ my-server-mongodb/
npm run ml:test

# Hoặc chạy trực tiếp từ ken_ml/
python tests/trending_test.py
python tests/forecasting_test.py
python tests/clustering_test.py
```

### Frontend (`my-app/`)

```bash
cd my-app

# Build kiểm tra biên dịch Angular
npm run build

# Chạy unit test Frontend với Vitest
npm test
```

---

## 7. Tài liệu tham khảo nội bộ

- **Tài liệu kiến trúc Backend, Workflow 13 Modules & Danh sách API chi tiết:** [my-server-mongodb/docs/README.md](my-server-mongodb/docs/README.md)
- **Tài liệu chi tiết Pipeline Học máy (`ken_ml`):** [ken_ml/README.md](ken_ml/README.md)
- **Bộ kiểm thử API Postman (13 Modules):** Thư mục `postman/`

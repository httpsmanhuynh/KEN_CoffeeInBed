# KÉN Machine Learning Pipeline (ken_ml)

Hệ thống Học máy phục vụ cho nền tảng KÉN Coffee & Workspace Booking, bao gồm 3 bài toán chính:

1. **Bài toán 1 - Global Trending (Popularity-based & Time Decay)**: Gợi ý các món F&B xu hướng toàn hệ thống cho Pop-up và trang `/top-trending`.
2. **Bài toán 2 - Demand Forecasting**: Dự báo số lượng món F&B tiêu thụ cho ngày tiếp theo (mô hình Random Forest), từ đó quy đổi nhu cầu nguyên vật liệu và cảnh báo tồn kho.
3. **Bài toán 3 - Customer Clustering (RFM + K-Means)**: Gom cụm hành vi khách hàng theo Recency, Frequency, Monetary để cá nhân hóa menu gợi ý (Inclusion & Add-ons) trong luồng đặt chỗ (Booking).

---

## 1. Cấu trúc thư mục

```
ken_ml/
├── data/
│   └── master_ken_data.csv             # Tập dữ liệu F&B và booking sau tiền xử lý
├── models/
│   ├── kmeans_cluster.joblib           # Model bundle gom cụm khách hàng (K-Means)
│   └── rf_forecast.joblib              # Model bundle dự báo nhu cầu F&B (Random Forest)
├── notebooks/
│   └── EDA_Analysis.ipynb              # Phân tích khám phá dữ liệu (EDA)
├── outputs/
│   ├── figures/                        # Các biểu đồ trực quan hóa (Elbow, Scatter3D, ACF,...)
│   ├── clustering_*.csv                # Kết quả phân tích cụm, profile, hit rate
│   └── demand_forecast_*.csv           # Kết quả dự báo nhu cầu chi tiết 31 món
├── src/
│   ├── 01_Trending.py                  # Pipeline tính điểm và xếp hạng Trending
│   ├── 02_Forecasting_train.py         # Huấn luyện mô hình Random Forest
│   ├── 02_Forecasting_run.py           # Chạy dự báo và cập nhật demand_forecasts
│   ├── 03_Clustering_train.py          # Huấn luyện mô hình K-Means
│   ├── 03_Clustering_run.py            # Gán nhãn cụm và cập nhật ml_cluster_recommendations, users
│   ├── Common.py                       # Hàm tiện ích dùng chung (RFM, đặc trưng, metrics)
│   ├── Preparation.py                  # Trích xuất dữ liệu từ MongoDB sang CSV
│   ├── _check_connection.py            # Kiểm tra kết nối và tính toàn vẹn dữ liệu
│   ├── database.py                     # Quản lý kết nối MongoDB Atlas (đọc chuỗi từ .env)
│   └── safe_write.py                   # Cơ chế ghi an toàn (mặc định dry-run, yêu cầu --write)
├── tests/
│   ├── trending_test.py                # Kiểm thử tự động bài toán 1
│   ├── forecasting_test.py             # Kiểm thử tự động bài toán 2
│   └── clustering_test.py              # Kiểm thử tự động bài toán 3
├── .env.example                        # Mẫu biến môi trường
├── requirements.txt                    # Thư viện Python phụ thuộc
└── run.js                              # Cross-platform runner tích hợp vào npm scripts
```

---

## 2. Cài đặt môi trường

Yêu cầu Python version >= 3.10. Cài đặt các thư viện cần thiết:

```bash
pip install -r ken_ml/requirements.txt
```

---

## 3. Cách chạy học máy trong hệ thống KÉN

Bạn có thể chạy trực tiếp từ thư mục gốc dự án hoặc thư mục `my-server-mongodb` thông qua các lệnh npm đã được tích hợp sẵn:

### Các lệnh nhanh qua npm

| Lệnh npm              | Mô tả                                                                       |
| :-------------------- | :-------------------------------------------------------------------------- |
| `npm run ml:check`    | Kiểm tra kết nối MongoDB Atlas và các collection cần thiết                  |
| `npm run ml:prep`     | Chạy pipeline trích xuất dữ liệu từ MongoDB Atlas ra `master_ken_data.csv`  |
| `npm run ml:test`     | Chạy toàn bộ 3 bài test tự động cho Trending, Forecasting, Clustering       |
| `npm run ml:trending` | Chạy bài toán 1 và ghi kết quả vào collection `ml_global_trending`          |
| `npm run ml:forecast` | Chạy bài toán 2 và ghi kết quả vào collection `demand_forecasts`            |
| `npm run ml:cluster`  | Chạy bài toán 3 và ghi nhãn cụm vào `users` và `ml_cluster_recommendations` |
| `npm run ml:all`      | Chạy tuần tự cả 3 bài toán và ghi dữ liệu cập nhật vào MongoDB              |
| `npm run ml:dry`      | Chạy thử nghiệm cả 3 bài toán ở chế độ an toàn (Dry-run, không ghi DB)      |

### Chạy trực tiếp bằng Python

Từ thư mục `ken_ml/`:

```bash
# Kiểm tra kết nối
python src/_check_connection.py

# Chạy test
python tests/trending_test.py
python tests/forecasting_test.py
python tests/clustering_test.py

# Chạy pipeline ở chế độ Dry-run (chỉ in, không đụng DB)
python src/01_Trending.py
python src/02_Forecasting_run.py
python src/03_Clustering_run.py

# Chạy pipeline ghi thật vào MongoDB
python src/01_Trending.py --write
python src/02_Forecasting_run.py --write
python src/03_Clustering_run.py --write
```

---

## 4. Tích hợp với hệ thống Backend (`my-server-mongodb`)

Backend Kén sử dụng dữ liệu từ ML pipeline thông qua các endpoint:

- `GET /api/recommendations` & `/api/recommendations/top-trending`: Lấy danh sách Top Trending từ `ml_global_trending`.
- `GET /api/recommendations/booking` & `/api/bookings/recommendations`: Gợi ý món Inclusion & Add-on theo cụm khách hàng `ml_cluster_id` từ `ml_cluster_recommendations`.
- `GET /api/admin/forecast`: Lấy dự báo nhu cầu món F&B từ `demand_forecasts` và tính toán nguyên vật liệu tiêu thụ tương ứng.

# KÉN ML – Học máy cho hệ thống KÉN

`ken_ml` là một thư mục nằm trong project KÉN lớn hơn. Pipeline gồm 3 bài toán, chạy trên dữ liệu bán hàng F&B từ 01/04/2026 đến 27/10/2026 (67.375 dòng).

| Bài | Bài toán | Kỹ thuật | Kết quả ghi vào MongoDB |
|---|---|---|---|
| 1 | Gợi ý xu hướng chung (Global Trending) | Popularity + Time Decay | `ml_global_trending` |
| 2 | Dự báo nhu cầu bán F&B theo ngày | Random Forest (so sánh với Baseline 4 tuần và MLR) | `demand_forecasts` |
| 3 | Phân nhóm khách hàng và gợi ý món theo cụm | K-Means trên RFM | `ml_cluster_recommendations`, trường `ml_cluster_id` của `users` |

## Cài đặt

Cần Python 3.12.

```bash
cd ken_ml
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Lưu ý về thư mục

- Đặt `ken_ml` cùng cấp với `my-server-mongodb` và `database` trong project lớn. `src/database.py` đọc file `.env` ở `../my-server-mongodb/.env` (cũng có thể đặt `ken_ml/.env` nếu muốn ghi đè).
- `data/master_ken_data.csv` và `models/*.joblib` đã có sẵn. Chỉ cần chúng là chạy được train, test và dry-run mà không cần MongoDB.
- Khi cần ghi vào MongoDB, database phải được dựng sẵn từ thư mục `database/` (`npm install` rồi `npm run setup`). Kiểm tra bằng `python src/_check_connection.py`.
- Hai file `.joblib` được train bằng scikit-learn 1.9.1. Nếu cài bản khác và nạp lỗi, chạy lại 2 lệnh train bên dưới.
- Chỉ khi dữ liệu trong DB thay đổi mới cần tạo lại CSV: `python src/Preparation.py` (hoặc `python src/Preparation.py --json-dir ../database/data` để đọc từ file dump JSON).
- Windows: nếu terminal lỗi tiếng Việt, đặt `PYTHONUTF8=1` trước khi chạy.

## Các bước chạy

Luôn chạy từ thư mục `ken_ml`. Các lệnh `run` mặc định chỉ chạy thử (dry-run), chỉ ghi vào MongoDB khi thêm `--write`.

**Bước 1. Kiểm thử (không đụng DB)**
```bash
python tests/trending_test.py
python tests/forecasting_test.py
python tests/clustering_test.py
```

**Bước 2. Train mô hình**
```bash
python src/02_Forecasting_train.py     # Bài 2 -> models/rf_forecast.joblib, outputs/forecasting_metrics.csv
python src/03_Clustering_train.py      # Bài 3 -> models/kmeans_cluster.joblib (tùy chọn: --k 4, --log)
```
Bài 1 không cần train.

**Bước 3. Chạy thử (dry-run)**
```bash
python src/01_Trending.py
python src/02_Forecasting_run.py
python src/03_Clustering_run.py
```

**Bước 4. Ghi thật vào MongoDB** (sau khi test đạt và đã xem kết quả dry-run)
```bash
python src/01_Trending.py --write
python src/02_Forecasting_run.py --write
python src/03_Clustering_run.py --write
```

Kết quả (csv, json, hình) nằm trong `outputs/`. Phân tích khám phá dữ liệu: `jupyter notebook notebooks/EDA_Analysis.ipynb`.
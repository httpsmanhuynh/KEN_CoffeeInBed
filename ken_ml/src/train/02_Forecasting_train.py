"""Bài toán 2 - HUẤN LUYỆN: Dự báo nhu cầu bán F&B (Random Forest) -> models/rf_forecast.joblib.

Quy trình:
  1. Đọc data/master_ken_data.csv (giữ cả khách vãng lai và quyền lợi).
  2. Resampling theo ngày x 31 món (6.510 điểm dữ liệu, điền 0 cho 7 cặp thiếu).
  3. Tạo đặc trưng chuỗi thời gian: lag (1, 2, 7, 14, 21, 28), rolling mean/std, lịch và Baseline 4W.
  4. Chia Train (01/04 - 13/10) và Test (14/10 - 27/10) theo trục thời gian (tuyệt đối không random).
  5. Huấn luyện và đánh giá:
       - Baseline: trung bình 4 lần gần nhất cùng thứ trong tuần (lag 7, 14, 21, 28)
       - MLR (Hồi quy tuyến tính đa biến)
       - Random Forest Regressor
  6. Xuất bảng so sánh MAE, RMSE vào outputs/forecasting_metrics.csv.
  7. Vẽ biểu đồ Actual vs Predicted lưu vào figures/ và outputs/.
  8. Huấn luyện mô hình RF hoàn chỉnh trên toàn bộ dữ liệu đến 27/10 và lưu vào models/rf_forecast.joblib & model/rf_forecast.joblib.

Chạy:
  python src/train/02_Forecasting_train.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Thêm đường dẫn để import thuận tiện
CURRENT_DIR = Path(__file__).resolve().parent
SRC_DIR = CURRENT_DIR.parent
ROOT_DIR = SRC_DIR.parent
for p in [str(SRC_DIR), str(ROOT_DIR), str(CURRENT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

from forecast_common import (
    ALT_MODEL_DIR,
    ALT_MODEL_PATH,
    DATA_CSV,
    FIGURES_DIR,
    MODEL_PATH,
    MODEL_VERSION,
    MODELS_DIR,
    OUTPUT_DIR,
    TEST_END,
    TEST_START,
    TRAIN_END,
    TRAIN_START,
    build_daily_grid,
    compute_historical_features,
    load_raw_data,
    now_utc,
    prepare_encoded_dataset,
)

logger = logging.getLogger("forecasting_train")


def plot_actual_vs_predicted(
    y_true: pd.Series,
    y_pred: np.ndarray,
    dates: pd.Series,
    save_path: Path,
) -> None:
    """Vẽ biểu đồ đường Actual vs Predicted tổng lượng bán hàng ngày trong kỳ kiểm thử (14 ngày)."""
    eval_df = pd.DataFrame({"sale_date": dates, "Actual": y_true, "Predicted": y_pred})
    daily_agg = eval_df.groupby("sale_date")[["Actual", "Predicted"]].sum().reset_index()

    plt.figure(figsize=(10, 5))
    plt.plot(daily_agg["sale_date"], daily_agg["Actual"], marker="o", label="Thực tế (Actual)", color="#1f77b4", linewidth=2)
    plt.plot(daily_agg["sale_date"], daily_agg["Predicted"], marker="s", linestyle="--", label="Dự báo (Random Forest)", color="#ff7f0e", linewidth=2)
    plt.title("So sánh số lượng F&B Thực tế vs Dự báo (Tập Test: 14/10 - 27/10/2026)", fontsize=13, fontweight="bold")
    plt.xlabel("Ngày bán", fontsize=11)
    plt.ylabel("Tổng số lượng (ly/phần)", fontsize=11)
    plt.grid(True, linestyle=":", alpha=0.6)
    plt.legend(fontsize=11)
    plt.xticks(rotation=45)
    plt.tight_layout()

    save_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(save_path, dpi=150)
    plt.close()


def train() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
    logger.info("=== BẮT ĐẦU HUẤN LUYỆN BÀI TOÁN 2: DỰ BÁO NHU CẦU (DEMAND FORECASTING) ===")

    # 1. Đọc dữ liệu
    df, ref_date, item_metadata = load_raw_data(DATA_CSV)
    logger.info("Đã nạp CSV: %d dòng | Ngày tham chiếu (REFERENCE_DATE): %s", len(df), ref_date.date())

    # 2. Resampling theo ngày cho 31 món
    full_grid = build_daily_grid(df)
    logger.info("Resampling theo ngày: %d điểm dữ liệu (31 món x 210 ngày, đã điền 0 cho 7 cặp thiếu)", len(full_grid))

    # 3. Tính đặc trưng chuỗi thời gian & Baseline 4W
    featured_df = compute_historical_features(full_grid)

    # 4. Mã hóa One-Hot
    encoded_df, feature_cols = prepare_encoded_dataset(featured_df)
    logger.info("Số lượng đặc trưng đầu vào cho mô hình: %d", len(feature_cols))

    # 5. Phân chia Train/Test theo trục thời gian
    # Train: 29/04 - 13/10 (sau thời gian lag warm-up 28 ngày)
    train_mask = (encoded_df["sale_date"] >= TRAIN_START) & (encoded_df["sale_date"] <= TRAIN_END)
    test_mask = (encoded_df["sale_date"] >= TEST_START) & (encoded_df["sale_date"] <= TEST_END)

    train_df = encoded_df[train_mask].dropna(subset=feature_cols + ["quantity"])
    test_df = encoded_df[test_mask].dropna(subset=feature_cols + ["quantity"])

    X_train, y_train = train_df[feature_cols], train_df["quantity"]
    X_test, y_test = test_df[feature_cols], test_df["quantity"]

    logger.info("Kích thước tập Train: %d mẫu (01/04 warm-up -> 13/10/2026)", len(train_df))
    logger.info("Kích thước tập Test:  %d mẫu (14 ngày: 14/10 -> 27/10/2026)", len(test_df))

    # --- ĐÁNH GIÁ 1: Baseline (Trung bình 4 tuần gần nhất cùng thứ) ---
    base_pred = test_df["baseline_4w"]
    base_mae = float(mean_absolute_error(y_test, base_pred))
    base_rmse = float(root_mean_squared_error(y_test, base_pred))

    # --- ĐÁNH GIÁ 2: MLR (Hồi quy tuyến tính đa biến) ---
    mlr = LinearRegression()
    mlr.fit(X_train, y_train)
    mlr_pred = np.maximum(0.0, mlr.predict(X_test))
    mlr_mae = float(mean_absolute_error(y_test, mlr_pred))
    mlr_rmse = float(root_mean_squared_error(y_test, mlr_pred))

    # --- ĐÁNH GIÁ 3: Random Forest Regressor ---
    rf_eval = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    rf_eval.fit(X_train, y_train)
    rf_eval_pred = np.maximum(0.0, rf_eval.predict(X_test))
    rf_mae = float(mean_absolute_error(y_test, rf_eval_pred))
    rf_rmse = float(root_mean_squared_error(y_test, rf_eval_pred))

    # In bảng đối chiếu kết quả
    metrics_data = [
        {"Model": "Baseline (4 tuần cùng thứ)", "MAE": round(base_mae, 4), "RMSE": round(base_rmse, 4)},
        {"Model": "Multiple Linear Regression (MLR)", "MAE": round(mlr_mae, 4), "RMSE": round(mlr_rmse, 4)},
        {"Model": "Random Forest Regressor (Đề xuất)", "MAE": round(rf_mae, 4), "RMSE": round(rf_rmse, 4)},
    ]
    metrics_df = pd.DataFrame(metrics_data)

    print("\n" + "=" * 65)
    print(" KẾT QUẢ ĐÁNH GIÁ TRÊN TẬP TEST (14/10/2026 - 27/10/2026)")
    print("=" * 65)
    print(metrics_df.to_string(index=False))
    print("=" * 65 + "\n")

    # Lưu bảng so sánh metrics vào outputs/
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    metrics_csv_path = OUTPUT_DIR / "forecasting_metrics.csv"
    metrics_df.to_csv(metrics_csv_path, index=False)
    logger.info("Đã lưu bảng chỉ số đánh giá vào: %s", metrics_csv_path)

    # Vẽ và lưu biểu đồ Actual vs Predicted
    fig_path = FIGURES_DIR / "forecasting_actual_vs_predicted.png"
    plot_actual_vs_predicted(y_test, rf_eval_pred, test_df["sale_date"], fig_path)
    # Sao lưu sang outputs/ để tiện tra cứu báo cáo
    plot_actual_vs_predicted(y_test, rf_eval_pred, test_df["sale_date"], OUTPUT_DIR / "forecasting_actual_vs_predicted.png")
    logger.info("Đã lưu biểu đồ so sánh vào: %s", fig_path)

    # 6. Huấn luyện mô hình Random Forest trên toàn bộ dữ liệu (29/04 -> 27/10) để sẵn sàng dự báo ngày 28/10
    logger.info("Đang huấn luyện mô hình Random Forest trên toàn bộ dữ liệu lịch sử...")
    full_train_df = encoded_df[encoded_df["sale_date"] >= TRAIN_START].dropna(subset=feature_cols + ["quantity"])
    X_full, y_full = full_train_df[feature_cols], full_train_df["quantity"]

    final_rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    final_rf.fit(X_full, y_full)

    # Đóng gói Bundle mô hình
    bundle = {
        "model": final_rf,
        "eval_model": rf_eval,
        "mlr_model": mlr,
        "feature_cols": feature_cols,
        "metrics": {
            "baseline": {"mae": base_mae, "rmse": base_rmse},
            "mlr": {"mae": mlr_mae, "rmse": mlr_rmse},
            "random_forest": {"mae": rf_mae, "rmse": rf_rmse},
        },
        "reference_date": str(ref_date.date()),
        "forecast_date": str(ref_date.date()),
        "trained_at": now_utc().isoformat(),
        "item_metadata": item_metadata,
        "model_version": MODEL_VERSION,
        "sklearn_version": sklearn.__version__,
        "n_train_samples": len(full_train_df),
        "n_items": len(item_metadata),
    }

    # Lưu vào cả models/ và model/ theo quy ước
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ALT_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(bundle, MODEL_PATH)
    joblib.dump(bundle, ALT_MODEL_PATH)

    logger.info("Đã lưu mô hình thành công vào:")
    logger.info("  1. %s", MODEL_PATH)
    logger.info("  2. %s", ALT_MODEL_PATH)
    logger.info("=== HOÀN TẤT HUẤN LUYỆN BÀI TOÁN 2 ===")


if __name__ == "__main__":
    train()

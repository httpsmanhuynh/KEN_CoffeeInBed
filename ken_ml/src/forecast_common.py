"""Module dùng chung cho Bài toán 2: Dự báo nhu cầu (Demand Forecasting).

Chứa các hàm xử lý dữ liệu, tạo đặc trưng trễ (lags), tính baseline,
dự báo khoảng tin cậy (prediction intervals), và chuẩn bị documents cho MongoDB.
Không chứa lệnh ghi trực tiếp vào MongoDB (lệnh ghi do src/safe_write.py đảm nhiệm).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from bson import ObjectId

logger = logging.getLogger("forecast_common")

# Đường dẫn thư mục chuẩn của dự án KEN_ML
ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_CSV = ROOT_DIR / "data" / "master_ken_data.csv"
MODELS_DIR = ROOT_DIR / "models"
MODEL_PATH = MODELS_DIR / "rf_forecast.joblib"
ALT_MODEL_DIR = ROOT_DIR / "model"
ALT_MODEL_PATH = ALT_MODEL_DIR / "rf_forecast.joblib"
OUTPUT_DIR = ROOT_DIR / "outputs"
FIGURES_DIR = ROOT_DIR / "figures"

from safe_write import FORECAST_FIELDS, FORECAST_REQUIRED, upsert_forecasts
MODEL_VERSION = "rf_v1"
LAG_DAYS = [1, 2, 7, 14, 21, 28]
TRAIN_START = pd.Timestamp("2026-04-29")  # Sau 28 ngày warm-up cho lag_28
TRAIN_END = pd.Timestamp("2026-10-13")    # 196 ngày theo đề bài
TEST_START = pd.Timestamp("2026-10-14")   # 14 ngày cuối
TEST_END = pd.Timestamp("2026-10-27")


def now_utc() -> datetime:
    """Trả về datetime UTC hiện tại."""
    return datetime.now(timezone.utc)


def load_raw_data(csv_path: Path = DATA_CSV) -> tuple[pd.DataFrame, pd.Timestamp, dict[str, dict[str, Any]]]:
    """Đọc dữ liệu master_ken_data.csv.

    - Giữ cả khách vãng lai và dòng quyền lợi (is_inclusion == 1) để khớp sales_history_daily.
    - Tính reference_date = max(sale_date) + 1 ngày (dữ liệu đóng băng).
    - Trả về: (df, reference_date, item_metadata).
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file dữ liệu tại {csv_path}")

    df = pd.read_csv(csv_path, parse_dates=["sale_date"])
    ref_date = df["sale_date"].max() + pd.Timedelta(days=1)

    # Lưu metadata của 31 món (item_id, item_name, category, item_type)
    meta_df = df[["item_code", "item_id", "item_name", "category", "item_type"]].drop_duplicates("item_code")
    item_metadata = {
        row["item_code"]: {
            "item_id": str(row["item_id"]),
            "item_name": str(row["item_name"]),
            "category": str(row["category"]),
            "item_type": str(row["item_type"]),
        }
        for _, row in meta_df.iterrows()
    }

    return df, ref_date, item_metadata


def build_daily_grid(df: pd.DataFrame) -> pd.DataFrame:
    """Resampling theo ngày cho đủ 31 món x 210 ngày, điền 0 cho 7 cặp thiếu."""
    daily = df.groupby(["sale_date", "item_code"], as_index=False)["quantity"].sum()

    all_dates = pd.date_range(daily["sale_date"].min(), daily["sale_date"].max(), freq="D")
    all_items = sorted(df["item_code"].unique())
    grid_idx = pd.MultiIndex.from_product([all_dates, all_items], names=["sale_date", "item_code"])

    full = daily.set_index(["sale_date", "item_code"]).reindex(grid_idx, fill_value=0).reset_index()
    full = full.sort_values(["item_code", "sale_date"]).reset_index(drop=True)
    return full


def compute_historical_features(full_grid: pd.DataFrame) -> pd.DataFrame:
    """Tạo các đặc trưng chuỗi thời gian: lag, rolling mean, rolling std, baseline_4w và lịch."""
    df = full_grid.copy().sort_values(["item_code", "sale_date"]).reset_index(drop=True)

    # 1. Các giá trị trễ (lag)
    for lag in LAG_DAYS:
        df[f"lag_{lag}"] = df.groupby("item_code")["quantity"].shift(lag)

    # 2. Đặc trưng thống kê trượt trên chuỗi đã shift(1) để không rò rỉ dữ liệu
    df["rolling_mean_7"] = df.groupby("item_code")["quantity"].transform(
        lambda s: s.shift(1).rolling(7, min_periods=1).mean()
    )
    df["rolling_mean_14"] = df.groupby("item_code")["quantity"].transform(
        lambda s: s.shift(1).rolling(14, min_periods=1).mean()
    )
    df["rolling_mean_28"] = df.groupby("item_code")["quantity"].transform(
        lambda s: s.shift(1).rolling(28, min_periods=1).mean()
    )
    df["rolling_std_7"] = df.groupby("item_code")["quantity"].transform(
        lambda s: s.shift(1).rolling(7, min_periods=1).std()
    ).fillna(0)

    # 3. Baseline: trung bình 4 lần gần nhất của cùng thứ trong tuần (lag 7, 14, 21, 28)
    df["baseline_4w"] = (df["lag_7"] + df["lag_14"] + df["lag_21"] + df["lag_28"]) / 4.0

    # 4. Đặc trưng lịch
    df["day_of_week"] = df["sale_date"].dt.day_of_week
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["season"] = df["sale_date"].dt.month.apply(lambda m: "DRY" if m == 4 else "RAINY")

    return df


def prepare_encoded_dataset(
    featured_df: pd.DataFrame,
    feature_cols: list[str] | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """One-Hot Encoding cho day_of_week, season, item_code với drop_first=True.

    Nếu feature_cols đã được truyền vào (lúc dự báo), căn chỉnh đúng các cột này.
    """
    encoded = pd.get_dummies(
        featured_df,
        columns=["day_of_week", "season", "item_code"],
        drop_first=True,
    )

    if feature_cols is None:
        exclude_cols = {"sale_date", "quantity", "baseline_4w"}
        cols = [c for c in encoded.columns if c not in exclude_cols]
        return encoded, cols
    else:
        # Reindex theo đúng danh sách feature_cols của mô hình đã huấn luyện
        for col in feature_cols:
            if col not in encoded.columns:
                encoded[col] = 0
        return encoded, feature_cols


def build_next_day_features(
    full_grid: pd.DataFrame,
    target_date: pd.Timestamp,
    feature_cols: list[str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Tạo dòng đặc trưng cho ngày target_date (vd: 2026-10-28) cho toàn bộ 31 món.

    Trả về (next_day_raw_df, next_day_encoded_X).
    """
    all_items = sorted(full_grid["item_code"].unique())
    rows = []

    for item in all_items:
        sub = full_grid[full_grid["item_code"] == item].sort_values("sale_date")
        q = sub["quantity"].to_numpy()

        lag_1 = float(q[-1])
        lag_2 = float(q[-2])
        lag_7 = float(q[-7])
        lag_14 = float(q[-14])
        lag_21 = float(q[-21])
        lag_28 = float(q[-28])
        r7 = float(np.mean(q[-7:]))
        r14 = float(np.mean(q[-14:]))
        r28 = float(np.mean(q[-28:]))
        r_std7 = float(np.std(q[-7:]))
        b4w = float((lag_7 + lag_14 + lag_21 + lag_28) / 4.0)

        dow = int(target_date.day_of_week)
        is_wk = int(dow in [5, 6])
        season = "DRY" if target_date.month == 4 else "RAINY"

        rows.append({
            "sale_date": target_date,
            "item_code": item,
            "lag_1": lag_1,
            "lag_2": lag_2,
            "lag_7": lag_7,
            "lag_14": lag_14,
            "lag_21": lag_21,
            "lag_28": lag_28,
            "rolling_mean_7": r7,
            "rolling_mean_14": r14,
            "rolling_mean_28": r28,
            "rolling_std_7": r_std7,
            "baseline_4w": b4w,
            "day_of_week": dow,
            "is_weekend": is_wk,
            "season": season,
        })

    next_df = pd.DataFrame(rows)
    encoded_df, _ = prepare_encoded_dataset(next_df, feature_cols=feature_cols)
    return next_df, encoded_df[feature_cols]


def predict_with_intervals(
    rf_model: Any,
    X: pd.DataFrame,
    lower_pct: float = 10.0,
    upper_pct: float = 90.0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Dự báo số lượng cùng khoảng tin cậy (lower_qty, upper_qty) từ các cây con của Random Forest."""
    preds = np.maximum(0.0, rf_model.predict(X))

    # Lấy dự báo từ từng decision tree trong ensemble
    tree_preds = np.array([tree.predict(X.to_numpy()) for tree in rf_model.estimators_])
    tree_preds = np.maximum(0.0, tree_preds)

    lowers = np.percentile(tree_preds, lower_pct, axis=0)
    uppers = np.percentile(tree_preds, upper_pct, axis=0)

    # Đảm bảo lower <= pred <= upper
    lowers = np.minimum(lowers, preds)
    uppers = np.maximum(uppers, preds)

    return preds, lowers, uppers


def compute_action_tags(predicted_qty: pd.Series, baseline_qty: pd.Series) -> pd.Series:
    """Gán nhãn hành động cho Admin (phục vụ báo cáo & dashboard, KHÔNG ghi vào DB).

    - >= +15%: Tăng chuẩn bị / Tăng rã đông
    - <= -15%: Giảm chuẩn bị
    - Còn lại: Giữ mức chuẩn bị
    """
    diff_pct = (predicted_qty - baseline_qty) / np.maximum(1e-6, baseline_qty)
    tags = pd.Series("Giữ mức chuẩn bị", index=predicted_qty.index)
    tags[diff_pct >= 0.15] = "Tăng chuẩn bị"
    tags[diff_pct <= -0.15] = "Giảm chuẩn bị"
    return tags


def build_mongo_forecast_docs(
    forecast_df: pd.DataFrame,
    item_metadata: dict[str, dict[str, Any]],
    forecast_date: pd.Timestamp,
    model_version: str = MODEL_VERSION,
) -> list[dict[str, Any]]:
    """Tạo danh sách tài liệu ghi vào MongoDB đúng chuẩn validator (additionalProperties=false).

    Chỉ chứa các trường:
      item_id (ObjectId), item_code, forecast_date (datetime UTC),
      predicted_qty (int >= 0), lower_qty (int), upper_qty (int),
      model_version (str), generated_at (datetime UTC)
    """
    docs = []
    stamp = now_utc()
    fc_dt = datetime(
        forecast_date.year,
        forecast_date.month,
        forecast_date.day,
        0, 0, 0,
        tzinfo=timezone.utc,
    )

    for _, row in forecast_df.iterrows():
        code = str(row["item_code"])
        item_id_str = item_metadata[code]["item_id"]

        pred_val = int(round(max(0, float(row["predicted_qty"]))))
        lower_val = int(round(max(0, float(row["lower_qty"]))))
        upper_val = int(round(max(pred_val, float(row["upper_qty"]))))

        doc = {
            "item_id": ObjectId(item_id_str),
            "item_code": code,
            "forecast_date": fc_dt,
            "predicted_qty": pred_val,
            "lower_qty": lower_val,
            "upper_qty": upper_val,
            "model_version": model_version,
            "generated_at": stamp,
        }
        docs.append(doc)

    return docs

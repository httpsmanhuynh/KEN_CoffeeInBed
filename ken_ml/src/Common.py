"""Hàm dùng chung cho Bài toán 2 (Dự báo nhu cầu) và Bài toán 3 (Phân nhóm khách).

File này giúp các script train, run và test của mỗi bài tính toán
CHÍNH XÁC GIỐNG NHAU, tránh lệch giữa lúc huấn luyện và lúc dự báo/chạy thật.
Không có lệnh ghi MongoDB ở đây (lệnh ghi do src/safe_write.py đảm nhiệm).

Nội dung gồm hai phần:
- Bài toán 3 (Phân nhóm khách + gợi ý theo cụm): tính RFM, gợi ý món theo cụm,
  hồ sơ và đặt tên cụm. Dùng cho src/03_Clustering_train.py, các script run
  của Bài 3 và tests tương ứng.
- Bài toán 2 (Dự báo nhu cầu): dựng lưới theo ngày, tạo đặc trưng (lag, rolling,
  lịch), mã hóa One-Hot, dự báo kèm khoảng P10-P90 và gán nhãn hành động cho Admin.
  Dùng cho src/02_Forecasting_train.py, src/02_Forecasting_run.py và
  tests/forecasting_test.py.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT_DIR / "data" / "master_ken_data.csv"
MODEL_PATH = ROOT_DIR / "models" / "kmeans_cluster.joblib"
OUTPUT_DIR = ROOT_DIR / "outputs"            # file kết quả (csv, json, ...)
FIGURES_DIR = OUTPUT_DIR / "figures"          # hình ảnh (png, jpg, ...)

FEATURES = ["R", "F", "M"]
TOP_N = 5  # số món gợi ý cho mỗi cụm

# Hằng số riêng cho Bài toán 2 (Dự báo nhu cầu)
FORECAST_MODEL_PATH = ROOT_DIR / "models" / "rf_forecast.joblib"
MODEL_VERSION = "rf_v1"
LAG_DAYS = [1, 2, 7, 14, 21, 28]
TRAIN_START = pd.Timestamp("2026-04-29")  # Sau 28 ngày warm-up cho lag_28
TRAIN_END = pd.Timestamp("2026-10-13")
TEST_START = pd.Timestamp("2026-10-14")   # 14 ngày cuối
TEST_END = pd.Timestamp("2026-10-27")


# --------------------------------------------------------------------------- #
# Dữ liệu và RFM
# --------------------------------------------------------------------------- #
def load_data(csv_path: Path = DATA_CSV) -> tuple[pd.DataFrame, pd.Timestamp]:
    """Đọc CSV, trả về (các dòng của khách đăng nhập, ngày tham chiếu).

    Ngày tham chiếu = max(sale_date) + 1 ngày (dữ liệu đóng băng, không dùng ngày hệ thống).
    Khách vãng lai (is_walk_in == 1) bị loại vì không có customer_id.
    """
    df = pd.read_csv(csv_path, parse_dates=["sale_date"])
    reference_date = df["sale_date"].max() + pd.Timedelta(days=1)
    members = df[df["is_walk_in"] == 0].copy()
    return members, reference_date


def build_rfm(members: pd.DataFrame, reference_date: pd.Timestamp) -> pd.DataFrame:
    """Ma trận RFM theo customer_id.

    R = số ngày từ lần mua gần nhất đến ngày tham chiếu
    F = số booking duy nhất (KHÔNG đếm order_code: mỗi booking thường có 2 mã đơn, F sẽ bị nhân đôi)
    M = tổng line_total_vnd (chi tiêu F&B; dòng INCLUSION giá 0 nên không ảnh hưởng)
    """
    grouped = members.groupby("customer_id").agg(
        last_date=("sale_date", "max"),
        F=("booking_id", "nunique"),
        M=("line_total_vnd", "sum"),
    )
    grouped["R"] = (reference_date - grouped["last_date"]).dt.days
    return grouped[FEATURES].astype(float)


# --------------------------------------------------------------------------- #
# Gợi ý theo cụm (Local Popularity)
# --------------------------------------------------------------------------- #
def top_items(rows: pd.DataFrame, top_n: int = TOP_N) -> list[str]:
    """Top món theo tổng số lượng; hòa điểm thì xếp theo mã món để kết quả ổn định."""
    totals = rows.groupby("item_code", as_index=False)["quantity"].sum()
    totals = totals.sort_values(["quantity", "item_code"], ascending=[False, True])
    return totals["item_code"].head(top_n).tolist()


def cluster_recommendations(members: pd.DataFrame, labels: pd.Series, top_n: int = TOP_N) -> dict[int, list[str]]:
    """Top món phổ biến nhất trong từng cụm. Bỏ dòng INCLUSION (món tặng kèm gói, không phải khách chọn)."""
    sold = members[members["is_inclusion"] == 0]
    sold = sold.merge(labels.rename("cluster_id"), left_on="customer_id", right_index=True)
    fallback = top_items(sold, top_n)
    recs: dict[int, list[str]] = {}
    for cluster_id in sorted(labels.unique()):
        part = sold[sold["cluster_id"] == cluster_id]
        recs[int(cluster_id)] = top_items(part, top_n) if len(part) else fallback
    return recs


# --------------------------------------------------------------------------- #
# Hồ sơ cụm và đặt tên persona
# --------------------------------------------------------------------------- #
def profile_clusters(rfm: pd.DataFrame, members: pd.DataFrame, labels: pd.Series) -> pd.DataFrame:
    """Bảng mô tả từng cụm: quy mô, R/F/M trung bình, tỷ lệ bánh, giờ Evening, cuối tuần, tuổi."""
    joined = rfm.join(labels.rename("cluster_id"))
    profile = joined.groupby("cluster_id").agg(
        customers=("R", "size"), R_mean=("R", "mean"), F_mean=("F", "mean"), M_mean=("M", "mean"))

    sold = members[members["is_inclusion"] == 0].merge(
        labels.rename("cluster_id"), left_on="customer_id", right_index=True)
    total = sold.groupby("cluster_id")["quantity"].sum()

    def share(mask: pd.Series) -> pd.Series:
        return (sold[mask].groupby("cluster_id")["quantity"].sum() / total).reindex(profile.index).fillna(0)

    profile["pastry_share"] = share(sold["item_type"] == "FOOD")
    profile["evening_share"] = share(sold["time_part"] == "Evening")
    profile["weekend_share"] = share(sold["is_weekend"] == 1)
    ages = members.drop_duplicates("customer_id").set_index("customer_id")["customer_age"]
    profile["avg_age"] = ages.groupby(labels).mean().reindex(profile.index)
    return profile.round(3)


def relabel_by_spend(raw_labels: pd.Series, rfm: pd.DataFrame) -> dict[int, int]:
    """Đánh số lại cụm để cụm 0 = chi tiêu (M) trung bình cao nhất, ... Giữ ml_cluster_id ổn định giữa các lần train."""
    order = rfm.groupby(raw_labels)["M"].mean().sort_values(ascending=False).index.tolist()
    return {int(raw): new for new, raw in enumerate(order)}


def suggest_persona_names(profile: pd.DataFrame, rfm: pd.DataFrame) -> dict[int, str]:
    """Tên cụm GỢI Ý theo tâm cụm (có thể sửa qua PERSONA_OVERRIDES trong 03_Clustering_train.py)."""
    median_r, median_f, mean_f, mean_m = rfm["R"].median(), rfm["F"].median(), rfm["F"].mean(), rfm["M"].mean()
    names: dict[int, str] = {}
    for cid, row in profile.iterrows():
        if row["R_mean"] >= max(30, 3 * median_r):
            name = "Khách ngủ đông (lâu chưa quay lại)"
        elif row["M_mean"] >= 1.5 * mean_m and row["F_mean"] >= mean_f:
            name = "Khách thân thiết chi mạnh"
        elif row["F_mean"] <= 0.5 * median_f:
            name = "Khách mới, ít ghé"
        else:
            name = "Khách đều đặn"
        names[int(cid)] = name
    seen: dict[str, int] = {}
    for cid in sorted(names):  # tên trùng nhau thì thêm số cụm để không lẫn
        seen[names[cid]] = seen.get(names[cid], 0) + 1
    for cid in sorted(names):
        if seen[names[cid]] > 1:
            names[cid] = f"{names[cid]} (cụm {cid})"
    return names


# --------------------------------------------------------------------------- #
# Dự đoán cụm từ bundle đã lưu
# --------------------------------------------------------------------------- #
def predict_cluster_ids(bundle: dict, rfm: pd.DataFrame) -> pd.Series:
    """Dự đoán ml_cluster_id (đã đánh số lại) cho các hàng RFM."""
    raw = bundle["pipeline"].predict(rfm[bundle["features"]].to_numpy())
    return pd.Series([bundle["label_map"][int(r)] for r in raw], index=rfm.index, name="cluster_id")


# --------------------------------------------------------------------------- #
# Bài toán 2: Dự báo nhu cầu (Demand Forecasting)
# Không có lệnh ghi MongoDB ở đây (lệnh ghi do src/safe_write.py đảm nhiệm).
# --------------------------------------------------------------------------- #
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
    # Chuyển đổi các cột thành dạng Categorical để đảm bảo thứ tự đúng
    src = featured_df.copy()
    src["day_of_week"] = pd.Categorical(src["day_of_week"], categories=list(range(7)))
    src["season"] = pd.Categorical(src["season"], categories=["DRY", "RAINY"])

    encoded = pd.get_dummies(
        src,
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
        r_std7 = float(np.std(q[-7:], ddof=1))
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

    - >= +15%: Tăng lượng 
    - <= -15%: Giảm lượng
    - Còn lại: Giữ nguyên
    """
    diff_pct = (predicted_qty - baseline_qty) / np.maximum(1e-6, baseline_qty)
    tags = pd.Series("Giữ nguyên", index=predicted_qty.index)
    tags[diff_pct >= 0.15] = "Tăng lượng"
    tags[diff_pct <= -0.15] = "Giảm lượng"
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
    from bson import ObjectId  # import muộn để phần Clustering không cần pymongo

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

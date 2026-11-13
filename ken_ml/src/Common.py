"""Hàm dùng chung cho Bài toán 3 (phân nhóm khách + gợi ý theo cụm).

File này giúp 3 script (train, run, test) tính RFM, gợi ý và đặt tên cụm
CHÍNH XÁC GIỐNG NHAU. Không có lệnh ghi MongoDB ở đây.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT_DIR / "data" / "master_ken_data.csv"
MODEL_PATH = ROOT_DIR / "models" / "kmeans_cluster.joblib"
OUTPUT_DIR = ROOT_DIR / "outputs"

FEATURES = ["R", "F", "M"]
TOP_N = 5  # số món gợi ý cho mỗi cụm


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
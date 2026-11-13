"""
Bài toán 1: Gợi ý xu hướng chung (Global Trending, Popularity-based)

Đọc data/master_ken_data.csv, tính Trending Score cho từng món F&B (có Time Decay),
xếp hạng Top-K và ghi vào collection ml_global_trending qua safe_write.replace_collection.

Mặc định là CHẠY THỬ (dry-run): chỉ in kết quả, không ghi DB. Ghi thật khi thêm --write.

    python src/02_task1_trending.py                 # chạy thử
    python src/02_task1_trending.py --h 7 --alpha 0.6
    python src/02_task1_trending.py --write         # ghi thật (chỉ sau khi đã xem mẫu và báo nhóm)

Công thức (mục 2.2.1 và 3.6 của báo cáo):
    Δ_j        = REFERENCE_DATE − sale_date_j (ngày)
    w(Δ)       = 2^(−Δ/h)
    Q_i        = Σ_j quantity_ij · w(Δ_j)          R_i = Σ_j line_total_vnd_ij · w(Δ_j)
    Q_norm,i   = Q_i / max_k Q_k                   R_norm,i = R_i / max_k R_k
    Trending_i = α · Q_norm,i + (1 − α) · R_norm,i
"""
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "master_ken_data.csv"

H_DEFAULT = 14        # chu kỳ bán rã (ngày), hợp vòng đời trend đồ uống; thử thêm 7 và 28
ALPHA_DEFAULT = 0.5   # trọng số số lượng so với doanh thu
COLLECTION = "ml_global_trending"

REQUIRED_COLS = ["sale_date", "item_code", "item_name", "item_type", "category",
                 "quantity", "line_total_vnd", "is_inclusion", "order_code"]


# ---------------------------------------------------------------- đọc dữ liệu
def load_data(path=CSV_PATH) -> pd.DataFrame:
    """Đọc CSV (chỉ đọc, không sửa file gốc)."""
    df = pd.read_csv(path, dtype={"order_code": str, "booking_id": str, "customer_id": str,
                                  "item_id": str, "item_code": str})
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        sys.exit(f"Thiếu cột trong {path}: {missing}")
    df["sale_date"] = pd.to_datetime(df["sale_date"])
    return df


def reference_date(df: pd.DataFrame) -> pd.Timestamp:
    """Mốc tham chiếu chung của 3 bài: max(sale_date) + 1 ngày (dữ liệu bị đóng băng)."""
    return df["sale_date"].max() + pd.Timedelta(days=1)


# ---------------------------------------------------------------- tính điểm
def compute_trending(df: pd.DataFrame, ref_date: pd.Timestamp,
                     h: float = H_DEFAULT, alpha: float = ALPHA_DEFAULT) -> pd.DataFrame:
    """Trả về bảng mỗi dòng một món, đã sắp xếp giảm dần theo trending_score.

    - Loại dòng quyền lợi (is_inclusion == 1), nếu không WATER_BOTTLE đứng hạng 1 chỉ vì là nước tặng kèm.
    - Giữ cả khách vãng lai.
    """
    if h <= 0:
        raise ValueError("h phải > 0")
    if not 0 <= alpha <= 1:
        raise ValueError("alpha phải thuộc [0, 1]")

    d = df[df["is_inclusion"] == 0].copy()
    d = d[d["sale_date"] < ref_date]                      # không dùng dữ liệu sau mốc tham chiếu
    delta = (ref_date - d["sale_date"]).dt.days.astype(float)
    w = np.power(2.0, -delta / h)

    d["q_weighted"] = d["quantity"] * w
    d["r_weighted"] = d["line_total_vnd"] * w

    g = d.groupby("item_code").agg(
        item_name=("item_name", "first"),
        item_type=("item_type", "first"),
        category=("category", "first"),
        qty_raw=("quantity", "sum"),
        Q=("q_weighted", "sum"),
        R=("r_weighted", "sum"),
    )
    q_max, r_max = g["Q"].max(), g["R"].max()
    g["Q_norm"] = g["Q"] / q_max if q_max > 0 else 0.0
    g["R_norm"] = g["R"] / r_max if r_max > 0 else 0.0
    g["trending_score"] = alpha * g["Q_norm"] + (1 - alpha) * g["R_norm"]

    g = g.reset_index().sort_values(["trending_score", "item_code"], ascending=[False, True]).reset_index(drop=True)
    g["rank"] = np.arange(1, len(g) + 1)
    g["rank_in_type"] = g.groupby("item_type").cumcount() + 1
    return g


def bestseller_baseline(df: pd.DataFrame, ref_date: pd.Timestamp) -> pd.DataFrame:
    """Mốc đối chứng: bán chạy nhất toàn kỳ (chỉ tổng số lượng, không Time Decay, không doanh thu)."""
    d = df[(df["is_inclusion"] == 0) & (df["sale_date"] < ref_date)]
    g = d.groupby("item_code", as_index=False)["quantity"].sum().sort_values(
        ["quantity", "item_code"], ascending=[False, True]).reset_index(drop=True)
    g["rank"] = np.arange(1, len(g) + 1)
    return g


# ---------------------------------------------------------------- kiểm định
def hit_rate_at_k(df: pd.DataFrame, cutoff: str, test_end: str, k: int = 5,
                  h: float = H_DEFAULT, alpha: float = ALPHA_DEFAULT) -> dict:
    """Hit Rate@K theo thời gian: tính danh sách bằng dữ liệu đến `cutoff`, kiểm tra trên các đơn
    từ ngày sau cutoff đến test_end. Một đơn là 'trúng' nếu có ít nhất một món (không phải quyền lợi)
    nằm trong Top-K. Trả về cả Trending (có Time Decay) và mốc bán chạy nhất toàn kỳ."""
    cutoff, test_end = pd.Timestamp(cutoff), pd.Timestamp(test_end)
    train = df[df["sale_date"] <= cutoff]
    test = df[(df["sale_date"] > cutoff) & (df["sale_date"] <= test_end) & (df["is_inclusion"] == 0)]
    ref = cutoff + pd.Timedelta(days=1)

    top_trend = set(compute_trending(train, ref, h, alpha).head(k)["item_code"])
    top_base = set(bestseller_baseline(train, ref).head(k)["item_code"])

    items_per_order = test.groupby("order_code")["item_code"].apply(set)
    n = len(items_per_order)
    hit_t = sum(1 for s in items_per_order if s & top_trend)
    hit_b = sum(1 for s in items_per_order if s & top_base)
    prec_t = np.mean([len(s & top_trend) / k for s in items_per_order])
    prec_b = np.mean([len(s & top_base) / k for s in items_per_order])
    return {"k": k, "h": h, "alpha": alpha, "n_orders_test": n,
            "hit_rate_trending": hit_t / n if n else np.nan, "hit_rate_baseline": hit_b / n if n else np.nan,
            "precision_trending": prec_t, "precision_baseline": prec_b,
            "top_trending": sorted(top_trend), "top_baseline": sorted(top_base)}


# ---------------------------------------------------------------- tài liệu ghi vào MongoDB
def build_docs(ranked: pd.DataFrame, now=None) -> list:
    """Chuyển bảng xếp hạng thành danh sách document đúng cấu trúc ml_global_trending.
    updated_at là datetime (không phải chuỗi); batch_id do safe_write tự thêm."""
    now = now or datetime.now(timezone.utc)
    return [{
        "item_code": r.item_code,
        "item_name": r.item_name,
        "item_type": r.item_type,
        "category": r.category,
        "rank": int(r.rank),
        "rank_in_type": int(r.rank_in_type),
        "trending_score": round(float(r.trending_score), 6),
        "updated_at": now,
    } for r in ranked.itertuples(index=False)]


# ---------------------------------------------------------------- main
def main():
    from safe_write import build_parser, replace_collection   # mọi lệnh ghi nằm trong safe_write.py

    parser = build_parser("Bài 1: Trending")
    parser.add_argument("--csv", default=str(CSV_PATH), help="đường dẫn master_ken_data.csv")
    parser.add_argument("--h", type=float, default=H_DEFAULT, help="chu kỳ bán rã Time Decay (ngày)")
    parser.add_argument("--alpha", type=float, default=ALPHA_DEFAULT, help="trọng số số lượng (0..1)")
    parser.add_argument("--show", type=int, default=12, help="số món in ra terminal")
    args = parser.parse_args()

    df = load_data(args.csv)
    ref = reference_date(df)
    ranked = compute_trending(df, ref, h=args.h, alpha=args.alpha)

    print(f"REFERENCE_DATE = {ref.date()}  (dữ liệu bị đóng băng ở {(ref - pd.Timedelta(days=1)).date()})")
    print(f"h = {args.h} ngày, alpha = {args.alpha}; {len(ranked)} món (đã loại dòng quyền lợi)\n")
    with pd.option_context("display.width", 140, "display.float_format", "{:.4f}".format):
        print(ranked.head(args.show)[["rank", "rank_in_type", "item_code", "item_name", "item_type",
                                      "qty_raw", "Q_norm", "R_norm", "trending_score"]].to_string(index=False))

    docs = build_docs(ranked)
    try:
        from database import get_database
        db = get_database()
    except Exception as e:           # dry-run vẫn chạy được khi chưa kết nối DB
        if args.write:
            sys.exit(f"Không kết nối được MongoDB, không ghi: {e}")
        db = None
        print(f"\n(chạy thử, chưa kết nối DB: {e})")
    replace_collection(db, COLLECTION, docs, write=args.write)
    if not args.write:
        print("\nĐây là chạy thử. Thêm --write để ghi thật vào", COLLECTION)


if __name__ == "__main__":
    main()

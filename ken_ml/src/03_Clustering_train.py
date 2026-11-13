"""Bài toán 3 - HUẤN LUYỆN: phân cụm khách (K-Means trên RFM) -> models/kmeans_cluster.joblib.

Luồng: CSV -> RFM (khách đăng nhập) -> thử K = 2..8 (Elbow + Silhouette) -> chọn K -> train
       -> đánh số lại cụm -> đặt tên persona gợi ý -> gợi ý theo cụm -> đánh giá Hit Rate@K
       -> lưu mô hình và các file kết quả/biểu đồ vào outputs/ cho báo cáo.

File này CHỈ ĐỌC CSV, KHÔNG kết nối và KHÔNG ghi MongoDB. Ghi DB do 03_Clustering_run.py làm.

Chạy:  python src/03_Clustering_train.py
       python src/03_Clustering_train.py --k 4        # ép số cụm
       python src/03_Clustering_train.py --log        # dùng log1p trước khi chuẩn hóa (đề xuất của hợp đồng dữ liệu)
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # thư mục src/
sys.path.insert(0, str(Path(__file__).resolve().parent)) 
from datetime import datetime, timezone

import joblib
import matplotlib

matplotlib.use("Agg")  # vẽ ra file, không cần giao diện
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import sklearn  # noqa: E402
from sklearn.cluster import KMeans  # noqa: E402
from sklearn.metrics import silhouette_score  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import FunctionTransformer, StandardScaler  # noqa: E402

from Common import (  # noqa: E402
    DATA_CSV, FEATURES, MODEL_PATH, OUTPUT_DIR, TOP_N, build_rfm, cluster_recommendations,
    load_data, predict_cluster_ids, profile_clusters, relabel_by_spend, suggest_persona_names, top_items,
)

logger = logging.getLogger("clustering_train")

SEED = 42
K_RANGE = range(2, 9)
MIN_CLUSTER_FRACTION = 0.05   # mỗi cụm phải có ít nhất 5% số khách mới được xét chọn
TEST_DAYS = 14                # đánh giá gợi ý: 14 ngày cuối làm tập test (14/10 - 27/10)

# Sửa tên cụm tại đây SAU KHI xem outputs/cluster_profiles.csv, ví dụ {0: "Khách VIP"}.
# Khóa là ml_cluster_id (0 = nhóm chi tiêu cao nhất). Để trống thì dùng tên gợi ý tự động.
PERSONA_OVERRIDES = {
    0: "Khách thân thiết chi mạnh",
    1: "Khách quen mua đều",
    2: "Khách ngủ đông (lâu chưa quay lại)",
}


def build_pipeline(k: int, use_log: bool) -> Pipeline:
    steps = []
    if use_log:
        steps.append(("log", FunctionTransformer(np.log1p)))
    steps += [("scaler", StandardScaler()),
              ("kmeans", KMeans(n_clusters=k, n_init=20, random_state=SEED))]
    return Pipeline(steps)


def evaluate_k_range(rfm: pd.DataFrame, use_log: bool) -> pd.DataFrame:
    """Elbow (inertia) và Silhouette cho từng K."""
    rows = []
    for k in K_RANGE:
        pipe = build_pipeline(k, use_log).fit(rfm[FEATURES].to_numpy())
        scaled = pipe[:-1].transform(rfm[FEATURES].to_numpy())
        labels = pipe.predict(rfm[FEATURES].to_numpy())
        sizes = np.bincount(labels, minlength=k)
        rows.append({"k": k, "inertia": pipe.named_steps["kmeans"].inertia_,
                     "silhouette": silhouette_score(scaled, labels),
                     "min_cluster_size": int(sizes.min()),
                     "cluster_sizes": sizes.tolist()})
    return pd.DataFrame(rows)


def choose_k(scores: pd.DataFrame, n_customers: int) -> int:
    """K có Silhouette cao nhất trong các K mà cụm nhỏ nhất còn >= 5% số khách."""
    ok = scores[scores["min_cluster_size"] >= MIN_CLUSTER_FRACTION * n_customers]
    candidates = ok if len(ok) else scores
    return int(candidates.sort_values(["silhouette", "k"], ascending=[False, True]).iloc[0]["k"])


def plot_k_selection(scores: pd.DataFrame, chosen_k: int) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].plot(scores["k"], scores["inertia"], marker="o")
    axes[0].set(title="Elbow (Inertia)", xlabel="Số cụm K", ylabel="Inertia")
    axes[1].plot(scores["k"], scores["silhouette"], marker="o", color="tab:green")
    axes[1].set(title="Silhouette Score", xlabel="Số cụm K", ylabel="Silhouette")
    for ax in axes:
        ax.axvline(chosen_k, color="tab:red", linestyle="--", label=f"K chọn = {chosen_k}")
        ax.legend()
        ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "clustering_elbow_silhouette.png", dpi=150)
    plt.close(fig)


def plot_scatter3d(rfm: pd.DataFrame, labels: pd.Series, names: dict[int, str]) -> None:
    fig = plt.figure(figsize=(8, 6.5))
    ax = fig.add_subplot(111, projection="3d")
    for cid in sorted(labels.unique()):
        part = rfm[labels == cid]
        ax.scatter(part["R"], part["F"], part["M"] / 1e6, s=18, label=f"Cụm {cid}: {names[cid]}")
    ax.set(xlabel="R: số ngày chưa quay lại", ylabel="F: số booking", zlabel="M: chi tiêu F&B (triệu đồng)",
           title="Phân cụm khách hàng theo RFM")
    ax.legend(loc="upper left", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "clustering_scatter3d.png", dpi=150)
    plt.close(fig)


def evaluate_recommendations(members: pd.DataFrame, k: int, use_log: bool, max_date: pd.Timestamp) -> pd.DataFrame:
    """Hit Rate@K, Precision@K, Recall@K của gợi ý theo cụm so với gợi ý chung (Global Popularity).

    Chống rò rỉ: cụm và gợi ý chỉ tính trên dữ liệu TRƯỚC ngày test; kiểm tra trên 14 ngày cuối.
    """
    test_start = max_date - pd.Timedelta(days=TEST_DAYS - 1)
    train = members[members["sale_date"] < test_start]
    test = members[(members["sale_date"] >= test_start) & (members["is_inclusion"] == 0)]

    rfm_train = build_rfm(train, test_start)
    pipe = build_pipeline(k, use_log).fit(rfm_train[FEATURES].to_numpy())
    raw = pd.Series(pipe.predict(rfm_train[FEATURES].to_numpy()), index=rfm_train.index)
    mapping = relabel_by_spend(raw, rfm_train)
    labels = raw.map(mapping)

    recs = cluster_recommendations(train, labels, TOP_N)
    global_recs = top_items(train[train["is_inclusion"] == 0], TOP_N)

    actual = test.groupby("customer_id")["item_code"].agg(set)
    actual = actual[actual.index.isin(labels.index)]  # chỉ khách đã có trong tập train
    results = {"Gợi ý theo cụm": [], "Gợi ý chung (Global Popularity)": []}
    for customer, items in actual.items():
        for name, rec in (("Gợi ý theo cụm", recs[int(labels[customer])]),
                          ("Gợi ý chung (Global Popularity)", global_recs)):
            hits = len(set(rec) & items)
            results[name].append((hits > 0, hits / TOP_N, hits / len(items)))
    rows = []
    for name, values in results.items():
        arr = np.array(values, dtype=float)
        rows.append({"phuong_phap": name, "so_khach_kiem_tra": len(arr),
                     f"HitRate@{TOP_N}": arr[:, 0].mean(), f"Precision@{TOP_N}": arr[:, 1].mean(),
                     f"Recall@{TOP_N}": arr[:, 2].mean()})
    return pd.DataFrame(rows).round(4)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
    parser = argparse.ArgumentParser(description="Huấn luyện K-Means (RFM) cho Bài toán 3")
    parser.add_argument("--k", type=int, default=None, help="Ép số cụm (mặc định: chọn theo Silhouette)")
    parser.add_argument("--log", action="store_true", help="Áp log1p lên R, F, M trước khi chuẩn hóa")
    args = parser.parse_args()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    # ---- 1) Dữ liệu và RFM ----
    members, reference_date = load_data(DATA_CSV)
    rfm = build_rfm(members, reference_date)
    logger.info("Khách đăng nhập: %d | ngày tham chiếu: %s | R/F/M trung vị: %s",
                len(rfm), reference_date.date(), rfm.median().round(1).to_dict())

    # ---- 2) Chọn K ----
    scores = evaluate_k_range(rfm, args.log)
    k = args.k or choose_k(scores, len(rfm))
    scores.to_csv(OUTPUT_DIR / "clustering_k_selection.csv", index=False, encoding="utf-8-sig")
    plot_k_selection(scores, k)
    logger.info("Elbow/Silhouette:\n%s", scores[["k", "inertia", "silhouette", "cluster_sizes"]].round(3).to_string(index=False))
    logger.info("Chọn K = %d%s", k, " (do --k)" if args.k else " (Silhouette cao nhất, cụm nhỏ nhất >= 5% khách)")

    # ---- 3) Train mô hình cuối trên toàn bộ khách ----
    pipeline = build_pipeline(k, args.log).fit(rfm[FEATURES].to_numpy())
    raw = pd.Series(pipeline.predict(rfm[FEATURES].to_numpy()), index=rfm.index)
    label_map = relabel_by_spend(raw, rfm)
    labels = raw.map(label_map).rename("cluster_id")
    profile = profile_clusters(rfm, members, labels)
    names = {**suggest_persona_names(profile, rfm), **PERSONA_OVERRIDES}
    recs = cluster_recommendations(members, labels, TOP_N)
    profile.insert(0, "persona_name", pd.Series(names))
    profile["recommended_item_codes"] = pd.Series({c: ", ".join(v) for c, v in recs.items()})
    logger.info("Chân dung cụm:\n%s", profile.drop(columns="recommended_item_codes").to_string())

    # ---- 4) Đánh giá gợi ý (không rò rỉ dữ liệu) ----
    evaluation = evaluate_recommendations(members, k, args.log, members["sale_date"].max())
    logger.info("Đánh giá gợi ý (test %d ngày cuối):\n%s", TEST_DAYS, evaluation.to_string(index=False))

    # ---- 5) Lưu mô hình + file kết quả ----
    bundle = {
        "pipeline": pipeline,              # Pipeline: [log1p] -> StandardScaler -> KMeans
        "features": FEATURES,
        "use_log": args.log,
        "k": k,
        "label_map": label_map,            # nhãn thô của KMeans -> ml_cluster_id (0 = chi tiêu cao nhất)
        "persona_names": names,
        "recommendations": recs,
        "reference_date": str(reference_date.date()),
        "n_customers": len(rfm),
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
    }
    joblib.dump(bundle, MODEL_PATH)

    item_names = members.drop_duplicates("item_code").set_index("item_code")["item_name"]
    rec_rows = [{"cluster_id": c, "persona_name": names[c], "rank": i + 1, "item_code": code,
                 "item_name": item_names.get(code, "")}
                for c, codes in recs.items() for i, code in enumerate(codes)]
    pd.DataFrame(rec_rows).to_csv(OUTPUT_DIR / "clustering_recommendations.csv", index=False, encoding="utf-8-sig")
    profile.to_csv(OUTPUT_DIR / "clustering_cluster_profiles.csv", encoding="utf-8-sig")
    evaluation.to_csv(OUTPUT_DIR / "clustering_hit_rate.csv", index=False, encoding="utf-8-sig")
    rfm.join(labels).to_csv(OUTPUT_DIR / "clustering_customer_clusters.csv", encoding="utf-8-sig")
    plot_scatter3d(rfm, labels, names)

    # kiểm tra nhanh: nạp lại và dự đoán phải ra đúng nhãn vừa train
    check = predict_cluster_ids(joblib.load(MODEL_PATH), rfm)
    assert (check == labels).all(), "Mô hình đã lưu dự đoán khác lúc train"
    logger.info("Đã lưu mô hình: %s", MODEL_PATH)
    logger.info("Đã lưu kết quả vào: %s (k_selection, cluster_profiles, recommendations, hit_rate, customer_clusters, 2 biểu đồ png)",
                OUTPUT_DIR)


if __name__ == "__main__":
    main()
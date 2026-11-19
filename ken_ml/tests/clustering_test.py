"""Nghiệm thu Bài 3 (KHÔNG kết nối MongoDB): kiểm tra mô hình models/kmeans_cluster.joblib.

Chạy từ thư mục gốc KEN_ML:
  python tests/clustering_test.py                           # chạy bộ kiểm tra tự động + xem 3 khách mẫu
  python tests/clustering_test.py --customer-id <id>        # xem 1 khách trong CSV được xếp vào cụm nào
  python tests/clustering_test.py --rfm 5 30 2500000        # nhập thử R, F, M (ngày chưa quay lại, số booking, chi tiêu VND)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import joblib  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import silhouette_score  # noqa: E402

from Common import (  # noqa: E402
    DATA_CSV, MODEL_PATH, TOP_N, build_rfm, cluster_recommendations, load_data, predict_cluster_ids,
)

failures: list[str] = []


def check(ok: bool, name: str, detail: str = "") -> None:
    print(f"  [{'OK  ' if ok else 'LỖI '}] {name}" + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def describe(bundle: dict, rfm_row: pd.DataFrame, item_names: pd.Series, title: str) -> None:
    cid = int(predict_cluster_ids(bundle, rfm_row).iloc[0])
    r, f, m = rfm_row.iloc[0][bundle["features"]]
    print(f"\n  {title}: R={r:.0f} ngày, F={f:.0f} booking, M={m:,.0f} đ")
    print(f"    -> cụm {cid}: {bundle['persona_names'][cid]}")
    print("    -> gợi ý: " + ", ".join(f"{c} ({item_names.get(c, '?')})" for c in bundle["recommendations"][cid]))


def run_checks(bundle: dict, members: pd.DataFrame, rfm: pd.DataFrame) -> None:
    k = bundle["k"]
    print("\n1) Cấu trúc mô hình")
    check(set(bundle) >= {"pipeline", "features", "k", "label_map", "persona_names", "recommendations", "reference_date"},
          "bundle có đủ khóa")
    check(bundle["features"] == ["R", "F", "M"], "đặc trưng là R, F, M")
    check(sorted(bundle["label_map"].values()) == list(range(k)), f"nhãn cụm là 0..{k - 1}")
    check(set(bundle["persona_names"]) == set(range(k)), "mỗi cụm có tên persona")

    print("\n2) Dự đoán trên các khách trong CSV")
    labels = predict_cluster_ids(bundle, rfm)
    check(len(labels) == bundle["n_customers"], "số khách khớp lúc train", f"{len(labels)} khách")
    check(set(labels.unique()) == set(range(k)), "không có cụm rỗng", str(labels.value_counts().sort_index().to_dict()))
    check((predict_cluster_ids(bundle, rfm) == labels).all(), "dự đoán lặp lại cho kết quả giống nhau")
    mean_m = rfm.groupby(labels)["M"].mean().sort_index()
    check(mean_m.is_monotonic_decreasing, "cụm 0 = chi tiêu cao nhất, giảm dần theo số cụm",
          ", ".join(f"{c}:{v:,.0f}" for c, v in mean_m.items()))
    pipe = bundle["pipeline"]
    x = rfm[bundle["features"]].to_numpy()
    score = silhouette_score(pipe[:-1].transform(x), pipe.predict(x))
    check(score > 0.25, "Silhouette > 0,25", f"{score:.3f}")

    print("\n3) Khách điển hình phải vào đúng cụm")
    heavy = pd.DataFrame([[1.0, 100.0, 9_000_000.0]], columns=bundle["features"])
    check(int(predict_cluster_ids(bundle, heavy).iloc[0]) == 0, "khách rất thân thiết (R=1, F=100, M=9 triệu) -> cụm 0")
    r_mean = rfm.groupby(labels)["R"].mean()
    dormant = pd.DataFrame([[180.0, 5.0, 500_000.0]], columns=bundle["features"])
    check(int(predict_cluster_ids(bundle, dormant).iloc[0]) == int(r_mean.idxmax()),
          f"khách lâu không quay lại (R=180) -> cụm có R trung bình lớn nhất ({int(r_mean.idxmax())})")

    print("\n4) Gợi ý theo cụm")
    valid_items = set(members.loc[members["is_inclusion"] == 0, "item_code"])
    for cid, items in bundle["recommendations"].items():
        check(len(items) == TOP_N and len(set(items)) == TOP_N, f"cụm {cid} có {TOP_N} món khác nhau")
        check(set(items) <= valid_items, f"cụm {cid}: món đều là F&B khách chủ động mua (không INCLUSION)")
    fresh = cluster_recommendations(members, labels, TOP_N)
    check(fresh == bundle["recommendations"], "gợi ý lưu trong mô hình khớp tính lại từ CSV hiện tại",
          "nếu LỖI: CSV đã đổi sau khi train, hãy chạy lại 03_Clustering_train.py")


def main() -> int:
    parser = argparse.ArgumentParser(description="Nghiệm thu mô hình Bài 3 (không chạm DB)")
    parser.add_argument("--customer-id", help="customer_id (chuỗi ObjectId) trong CSV")
    parser.add_argument("--rfm", nargs=3, type=float, metavar=("R", "F", "M"), help="nhập thử R F M")
    args = parser.parse_args()

    if not MODEL_PATH.exists():
        print(f"Chưa có {MODEL_PATH}. Chạy trước: python src/train/03_Clustering_train.py")
        return 1
    bundle = joblib.load(MODEL_PATH)
    members, reference_date = load_data(DATA_CSV)
    rfm = build_rfm(members, reference_date)
    item_names = members.drop_duplicates("item_code").set_index("item_code")["item_name"]
    print(f"Mô hình: K={bundle['k']} | train lúc {bundle['trained_at']} | ngày tham chiếu {bundle['reference_date']}")

    if args.rfm:
        describe(bundle, pd.DataFrame([args.rfm], columns=bundle["features"]), item_names, "Giá trị nhập tay")
        return 0
    if args.customer_id:
        if args.customer_id not in rfm.index:
            print(f"Không thấy customer_id này trong CSV (khách vãng lai hoặc sai mã): {args.customer_id}")
            return 1
        describe(bundle, rfm.loc[[args.customer_id]], item_names, f"Khách {args.customer_id}")
        return 0

    run_checks(bundle, members, rfm)
    print("\n5) Ba khách mẫu (mỗi cụm một khách có RFM gần tâm cụm nhất)")
    labels = predict_cluster_ids(bundle, rfm)
    for cid in range(bundle["k"]):
        part = rfm[labels == cid]
        spread = part.std().replace(0, 1)
        nearest = (((part - part.median()) / spread) ** 2).sum(axis=1).idxmin()
        describe(bundle, rfm.loc[[nearest]], item_names, f"Cụm {cid} - khách {nearest}")

    print("\n" + ("KẾT QUẢ: TẤT CẢ ĐẠT" if not failures else f"KẾT QUẢ: {len(failures)} KIỂM TRA LỖI -> {failures}"))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
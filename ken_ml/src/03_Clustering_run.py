"""Bài toán 3 - CHẠY: nạp mô hình đã train, gán cụm cho khách và GHI vào MongoDB.

Ghi vào 2 nơi (qua src/safe_write.py, không có lệnh ghi nào khác trong file này):
  1) ml_cluster_recommendations : mỗi cụm 1 bản ghi (cluster_id, persona_name, món gợi ý)
  2) users                      : chỉ $set 2 trường ml_cluster_id (int) và ml_cluster_updated_at

Chạy:
  python src/03_Clustering_run.py            # CHẠY THỬ (dry-run): chỉ in kết quả, KHÔNG ghi gì
  python src/03_Clustering_run.py --write    # GHI THẬT vào MongoDB

Cần có models/kmeans_cluster.joblib (tạo bằng: python src/03_Clustering_train.py).
"""
from __future__ import annotations

import logging
import re

import joblib
import pandas as pd
import sklearn

from safe_write import build_parser, now_utc, replace_collection, set_user_clusters
from Common import MODEL_PATH, TOP_N, build_rfm, cluster_recommendations, load_data, predict_cluster_ids

logger = logging.getLogger("03_Clustering_run")
OBJECT_ID = re.compile(r"^[0-9a-f]{24}$")  # customer_id trong CSV là chuỗi ObjectId


def load_bundle() -> dict:
    if not MODEL_PATH.exists():
        raise SystemExit(f"Chưa có mô hình {MODEL_PATH.name}. Chạy trước: python src/train/03_Clustering_train.py")
    bundle = joblib.load(MODEL_PATH)
    if bundle.get("sklearn_version") != sklearn.__version__:
        logger.warning("Mô hình train bằng scikit-learn %s, đang chạy %s: nếu lỗi hãy train lại.",
                       bundle.get("sklearn_version"), sklearn.__version__)
    return bundle


def connect(write: bool):
    """Kết nối MongoDB. Chạy thử mà không có mạng thì vẫn cho chạy offline; ghi thật thì dừng hẳn."""
    from database import get_database  # import muộn: chỉ cần khi thực sự kết nối

    try:
        return get_database()
    except (ConnectionError, RuntimeError) as exc:
        if write:
            raise SystemExit(f"Không kết nối được MongoDB, dừng và KHÔNG ghi gì: {exc}")
        logger.warning("Không kết nối được MongoDB, chạy thử offline (bỏ qua bước đối chiếu users): %s", exc)
        return None


def count_matching_users(db, customer_ids) -> int:
    """Đếm (chỉ đọc) số customer_id có thật trong users với role CUSTOMER."""
    from bson import ObjectId

    object_ids = [ObjectId(c) for c in customer_ids]
    return db["users"].count_documents({"_id": {"$in": object_ids}, "role": "CUSTOMER"})


def verify_written(db, labels: pd.Series) -> None:
    """Đọc lại sau khi ghi để chắc chắn số liệu trong DB khớp."""
    expected = labels.value_counts().sort_index()
    in_db = db["users"].count_documents({"ml_cluster_id": {"$exists": True}})
    logger.info("Kiểm tra sau ghi: users có ml_cluster_id = %d (kỳ vọng %d)", in_db, len(labels))
    for cid, n in expected.items():
        got = db["users"].count_documents({"ml_cluster_id": int(cid)})
        logger.info("  cụm %d: %d khách (kỳ vọng %d) -> %s", cid, got, n, "OK" if got == n else "LỆCH")
    logger.info("Kiểm tra sau ghi: ml_cluster_recommendations có %d bản ghi",
                db["ml_cluster_recommendations"].count_documents({}))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
    args = build_parser("Bài 3: gán cụm khách và ghi gợi ý theo cụm vào MongoDB").parse_args()

    bundle = load_bundle()
    members, reference_date = load_data()
    rfm = build_rfm(members, reference_date)
    if str(reference_date.date()) != bundle["reference_date"]:
        logger.warning("Ngày tham chiếu hiện tại %s khác lúc train %s (CSV đã đổi?). Nên train lại.",
                       reference_date.date(), bundle["reference_date"])

    # ---- Dự đoán cụm và dựng dữ liệu sẽ ghi ----
    labels = predict_cluster_ids(bundle, rfm)
    bad_ids = [c for c in labels.index if not OBJECT_ID.match(str(c))]
    if bad_ids:
        raise SystemExit(f"{len(bad_ids)} customer_id không phải ObjectId hợp lệ, dừng: {bad_ids[:3]}")
    recs = cluster_recommendations(members, labels, TOP_N)
    counts = labels.value_counts().sort_index()
    names = bundle["persona_names"]
    stamp = now_utc()
    docs = [{"cluster_id": int(cid), "persona_name": names[int(cid)], "recommended_item_codes": recs[int(cid)],
             "customer_count": int(counts.get(cid, 0)), "updated_at": stamp} for cid in sorted(recs)]

    logger.info("Chế độ: %s | khách: %d | số cụm: %d | ngày tham chiếu: %s",
                "GHI THẬT" if args.write else "CHẠY THỬ (dry-run)", len(labels), len(docs), reference_date.date())
    for doc in docs:
        logger.info("  cụm %d | %-38s | %3d khách | gợi ý: %s", doc["cluster_id"], doc["persona_name"],
                    doc["customer_count"], ", ".join(doc["recommended_item_codes"]))

    # ---- Đối chiếu users trong DB (chỉ đọc) ----
    db = connect(args.write)
    if db is not None:
        matched = count_matching_users(db, labels.index)
        logger.info("Khớp %d/%d khách với users (role CUSTOMER) trong MongoDB", matched, len(labels))
        if matched != len(labels):
            message = "Có customer_id không khớp users trong DB: kiểm tra đúng database/dữ liệu đã nạp chưa."
            if args.write:
                raise SystemExit(message + " Dừng và KHÔNG ghi gì.")
            logger.warning(message)

    # ---- Ghi (mọi lệnh ghi đi qua safe_write; không có --write thì chỉ in) ----
    replace_collection(db, "ml_cluster_recommendations", docs, write=args.write)
    set_user_clusters(db, labels.to_dict(), write=args.write)

    if args.write:
        verify_written(db, labels)
        logger.info("XONG. Hoàn tác nếu cần: xóa collection ml_cluster_recommendations và gọi safe_write.clear_user_clusters(db, write=True).")
    else:
        logger.info("CHẠY THỬ xong, chưa ghi gì. Chạy lại với --write để ghi thật.")


if __name__ == "__main__":
    main()
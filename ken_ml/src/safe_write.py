"""Lớp ghi AN TOÀN vào MongoDB cho 3 bài toán ML (src/safe_write.py).

QUY TẮC CHUNG
- Mọi lệnh GHI vào MongoDB (insert / update / delete) CHỈ được nằm trong file này.
  Các script 01-04 đọc bằng find() và gọi các hàm dưới đây để ghi.
- Mặc định là DRY-RUN: chỉ in ra những gì SẼ ghi. Muốn ghi thật phải chạy script với cờ --write.
- Chỉ ghi được vào: ml_global_trending, ml_cluster_recommendations, demand_forecasts
  và đúng 2 trường ml_cluster_id, ml_cluster_updated_at của users.
- Không bao giờ xóa/ghi đè các collection của KÉN (bookings, sales_transactions, ...).
"""
from __future__ import annotations

import argparse
import logging
from datetime import datetime, timezone

logger = logging.getLogger("safe_write")

REPLACEABLE = {"ml_global_trending", "ml_cluster_recommendations"}  # thay toàn bộ nội dung mỗi lần chạy
FORECAST_COLLECTION = "demand_forecasts"                            # upsert theo khóa duy nhất của DB
# Trường được phép theo validator hiện tại của demand_forecasts.
# Nếu nhóm cập nhật validator để thêm action_tag thì thêm "action_tag" vào tập này.
FORECAST_FIELDS = {"item_id", "item_code", "forecast_date", "predicted_qty",
                   "lower_qty", "upper_qty", "model_version", "generated_at"}
FORECAST_REQUIRED = ("item_id", "item_code", "forecast_date", "predicted_qty", "model_version", "generated_at")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def build_parser(description: str) -> argparse.ArgumentParser:
    """Parser chuẩn cho script 02-04: mặc định chạy thử, thêm --write mới ghi thật."""
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--write", action="store_true",
                        help="Ghi thật vào MongoDB (mặc định: chỉ chạy thử, không ghi)")
    return parser


def _native(value):
    """Đổi kiểu numpy/pandas sang kiểu Python thuần (PyMongo không mã hóa được numpy.int64...)."""
    if isinstance(value, dict):
        return {k: _native(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_native(v) for v in value]
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        try:
            return value.item()
        except (ValueError, AttributeError):
            return value
    return value


def _preview(target: str, docs: list, write: bool) -> None:
    mode = "GHI THẬT" if write else "DRY-RUN (không ghi gì)"
    logger.info("[%s] %s: %d bản ghi | mẫu đầu: %s", mode, target, len(docs), docs[0] if docs else None)


def replace_collection(db, name: str, docs: list[dict], *, write: bool = False) -> int:
    """Thay toàn bộ nội dung 1 collection kết quả ML (ml_global_trending / ml_cluster_recommendations).

    An toàn: thêm đợt mới TRƯỚC, rồi mới xóa các đợt cũ, nên nếu insert lỗi thì dữ liệu cũ còn nguyên.
    """
    if name not in REPLACEABLE:
        raise PermissionError(f"Không được ghi đè collection '{name}'. Chỉ được phép: {sorted(REPLACEABLE)}")
    if not docs:
        raise ValueError("Danh sách kết quả rỗng: dừng lại để không xóa mất dữ liệu cũ.")
    batch_id = now_utc().strftime("%Y%m%dT%H%M%SZ")
    docs = [{**_native(d), "batch_id": batch_id} for d in docs]
    _preview(name, docs, write)
    if not write:
        return 0
    coll = db[name]
    coll.insert_many(docs)
    deleted = coll.delete_many({"batch_id": {"$ne": batch_id}}).deleted_count
    logger.info("  đã ghi %d bản ghi mới (batch %s), xóa %d bản ghi của đợt cũ", len(docs), batch_id, deleted)
    return len(docs)


def upsert_forecasts(db, docs: list[dict], *, write: bool = False) -> int:
    """Ghi dự báo vào demand_forecasts bằng upsert theo (item_code, forecast_date, model_version).

    Chạy lại nhiều lần không bị trùng khóa. Kiểm tra đúng validator của DB trước khi ghi.
    """
    if not docs:
        raise ValueError("Danh sách dự báo rỗng.")
    docs = [_native(d) for d in docs]
    for d in docs:
        missing = [k for k in FORECAST_REQUIRED if k not in d]
        extra = sorted(set(d) - FORECAST_FIELDS)
        if missing:
            raise ValueError(f"demand_forecasts thiếu trường bắt buộc {missing}: {d}")
        if extra:
            raise ValueError(f"demand_forecasts không cho phép trường {extra} (validator additionalProperties=false)")
        if type(d["item_id"]).__name__ != "ObjectId":
            raise TypeError("item_id phải là ObjectId: dùng bson.ObjectId(item_id) từ cột item_id của CSV")
        if not isinstance(d["forecast_date"], datetime) or not isinstance(d["generated_at"], datetime):
            raise TypeError("forecast_date và generated_at phải là datetime")
        if d["predicted_qty"] < 0:
            raise ValueError(f"predicted_qty phải >= 0: {d}")
    _preview(FORECAST_COLLECTION, docs, write)
    if not write:
        return 0
    coll = db[FORECAST_COLLECTION]
    for d in docs:
        key = {k: d[k] for k in ("item_code", "forecast_date", "model_version")}
        coll.update_one(key, {"$set": d}, upsert=True)
    logger.info("  đã upsert %d dự báo vào %s", len(docs), FORECAST_COLLECTION)
    return len(docs)


def set_user_clusters(db, labels: dict[str, int], *, write: bool = False) -> int:
    """Gắn nhãn cụm cho khách: CHỈ $set 2 trường ml_cluster_id (int) và ml_cluster_updated_at.

    labels: {customer_id (chuỗi ObjectId trong CSV): nhãn cụm (số nguyên)}.
    Chỉ tác động tài khoản role = CUSTOMER; không đụng password, email, tier... của users.
    """
    if not labels:
        raise ValueError("Không có nhãn cụm nào để ghi.")
    clean = {str(cid): int(label) for cid, label in labels.items()}
    stamp = now_utc()
    _preview("users.ml_cluster_id", [{"customer_id": c, "ml_cluster_id": k} for c, k in list(clean.items())[:3]], write)
    if not write:
        return 0
    from bson import ObjectId  # import muộn để chế độ dry-run không cần kết nối

    matched = 0
    for cid, label in clean.items():
        res = db["users"].update_one(
            {"_id": ObjectId(cid), "role": "CUSTOMER"},
            {"$set": {"ml_cluster_id": label, "ml_cluster_updated_at": stamp}},
        )
        matched += res.matched_count
    if matched != len(clean):
        logger.warning("  chỉ khớp %d/%d khách (kiểm tra customer_id)", matched, len(clean))
    logger.info("  đã gắn nhãn cụm cho %d khách", matched)
    return matched


def clear_user_clusters(db, *, write: bool = False) -> int:
    """ROLLBACK: gỡ 2 trường ml_* khỏi users (đưa users về như trước khi chạy Bài 3)."""
    logger.info("[%s] gỡ ml_cluster_id và ml_cluster_updated_at khỏi users", "GHI THẬT" if write else "DRY-RUN")
    if not write:
        return 0
    res = db["users"].update_many(
        {"ml_cluster_id": {"$exists": True}},
        {"$unset": {"ml_cluster_id": "", "ml_cluster_updated_at": ""}},
    )
    return res.modified_count
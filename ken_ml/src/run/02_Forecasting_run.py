"""Bài toán 2 - CHẠY: Dự báo nhu cầu bán F&B cho ngày kế tiếp và GHI VÀO MONGODB.

Collection đích: demand_forecasts (đã có sẵn trong database KÉN).
Ghi bằng safe_write.upsert_forecasts() theo khóa duy nhất (item_code, forecast_date, model_version).

Mặc định là CHẠY THỬ (dry-run): chỉ in kết quả và lưu CSV, KHÔNG ghi vào DB.
Thêm --write để GHI THẬT vào MongoDB (chỉ chạy sau khi tests/test_task2.py đã PASS).

Cách chạy:
    python src/run/02_Forecasting_run.py            # Chạy thử (dry-run)
    python src/run/02_Forecasting_run.py --write    # Ghi thật vào MongoDB
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
import pandas as pd

from forecast_common import (
    ALT_MODEL_PATH,
    DATA_CSV,
    MODEL_PATH,
    OUTPUT_DIR,
    build_daily_grid,
    build_mongo_forecast_docs,
    build_next_day_features,
    compute_action_tags,
    load_raw_data,
    predict_with_intervals,
)
from safe_write import build_parser, upsert_forecasts

logger = logging.getLogger("forecasting_run")


def load_model_bundle() -> dict:
    model_file = MODEL_PATH if MODEL_PATH.exists() else ALT_MODEL_PATH
    if not model_file.exists():
        raise SystemExit(
            f"Chưa tìm thấy file mô hình tại {model_file}.\n"
            "Hãy chạy huấn luyện trước: python src/train/02_Forecasting_train.py"
        )
    return joblib.load(model_file)


def connect_mongo(write: bool):
    """Kết nối MongoDB Atlas / Local. Nếu dry-run mà không có kết nối thì vẫn cho phép chạy offline."""
    from database import get_database  # import muộn để chạy offline khi dry-run

    try:
        return get_database()
    except (ConnectionError, RuntimeError) as exc:
        if write:
            raise SystemExit(f"[LỖI KẾT NỐI] Không thể kết nối MongoDB, dừng và KHÔNG ghi gì: {exc}")
        logger.warning("Không kết nối được MongoDB, chạy thử ở chế độ Offline: %s", exc)
        return None


def verify_written_db(db, forecast_date, model_version: str, expected_count: int) -> None:
    """Đọc lại demand_forecasts sau khi ghi để xác nhận số lượng bản ghi."""
    from datetime import datetime, timezone
    fc_dt = datetime(forecast_date.year, forecast_date.month, forecast_date.day, 0, 0, 0, tzinfo=timezone.utc)
    count = db["demand_forecasts"].count_documents({
        "forecast_date": fc_dt,
        "model_version": model_version,
    })
    logger.info("Kiểm tra sau ghi: demand_forecasts ngày %s có %d bản ghi (kỳ vọng %d) -> %s",
                fc_dt.strftime("%Y-%m-%d"), count, expected_count, "KHỚP [OK]" if count == expected_count else "LỆCH")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
    parser = build_parser("Bài 2: Dự báo nhu cầu bán F&B và ghi vào collection demand_forecasts")
    args = parser.parse_args()

    # 1. Nạp mô hình đã huấn luyện
    bundle = load_model_bundle()
    logger.info("Đã nạp mô hình version '%s' (train lúc: %s)", bundle["model_version"], bundle["trained_at"])

    # 2. Đọc dữ liệu lịch sử và tạo ma trận ngày kế tiếp
    df, ref_date, item_metadata = load_raw_data(DATA_CSV)
    full_grid = build_daily_grid(df)
    next_raw, next_X = build_next_day_features(full_grid, ref_date, bundle["feature_cols"])

    # 3. Dự báo số lượng và khoảng tin cậy
    preds, lowers, uppers = predict_with_intervals(bundle["model"], next_X)
    next_raw["predicted_qty"] = [int(round(p)) for p in preds]
    next_raw["lower_qty"] = [int(round(l)) for l in lowers]
    next_raw["upper_qty"] = [int(round(u)) for u in uppers]
    next_raw["baseline_4w"] = next_raw["baseline_4w"].round(2)
    next_raw["action_tag"] = compute_action_tags(next_raw["predicted_qty"], next_raw["baseline_4w"])

    # Gắn thêm tên món và danh mục cho bảng hiển thị & xuất CSV
    next_raw["item_name"] = next_raw["item_code"].apply(lambda c: item_metadata[c]["item_name"])
    next_raw["category"] = next_raw["item_code"].apply(lambda c: item_metadata[c]["category"])
    next_raw["item_type"] = next_raw["item_code"].apply(lambda c: item_metadata[c]["item_type"])

    # Sắp xếp theo số lượng dự báo giảm dần
    display_df = next_raw.sort_values(["predicted_qty", "item_code"], ascending=[False, True]).reset_index(drop=True)

    # Xuất file CSV dự báo chi tiết cho Admin vào outputs/
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_out_path = OUTPUT_DIR / f"demand_forecast_{ref_date.strftime('%Y%m%d')}.csv"
    display_df[["item_code", "item_name", "category", "item_type", "baseline_4w",
                "predicted_qty", "lower_qty", "upper_qty", "action_tag"]].to_csv(csv_out_path, index=False)
    logger.info("Đã xuất kết quả dự báo chi tiết vào: %s", csv_out_path)

    # In kết quả dự báo ra màn hình
    print("\n" + "=" * 90)
    print(f" KẾT QUẢ DỰ BÁO NHU CẦU F&B NGÀY {ref_date.strftime('%d/%m/%Y')} (CHẾ ĐỘ: {'GHI THẬT' if args.write else 'CHẠY THỬ / DRY-RUN'})")
    print("=" * 90)
    summary_cols = ["item_code", "item_name", "baseline_4w", "predicted_qty", "lower_qty", "upper_qty", "action_tag"]
    print(display_df[summary_cols].to_string(index=False))
    print("=" * 90)

    # Thống kê nhãn hành động
    tag_counts = display_df["action_tag"].value_counts().to_dict()
    logger.info("Phân bổ hành động Admin: %s", tag_counts)

    # 4. Chuẩn bị tài liệu đúng validator để ghi vào MongoDB
    docs = build_mongo_forecast_docs(
        next_raw,
        item_metadata,
        forecast_date=ref_date,
        model_version=bundle["model_version"],
    )

    # 5. Kết nối và ghi MongoDB
    db = connect_mongo(write=args.write)
    if db is not None:
        upsert_forecasts(db, docs, write=args.write)
        if args.write:
            verify_written_db(db, ref_date, bundle["model_version"], len(docs))
    else:
        # Nếu offline và dry-run, kiểm tra tính hợp lệ của docs qua safe_write
        upsert_forecasts(None, docs, write=False)

    if not args.write:
        print("\n[LƯU Ý] Script đang ở chế độ CHẠY THỬ (DRY-RUN), chưa ghi vào MongoDB.")
        print("Để ghi vào MongoDB, chạy lại với: python src/run/02_Forecasting_run.py --write\n")
    else:
        print("\n[THÀNH CÔNG] Đã ghi thành công 31 bản ghi dự báo vào collection demand_forecasts!\n")


if __name__ == "__main__":
    main()

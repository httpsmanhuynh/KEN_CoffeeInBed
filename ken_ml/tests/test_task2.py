"""Kiểm thử tự động cho Bài toán 2: Dự báo nhu cầu (Demand Forecasting).

File này KHÔNG ghi vào MongoDB (chỉ kiểm tra logic, mô hình, schema document).
Chạy kiểm tra này trước khi chạy src/run/02_Forecasting_run.py với cờ --write.

Chạy từ thư mục gốc ken_ml:
    python tests/test_task2.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT_DIR / "src"
for p in [str(SRC_DIR), str(ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import joblib
import numpy as np
import pandas as pd
from bson import ObjectId
from sklearn.ensemble import RandomForestRegressor

from forecast_common import (
    ALT_MODEL_PATH,
    DATA_CSV,
    FORECAST_FIELDS,
    FORECAST_REQUIRED,
    MODEL_PATH,
    MODEL_VERSION,
    build_daily_grid,
    build_mongo_forecast_docs,
    build_next_day_features,
    compute_action_tags,
    load_raw_data,
    predict_with_intervals,
)
from safe_write import FORECAST_FIELDS as SAFE_WRITE_FIELDS, FORECAST_REQUIRED as SAFE_WRITE_REQUIRED

failures: list[str] = []


def check(ok: bool, name: str, detail: str = "") -> None:
    """In kết quả kiểm tra dạng [OK  ] hoặc [LỖI ]."""
    status = "OK  " if ok else "LỖI "
    extra = f"  ({detail})" if detail else ""
    print(f"  [{status}] {name}{extra}")
    if not ok:
        failures.append(name)


def run_tests() -> int:
    print("\n" + "=" * 65)
    print(" BẮT ĐẦU KIỂM THỬ BÀI TOÁN 2: DEMAND FORECASTING (tests/test_task2.py)")
    print("=" * 65)

    # -------------------------------------------------------------
    # 1. Kiểm tra sự tồn tại của file mô hình
    # -------------------------------------------------------------
    print("\n1) Kiểm tra file mô hình đã lưu")
    model_file = MODEL_PATH if MODEL_PATH.exists() else ALT_MODEL_PATH
    check(model_file.exists(), f"Mô hình tồn tại tại {model_file.name}", str(model_file))
    if not model_file.exists():
        print(f"\n[LỖI NGHIÊM TRỌNG] Chưa tìm thấy mô hình. Hãy chạy trước: python src/train/02_Forecasting_train.py")
        return 1

    bundle = joblib.load(model_file)

    # -------------------------------------------------------------
    # 2. Kiểm tra cấu trúc Bundle của mô hình
    # -------------------------------------------------------------
    print("\n2) Cấu trúc Model Bundle")
    required_keys = {
        "model",
        "feature_cols",
        "metrics",
        "reference_date",
        "forecast_date",
        "item_metadata",
        "model_version",
        "sklearn_version",
    }
    check(required_keys.issubset(bundle.keys()), "Bundle chứa đầy đủ các khóa cần thiết", f"Keys: {list(bundle.keys())}")
    check(isinstance(bundle["model"], RandomForestRegressor), "Mô hình là RandomForestRegressor")
    check(bundle["model_version"] == MODEL_VERSION, f"Phiên bản mô hình khớp {MODEL_VERSION}")
    check(len(bundle["item_metadata"]) == 31, "Item metadata chứa đủ 31 món F&B")
    check(len(bundle["feature_cols"]) > 0, f"Đặc trưng đầu vào: {len(bundle['feature_cols'])} cột")

    # -------------------------------------------------------------
    # 3. Kiểm tra dữ liệu đầu vào và tạo đặc trưng
    # -------------------------------------------------------------
    print("\n3) Xử lý dữ liệu và tạo đặc trưng cho ngày dự báo (2026-10-28)")
    df, ref_date, item_metadata = load_raw_data(DATA_CSV)
    check(str(ref_date.date()) == "2026-10-28", f"REFERENCE_DATE chuẩn xác: {ref_date.date()}")
    check(len(df) == 67375, f"Tổng số dòng CSV chuẩn: {len(df):,} dòng (giữ cả vãng lai & quyền lợi)")

    full_grid = build_daily_grid(df)
    check(len(full_grid) == 6510, f"Resampling 31 món x 210 ngày = {len(full_grid):,} dòng (đầy đủ không thiếu)")

    next_raw, next_X = build_next_day_features(full_grid, ref_date, bundle["feature_cols"])
    check(len(next_raw) == 31, f"Tạo đặc trưng ngày kế tiếp đủ cho 31 món")
    check(next_X.shape[1] == len(bundle["feature_cols"]), f"Số cột đặc trưng khớp mô hình ({next_X.shape[1]} cột)")
    check(not next_X.isna().any().any(), "Không có giá trị NaN trong ma trận đặc trưng")

    # -------------------------------------------------------------
    # 4. Kiểm tra dự báo số lượng và khoảng tin cậy
    # -------------------------------------------------------------
    print("\n4) Kiểm tra tính toán dự báo & khoảng tin cậy (prediction intervals)")
    preds, lowers, uppers = predict_with_intervals(bundle["model"], next_X)

    check(len(preds) == 31, "Dự báo đúng 31 món")
    check((preds >= 0).all(), "Tất cả predicted_qty >= 0", f"Min: {preds.min():.2f}")
    check((lowers >= 0).all(), "Tất cả lower_qty >= 0", f"Min: {lowers.min():.2f}")
    check((lowers <= preds + 1e-5).all(), "lower_qty <= predicted_qty với mọi món")
    check((preds <= uppers + 1e-5).all(), "predicted_qty <= upper_qty với mọi món")

    next_raw["predicted_qty"] = preds
    next_raw["lower_qty"] = lowers
    next_raw["upper_qty"] = uppers
    tags = compute_action_tags(next_raw["predicted_qty"], next_raw["baseline_4w"])
    valid_tags = {"Tăng chuẩn bị", "Giảm chuẩn bị", "Giữ mức chuẩn bị"}
    check(set(tags.unique()).issubset(valid_tags), "Nhãn action_tag hợp lệ", str(tags.value_counts().to_dict()))

    # -------------------------------------------------------------
    # 5. Kiểm tra Schema Document MongoDB (Validator khắt khe)
    # -------------------------------------------------------------
    print("\n5) Kiểm tra định dạng tài liệu cho MongoDB (demand_forecasts)")
    docs = build_mongo_forecast_docs(next_raw, bundle["item_metadata"], ref_date, bundle["model_version"])

    check(len(docs) == 31, f"Tạo đủ 31 document ({len(docs)} bản ghi)")

    first_doc = docs[0]
    doc_keys = set(first_doc.keys())
    check(doc_keys == set(SAFE_WRITE_FIELDS), "Document chỉ gồm đúng các trường được phép của demand_forecasts", str(sorted(doc_keys)))
    check(set(SAFE_WRITE_REQUIRED).issubset(doc_keys), "Document có đầy đủ các trường bắt buộc")
    check("action_tag" not in doc_keys, "KHÔNG chứa action_tag trong document (tuân thủ validator MongoDB)")

    # Kiểm tra kiểu dữ liệu chi tiết
    all_types_ok = True
    for d in docs:
        if not isinstance(d["item_id"], ObjectId):
            all_types_ok = False
        if not isinstance(d["forecast_date"], datetime):
            all_types_ok = False
        if not isinstance(d["generated_at"], datetime):
            all_types_ok = False
        if not isinstance(d["predicted_qty"], int) or d["predicted_qty"] < 0:
            all_types_ok = False
        if not isinstance(d["lower_qty"], int) or d["lower_qty"] < 0:
            all_types_ok = False
        if not isinstance(d["upper_qty"], int) or d["upper_qty"] < d["predicted_qty"]:
            all_types_ok = False

    check(all_types_ok, "Kiểu dữ liệu tất cả các bản ghi chuẩn BSON/Python (ObjectId, datetime UTC, int >= 0)")

    # -------------------------------------------------------------
    # 6. Kiểm tra Dry-Run qua hàm an toàn safe_write
    # -------------------------------------------------------------
    print("\n6) Thử nghiệm hàm safe_write.upsert_forecasts ở chế độ DRY-RUN (không kết nối/không ghi)")
    from safe_write import upsert_forecasts
    dry_res = upsert_forecasts(None, docs, write=False)
    check(dry_res == 0, "Dry-run hoàn thành thành công và KHÔNG ghi gì vào DB (trả về 0)")

    # -------------------------------------------------------------
    # 7. Kiểm tra độ chính xác mô hình (Metrics)
    # -------------------------------------------------------------
    print("\n7) Đánh giá chỉ số sai số so với Baseline")
    metrics = bundle.get("metrics", {})
    base_m = metrics.get("baseline", {})
    rf_m = metrics.get("random_forest", {})

    check("mae" in rf_m and "rmse" in rf_m, "Mô hình lưu chỉ số MAE và RMSE của Random Forest")
    check(rf_m.get("mae", 999) < base_m.get("mae", 0), f"Random Forest cải thiện MAE so với Baseline ({rf_m.get('mae'):.4f} < {base_m.get('mae'):.4f})")
    check(rf_m.get("rmse", 999) < base_m.get("rmse", 0), f"Random Forest cải thiện RMSE so với Baseline ({rf_m.get('rmse'):.4f} < {base_m.get('rmse'):.4f})")

    # In mẫu 5 món dự báo
    print("\n" + "-" * 75)
    print(" MẪU DỰ BÁO 5 MÓN CHO NGÀY 28/10/2026 (KHÔNG GHI DB):")
    print("-" * 75)
    sample_df = next_raw[["item_code", "baseline_4w", "predicted_qty", "lower_qty", "upper_qty"]].head(5).copy()
    sample_df["action_tag"] = tags.head(5)
    print(sample_df.to_string(index=False))
    print("-" * 75)

    # -------------------------------------------------------------
    # Kết luận
    # -------------------------------------------------------------
    print("\n" + "=" * 65)
    if not failures:
        print(" TẤT CẢ CÁC BÀI KIỂM THỬ ĐỀU ĐẠT CHUẨN! [PASS]")
        print(" Đã đủ điều kiện an toàn để chạy: python src/run/02_Forecasting_run.py --write")
        print("=" * 65 + "\n")
        return 0
    else:
        print(f" CÓ {len(failures)} KIỂM THỬ THẤT BẠI: {failures}")
        print("=" * 65 + "\n")
        return 1


if __name__ == "__main__":
    sys.exit(run_tests())

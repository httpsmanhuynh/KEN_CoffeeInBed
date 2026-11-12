"""Tiền xử lý dữ liệu (mục 3.4): MongoDB -> data/master_ken_data.csv.

Quy trình ETL tĩnh, CHỈ ĐỌC trên MongoDB:
  Bước 1  Extract    : kéo booking CHECKED_OUT + giao dịch bán hàng (khóa mốc sale_date
                       01/04/2026 - 31/10/2026) + danh mục
  Bước 2  F&B filter : giữ DRINK / PASTRY / SNACK (theo collection products)
  Bước 3  Flatten    : kiểm tra/đập phẳng mảng lồng nhau (dữ liệu KÉN đã phẳng sẵn)
  Bước 4  Cleaning   : ép kiểu, loại dòng lỗi, gắn ngữ cảnh booking + tuổi khách
  Bước 5  Features   : hour_of_day, time_part, day_of_week, is_weekend
  Bước 6  Load       : bỏ cột rác/PII, xuất data/master_ken_data.csv

Chạy:
    python src/01_data_preparation.py                       # đọc từ MongoDB Atlas
    python src/01_data_preparation.py --json-dir ../database/data   # đọc từ file dump JSON
"""
from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger("prep")

# --------------------------------------------------------------------------- #
# Hằng số
# --------------------------------------------------------------------------- #
ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_CSV = ROOT_DIR / "data" / "master_ken_data.csv"

# Mốc thời gian của toàn pipeline. sale_date lưu NGÀY giờ Việt Nam ở dạng 00:00 UTC
# nên so sánh bằng datetime không múi giờ (giữ tháng 4 để còn mùa DRY, chặn dữ liệu tháng 11).
SALE_START = datetime(2026, 4, 1)
SALE_END = datetime(2026, 10, 31, 23, 59, 59)
SALE_DATE_RANGE = {"$gte": SALE_START, "$lte": SALE_END}

BOOKING_STATUS_PAID = "CHECKED_OUT"
FNB_CATEGORIES = {"DRINK", "PASTRY", "SNACK"}  # F&B: đồ uống, bánh, snack
DRY_MONTHS = {11, 12, 1, 2, 3, 4}  # mùa khô theo validator của DB

SALES_COLUMNS = [
    "_id", "order_code", "sale_date", "hour", "daypart", "day_of_week", "month",
    "season", "item_id", "item_code", "quantity", "unit_price_vnd",
    "line_total_vnd", "source", "booking_id", "customer_id",
]
DAYPART_TO_TIME_PART = {"MORNING": "Morning", "AFTERNOON": "Afternoon", "EVENING": "Evening"}
DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]

FINAL_COLUMNS = [
    "order_code", "booking_id", "customer_id",
    "sale_date", "hour_of_day", "time_part", "day_of_week", "day_name",
    "is_weekend", "month", "season",
    "item_id", "item_code", "item_name", "category", "sub_category", "item_type",
    "quantity", "unit_price_vnd", "line_total_vnd",
    "source", "is_inclusion", "is_walk_in",
    "tier_code", "zone_code", "zone_name", "space_type",
    "guest_count", "booking_duration_hours", "customer_age",
]
FEATURE_COLUMNS = ["hour_of_day", "time_part", "day_of_week", "is_weekend"]

# Số liệu kỳ vọng của bộ dữ liệu mẫu (chỉ để so sánh và cảnh báo, không ép buộc)
EXPECTED = {
    "rows": 67_375, "items": 31, "days": 210, "bookings": 8_350,
    "customers": 312, "walk_in_rows": 39_068, "inclusion_rows": 13_679,
}


# --------------------------------------------------------------------------- #
# Bước 1 - Extract
# --------------------------------------------------------------------------- #
def load_from_mongo() -> dict[str, list[dict]]:
    """Đọc từ MongoDB Atlas. Chỉ dùng find(), lọc ngay ở tầng DB."""
    from database import get_database  # import muộn: chế độ JSON không cần pymongo

    db = get_database()

    # 1) Booking đã thanh toán xong (status nằm ở bookings, không có ở sales_transactions)
    bookings = list(db["bookings"].find(
        {"status": BOOKING_STATUS_PAID},
        {"user_id": 1, "tier_code": 1, "zone_id": 1, "zone_name": 1, "space_id": 1,
         "guest_count": 1, "start_at": 1, "end_at": 1},
    ))
    booking_ids = [b["_id"] for b in bookings]

    # 2) Giao dịch trong mốc sale_date: khách vãng lai (booking_id null) + dòng thuộc booking CHECKED_OUT
    sales = list(db["sales_transactions"].find({
        "sale_date": SALE_DATE_RANGE,
        "$or": [{"booking_id": None}, {"booking_id": {"$in": booking_ids}}],
    }))

    return {
        "bookings": bookings,
        "sales": sales,
        "products": list(db["products"].find({}, {"item_code": 1, "name": 1, "category": 1, "sub_category": 1})),
        "zones": list(db["zones"].find({}, {"zone_code": 1})),
        "spaces": list(db["spaces"].find({}, {"space_type": 1})),
        "users": list(db["users"].find({}, {"date_of_birth": 1})),  # KHÔNG kéo email/phone/password_hash
        # cùng mốc với sales để phần đối chiếu cuối pipeline không bị lệch
        "daily": list(db["sales_history_daily"].find(
            {"sale_date": SALE_DATE_RANGE}, {"item_code": 1, "sale_date": 1, "qty": 1})),
    }


def _decode_extended_json(obj: dict):
    """Giải mã Extended JSON của file dump: {"$oid": ..} -> str, {"$date": ..} -> datetime (UTC, naive)."""
    if "$oid" in obj:
        return obj["$oid"]
    if "$date" in obj:
        return datetime.fromisoformat(obj["$date"].replace("Z", "+00:00")).replace(tzinfo=None)
    return obj


def _read_json(json_dir: Path, name: str) -> list[dict]:
    with (json_dir / f"{name}.json").open(encoding="utf-8") as f:
        return json.load(f, object_hook=_decode_extended_json)


def _in_window(row: dict) -> bool:
    d = row.get("sale_date")
    return d is not None and SALE_START <= d <= SALE_END


def load_from_json(json_dir: Path) -> dict[str, list[dict]]:
    """Đọc từ file dump JSON, áp dụng cùng bộ lọc như truy vấn MongoDB ở trên."""
    bookings = [b for b in _read_json(json_dir, "bookings") if b.get("status") == BOOKING_STATUS_PAID]
    booking_ids = {b["_id"] for b in bookings}
    sales = [
        s for s in _read_json(json_dir, "sales_transactions")
        if _in_window(s) and (s.get("booking_id") is None or s["booking_id"] in booking_ids)
    ]
    return {
        "bookings": bookings,
        "sales": sales,
        "products": _read_json(json_dir, "products"),
        "zones": _read_json(json_dir, "zones"),
        "spaces": _read_json(json_dir, "spaces"),
        "users": _read_json(json_dir, "users"),
        "daily": [d for d in _read_json(json_dir, "sales_history_daily") if _in_window(d)],
    }


# --------------------------------------------------------------------------- #
# Hàm tiện ích
# --------------------------------------------------------------------------- #
def _id_to_str(series: pd.Series) -> pd.Series:
    """ObjectId -> str (giữ nguyên giá trị rỗng)."""
    return series.map(lambda v: None if pd.isna(v) else str(v))


def _to_frame(rows: list[dict], id_columns: list[str]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    for col in id_columns:
        if col in df.columns:
            df[col] = _id_to_str(df[col])
    return df


def _drop(df: pd.DataFrame, mask_keep: pd.Series, reason: str) -> pd.DataFrame:
    """Giữ các dòng mask_keep=True và log số dòng bị loại."""
    removed = int((~mask_keep).sum())
    if removed:
        logger.warning("  - loại %s dòng: %s", f"{removed:,}", reason)
    return df[mask_keep].copy()


# --------------------------------------------------------------------------- #
# Bước 2-5 - Transform
# --------------------------------------------------------------------------- #
def transform(raw: dict[str, list[dict]]) -> pd.DataFrame:
    # ---- Chuyển sang DataFrame ----
    sales = _to_frame(raw["sales"], ["_id", "item_id", "booking_id", "customer_id"])
    if sales.empty:
        raise RuntimeError("Không có dòng giao dịch nào được tải về.")
    df = sales.reindex(columns=SALES_COLUMNS)
    logger.info("[Bước 1] Mốc sale_date %s -> %s | Booking CHECKED_OUT: %s | Giao dịch tải về: %s dòng",
                f"{SALE_START:%d/%m/%Y}", f"{SALE_END:%d/%m/%Y}",
                f"{len(raw['bookings']):,}", f"{len(df):,}")

    # ---- Bước 2: ranh giới F&B (category nằm ở collection products) ----
    products = _to_frame(raw["products"], ["_id"]).rename(columns={
        "_id": "item_id", "name": "item_name", "item_code": "catalog_item_code"})
    products = products[["item_id", "item_name", "catalog_item_code", "category", "sub_category"]]
    df = df.merge(products, on="item_id", how="left")

    n_unknown = int(df["category"].isna().sum())
    n_non_fnb = int((df["category"].notna() & ~df["category"].isin(FNB_CATEGORIES)).sum())
    mism = int((df["catalog_item_code"].notna() & (df["catalog_item_code"] != df["item_code"])).sum())
    if mism:
        logger.warning("  - %s dòng có item_code khác danh mục products (kiểm tra lại dữ liệu)", f"{mism:,}")
    df = _drop(df, df["category"].notna(), f"item_id không có trong products ({n_unknown:,})")
    df = _drop(df, df["category"].isin(FNB_CATEGORIES), f"không phải F&B ({n_non_fnb:,})")
    df = df.drop(columns="catalog_item_code")
    logger.info("[Bước 2] Sau khi lọc F&B: %s dòng", f"{len(df):,}")

    # ---- Bước 3: làm phẳng (sales_transactions đã phẳng sẵn; chỉ explode nếu có cột list) ----
    list_cols = [c for c in df.columns if df[c].map(lambda v: isinstance(v, list)).any()]
    if not list_cols:
        logger.info("[Bước 3] Dữ liệu đã phẳng (1 dòng = 1 món), bỏ qua explode: %s dòng", f"{len(df):,}")
    for col in list_cols:
        df = df.explode(col).reset_index(drop=True)
        has_dict = df[col].map(lambda v: isinstance(v, dict))
        if has_dict.any():
            expanded = pd.json_normalize(df.loc[has_dict, col].tolist()).add_prefix(f"{col}_")
            expanded.index = df.index[has_dict]
            df = df.drop(columns=col).join(expanded)
        logger.info("[Bước 3] Đã explode cột '%s': %s dòng", col, f"{len(df):,}")

    # ---- Bước 4: làm sạch + ép kiểu ----
    # LƯU Ý: KHÔNG drop dòng thiếu customer_id. Đó là khách vãng lai (~58% dữ liệu),
    # cần cho Bài 1 (trending) và Bài 2 (dự báo); Bài 3 sẽ tự lọc customer_id khác rỗng.
    df = _drop(df, ~df["_id"].duplicated(), "trùng _id")
    required = ["order_code", "sale_date", "hour", "item_id", "item_code", "quantity"]
    df = _drop(df, df[required].notna().all(axis=1), "thiếu trường bắt buộc")

    for col in ["hour", "quantity", "unit_price_vnd", "line_total_vnd"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["sale_date"] = pd.to_datetime(df["sale_date"], errors="coerce")
    if df["sale_date"].dt.tz is not None:
        df["sale_date"] = df["sale_date"].dt.tz_localize(None)
    df["sale_date"] = df["sale_date"].dt.normalize()  # sale_date đã là ngày giờ Việt Nam, KHÔNG đổi múi giờ
    numeric_ok = df[["hour", "quantity", "unit_price_vnd", "line_total_vnd", "sale_date"]].notna().all(axis=1)
    df = _drop(df, numeric_ok, "giá trị số/ngày không hợp lệ")

    df = _drop(df, df["quantity"] >= 1, "quantity < 1")
    df = _drop(df, df["unit_price_vnd"] >= 0, "unit_price_vnd < 0")
    df = _drop(df, df["hour"].between(0, 23), "hour ngoài 0-23")
    df = _drop(df, np.isclose(df["line_total_vnd"], df["quantity"] * df["unit_price_vnd"]),
               "line_total_vnd != quantity * unit_price_vnd")

    df["hour"] = df["hour"].astype("int64")
    df["quantity"] = df["quantity"].astype("int64")
    for col in ["unit_price_vnd", "line_total_vnd"]:
        if (df[col] % 1 == 0).all():
            df[col] = df[col].astype("int64")
    if df.duplicated(["order_code", "item_code"]).any():
        logger.warning("  - có cặp (order_code, item_code) trùng nhau; kiểm tra lại nếu dùng để đếm đơn")
    logger.info("[Bước 4] Sau khi làm sạch: %s dòng", f"{len(df):,}")

    # ---- Gắn ngữ cảnh booking (hạng lúc đặt, khu, loại không gian, số khách, thời lượng) ----
    bookings = _to_frame(raw["bookings"], ["_id", "user_id", "zone_id", "space_id"]).rename(
        columns={"_id": "booking_id", "user_id": "booking_user_id"})
    zones = _to_frame(raw["zones"], ["_id"]).rename(columns={"_id": "zone_id"})[["zone_id", "zone_code"]]
    spaces = _to_frame(raw["spaces"], ["_id"]).rename(columns={"_id": "space_id"})[["space_id", "space_type"]]
    bookings["booking_duration_hours"] = (
        (pd.to_datetime(bookings["end_at"]) - pd.to_datetime(bookings["start_at"])).dt.total_seconds() / 3600
    ).round(2)
    bookings = bookings.merge(zones, on="zone_id", how="left").merge(spaces, on="space_id", how="left")
    bookings = bookings[["booking_id", "booking_user_id", "tier_code", "zone_code", "zone_name",
                         "space_type", "guest_count", "booking_duration_hours"]]
    df = df.merge(bookings, on="booking_id", how="left")
    has_booking = df["booking_id"].notna()
    bad_owner = int((has_booking & (df["customer_id"] != df["booking_user_id"])).sum())
    if bad_owner:
        logger.warning("  - %s dòng có customer_id khác user_id của booking", f"{bad_owner:,}")
    missing_ctx = int((has_booking & df["tier_code"].isna()).sum())
    if missing_ctx:
        logger.warning("  - %s dòng có booking_id nhưng không tìm thấy booking", f"{missing_ctx:,}")

    # ---- Tuổi khách tại ngày mua (từ users.date_of_birth; chỉ giữ tuổi, bỏ ngày sinh) ----
    users = _to_frame(raw["users"], ["_id"]).rename(columns={"_id": "customer_id"})[["customer_id", "date_of_birth"]]
    df = df.merge(users, on="customer_id", how="left")
    dob = pd.to_datetime(df["date_of_birth"])
    birthday_not_yet = (df["sale_date"].dt.month < dob.dt.month) | (
        (df["sale_date"].dt.month == dob.dt.month) & (df["sale_date"].dt.day < dob.dt.day))
    df["customer_age"] = (df["sale_date"].dt.year - dob.dt.year - birthday_not_yet.astype("int64")).astype("Int64")
    df["guest_count"] = pd.to_numeric(df["guest_count"], errors="coerce").astype("Int64")

    # ---- Bước 5: đặc trưng ngữ cảnh (từ sale_date + hour) ----
    dow = df["sale_date"].dt.dayofweek  # 0 = Thứ Hai ... 6 = Chủ Nhật (cùng quy ước DB)
    n_dow = int((dow != pd.to_numeric(df["day_of_week"], errors="coerce")).sum())
    if n_dow:
        logger.warning("  - %s dòng có day_of_week của DB khác tính từ sale_date (dùng giá trị tính lại)", f"{n_dow:,}")
    df["day_of_week"] = dow.astype("int64")
    df["day_name"] = df["day_of_week"].map(dict(enumerate(DAY_NAMES)))
    df["is_weekend"] = (df["day_of_week"] >= 5).astype("int64")  # 1 = Thứ Bảy/Chủ Nhật

    df["hour_of_day"] = df["hour"]
    # Ranh giới theo validator của DB: Morning <= 11h, Afternoon <= 16h, Evening còn lại
    df["time_part"] = np.select([df["hour_of_day"] <= 11, df["hour_of_day"] <= 16],
                                ["Morning", "Afternoon"], default="Evening")
    n_tp = int((df["time_part"] != df["daypart"].map(DAYPART_TO_TIME_PART)).sum())
    if n_tp:
        logger.warning("  - %s dòng có time_part khác daypart của DB", f"{n_tp:,}")

    df["month"] = df["sale_date"].dt.month.astype("int64")
    df["season"] = np.where(df["month"].isin(DRY_MONTHS), "DRY", "RAINY")
    df["item_type"] = np.where(df["category"] == "DRINK", "DRINK", "FOOD")
    df["is_inclusion"] = (df["source"] == "INCLUSION").astype("int64")  # quyền lợi trong gói, giá 0
    df["is_walk_in"] = df["booking_id"].isna().astype("int64")  # khách vãng lai, không có booking/customer
    logger.info("[Bước 5] Đã tạo 4 đặc trưng: %s", ", ".join(FEATURE_COLUMNS))
    return df


# --------------------------------------------------------------------------- #
# Kiểm tra chất lượng
# --------------------------------------------------------------------------- #
def validate(df: pd.DataFrame, daily_rows: list[dict]) -> None:
    assert set(df["category"].unique()) <= FNB_CATEGORIES, "Còn category ngoài F&B"
    assert (df["quantity"] >= 1).all(), "Có quantity < 1"
    assert df["sale_date"].between(SALE_START, SALE_END).all(), "Có sale_date ngoài mốc 01/04 - 31/10/2026"
    for col in FEATURE_COLUMNS:
        assert df[col].notna().all(), f"Cột {col} còn giá trị rỗng"

    actual = {
        "rows": len(df),
        "items": df["item_code"].nunique(),
        "days": df["sale_date"].nunique(),
        "bookings": df["booking_id"].nunique(),
        "customers": df["customer_id"].nunique(),
        "walk_in_rows": int(df["is_walk_in"].sum()),
        "inclusion_rows": int(df["is_inclusion"].sum()),
    }
    for key, expected in EXPECTED.items():
        status = "khớp" if actual[key] == expected else "LỆCH"
        log = logger.info if status == "khớp" else logger.warning
        log("  kiểm tra %-15s thực tế=%s | kỳ vọng=%s -> %s", key, f"{actual[key]:,}", f"{expected:,}", status)

    # Đối chiếu chéo với bảng tổng hợp sales_history_daily (đã gồm cả dòng INCLUSION)
    if daily_rows:
        daily = pd.DataFrame(daily_rows)
        daily["d"] = pd.to_datetime(daily["sale_date"]).dt.normalize()
        grouped = df.groupby(["item_code", "sale_date"])["quantity"].sum()
        grouped.index = grouped.index.set_levels(
            pd.to_datetime(grouped.index.levels[1]), level=1).rename(["item_code", "d"])
        both = pd.concat([daily.set_index(["item_code", "d"])["qty"].rename("daily"),
                          grouped.rename("csv")], axis=1).fillna(0)
        ok = int((both["daily"] == both["csv"]).sum())
        log = logger.info if ok == len(both) else logger.warning
        log("  đối chiếu sales_history_daily: khớp %s/%s tổ hợp (món, ngày)", f"{ok:,}", f"{len(both):,}")


# --------------------------------------------------------------------------- #
# Bước 6 - Load
# --------------------------------------------------------------------------- #
def load_csv(df: pd.DataFrame) -> None:
    # Chỉ giữ cột trong FINAL_COLUMNS: tự động bỏ _id, daypart, hour, booking_user_id,
    # date_of_birth ... (và mọi PII như email/phone/password_hash vốn không được kéo về)
    out = df.sort_values(["sale_date", "hour_of_day", "order_code", "item_code"]).copy()
    out["sale_date"] = out["sale_date"].dt.strftime("%Y-%m-%d")
    out = out[FINAL_COLUMNS]
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig: Excel mở tiếng Việt không lỗi font; pandas vẫn đọc bình thường
    out.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    logger.info("[Bước 6] Đã xuất %s dòng x %d cột -> %s", f"{len(out):,}", out.shape[1], OUTPUT_CSV)
    logger.info("Thống kê nhanh:\n%s", out[["time_part", "item_type", "is_weekend", "is_walk_in"]]
                .apply(lambda s: s.value_counts().to_dict()).to_string())


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
    parser = argparse.ArgumentParser(description="Tiền xử lý dữ liệu KÉN -> master_ken_data.csv")
    parser.add_argument("--json-dir", type=Path, default=None,
                        help="Đọc từ thư mục dump JSON thay vì MongoDB (vd: ../database/data)")
    args = parser.parse_args()

    raw = load_from_json(args.json_dir) if args.json_dir else load_from_mongo()
    df = transform(raw)
    validate(df, raw["daily"])
    load_csv(df)


if __name__ == "__main__":
    main()
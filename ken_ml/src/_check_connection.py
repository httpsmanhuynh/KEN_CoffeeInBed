"""Kiểm tra kết nối MongoDB + dữ liệu TRƯỚC khi tiền xử lý ML (CHỈ ĐỌC).

Chạy từ thư mục gốc KEN_ML:   python src/_check_connection.py
"""
import sys
from datetime import datetime, timedelta, timezone

from database import get_database

# Mốc 6 tháng theo giờ Việt Nam (PyMongo tự đổi sang UTC khi truy vấn).
VN = timezone(timedelta(hours=7))
START = datetime(2026, 4, 1, tzinfo=VN)
END = datetime(2026, 10, 31, 23, 59, 59, tzinfo=VN)
# sale_date lưu ngày VN dưới dạng 00:00 UTC -> so sánh bằng mốc không múi giờ
SALE_START, SALE_END = START.replace(tzinfo=None), END.replace(tzinfo=None)

REQUIRED = ["users", "products", "zones", "spaces", "bookings", "sales_transactions"]


def span(coll, field):
    """Khoảng ngày nhỏ nhất -> lớn nhất của một trường thời gian."""
    q = {field: {"$ne": None}}
    lo = coll.find_one(q, {field: 1}, sort=[(field, 1)])
    hi = coll.find_one(q, {field: 1}, sort=[(field, -1)])
    return f"{lo[field]:%d/%m/%Y} -> {hi[field]:%d/%m/%Y}" if lo else "không có dữ liệu"


def check(label, actual, expected=None):
    """In số đếm; nếu có số mong đợi thì đối chiếu OK/LỆCH."""
    if expected is None:
        mark = ""
    elif actual == expected:
        mark = "  [OK]"
    else:
        mark = f"  [LỆCH (mong đợi {expected:,})]"
    print(f"  {label:<46}: {actual:>7,}{mark}")


def main():
    db = get_database()
    print(f"[1] Kết nối OK | database = {db.name}")

    print("[2] Collection bắt buộc")
    missing = False
    for name in REQUIRED:
        n = db[name].count_documents({})
        missing |= n == 0
        print(f"  {name:<20}: {n:>7,}  {'OK' if n else 'THIẾU/RỖNG'}")
    if missing:
        print("  -> Vào thư mục database/ chạy `npm install` rồi `npm run setup`.")
        return 1

    bookings, sales = db["bookings"], db["sales_transactions"]
    paid = {"status": "CHECKED_OUT"}
    print(f"[3] Mốc 6 tháng (giờ VN): {START:%d/%m/%Y} -> {END:%d/%m/%Y}")
    print(f"  Tổng bookings / CHECKED_OUT: {bookings.count_documents({}):,} / {bookings.count_documents(paid):,}")
    print(f"  Khoảng created_at: {span(bookings, 'created_at')}")

    rng = lambda lo, hi: {"$gte": lo, "$lte": hi}
    sale_q = {"sale_date": rng(SALE_START, SALE_END)}
    check("CHECKED_OUT + created_at trong mốc",
          bookings.count_documents({**paid, "created_at": rng(START, END)}))
    check("CHECKED_OUT + start_at trong mốc",
          bookings.count_documents({**paid, "start_at": rng(START, END)}))
    check("sales_transactions có sale_date trong mốc  <== CHÍNH",
          sales.count_documents(sale_q), 67_375)
    check("sales_transactions tổng",
          sales.count_documents({}), 67_375)
    print(f"  Khoảng sale_date: {span(sales, 'sale_date')}")

    late = bookings.count_documents({"created_at": {"$gt": END}})
    if late:
        print(f"  [LƯU Ý] {late:,} booking tạo SAU mốc 31/10 (dữ liệu mới thêm, không ảnh hưởng mốc 6 tháng).")
    dry = sales.count_documents({**sale_q, "season": "DRY"})
    rainy = sales.count_documents({**sale_q, "season": "RAINY"})
    print(f"  Mùa trong mốc: DRY = {dry:,} dòng | RAINY = {rainy:,} dòng")
    if not dry or not rainy:
        print("  [LƯU Ý] Cột season chỉ còn 1 giá trị, không dùng làm đặc trưng được.")
    print("  [LƯU Ý] created_at là lúc ĐẶT chỗ; F&B ghi theo ngày dùng dịch vụ -> khóa mốc theo sale_date.")
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, OSError):
        pass
    try:
        sys.exit(main())
    except (ConnectionError, RuntimeError) as exc:  # lỗi đã được database.py dịch sang tiếng Việt
        print(f"[LỖI KẾT NỐI] {exc}")
    except Exception as exc:  # noqa: BLE001
        print(f"[LỖI] {type(exc).__name__}: {exc}")
    sys.exit(1)
"""Nghiệm thu Bài 1: đọc CSV, in Top 12 món ra terminal, KHÔNG chạm DB.
Chạy: python tests/test_task1.py"""
import importlib.util
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("task1", ROOT / "src" / "02_task1_trending.py")
task1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(task1)

df = task1.load_data(ROOT / "data" / "master_ken_data.csv")
ref = task1.reference_date(df)
ranked = task1.compute_trending(df, ref, h=14, alpha=0.5)

print("REFERENCE_DATE:", ref.date())
print(ranked.head(12)[["rank", "rank_in_type", "item_code", "item_name", "item_type", "qty_raw", "trending_score"]].to_string(index=False))

# --- kiểm tra tự động
purchased = df[df["is_inclusion"] == 0]
assert ranked["qty_raw"].sum() == purchased["quantity"].sum(), "đã đếm nhầm dòng quyền lợi"
assert ranked["rank"].is_unique and ranked["rank"].min() == 1
assert ranked["trending_score"].between(0, 1).all()
assert ranked["rank_in_type"].min() == 1
assert ref == df["sale_date"].max() + pd.Timedelta(days=1)
# Time Decay có tác dụng: nếu h rất lớn thì xếp hạng tiến gần xếp hạng theo số lượng
big = task1.compute_trending(df, ref, h=10_000, alpha=1.0)
base = task1.bestseller_baseline(df, ref)
assert list(big["item_code"].head(5)) == list(base["item_code"].head(5)), "h lớn, alpha=1 phải trùng bán chạy nhất"
# cấu trúc document
docs = task1.build_docs(ranked)
assert set(docs[0]) == {"item_code", "item_name", "item_type", "category", "rank", "rank_in_type", "trending_score", "updated_at"}
assert hasattr(docs[0]["updated_at"], "year")
print("\nOK: các kiểm tra đều đạt (không ghi DB).")

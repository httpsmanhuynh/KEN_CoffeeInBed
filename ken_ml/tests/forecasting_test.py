"""Wrapper nghiệm thu Bài toán 2 (tương thích cả tests/forecasting_test.py và tests/test_task2.py).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))
from test_task2 import run_tests

if __name__ == "__main__":
    sys.exit(run_tests())

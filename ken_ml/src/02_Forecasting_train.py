"""Wrapper chuyển tiếp cho src/train/02_Forecasting_train.py."""
import runpy
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "train" / "02_Forecasting_train.py"
runpy.run_path(str(TARGET), run_name="__main__")

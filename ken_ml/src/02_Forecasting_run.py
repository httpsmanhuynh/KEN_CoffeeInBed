"""Wrapper chuyển tiếp cho src/run/02_Forecasting_run.py."""
import runpy
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "run" / "02_Forecasting_run.py"
runpy.run_path(str(TARGET), run_name="__main__")

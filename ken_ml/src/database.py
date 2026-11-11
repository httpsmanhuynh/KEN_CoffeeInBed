"""Kết nối MongoDB Atlas cho pipeline Học máy KÉN (CHỈ ĐỌC).

Chuỗi kết nối lấy từ file .env ở thư mục gốc KEN_ML, không hard-code:
    MONGODB_URI=mongodb+srv://...
    DB_NAME=ken_space_booking
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import (
    ConfigurationError,
    OperationFailure,
    ServerSelectionTimeoutError,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_NAME = "ken_space_booking"


def get_database() -> Database:
    """Trả về đối tượng Database sau khi kết nối và ping thành công."""
    load_dotenv(ROOT_DIR / ".env")
    uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
    db_name = os.getenv("DB_NAME", DEFAULT_DB_NAME)
    if not uri:
        raise RuntimeError(
            "Thiếu MONGODB_URI trong file .env (đặt ở thư mục gốc KEN_ML)."
        )

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=10_000)
        client.admin.command("ping")  # ép kết nối thật để bắt lỗi sớm
    except ConfigurationError:
        raise ConnectionError(
            "Lỗi cấu hình/DNS khi phân giải chuỗi mongodb+srv. "
            "Kiểm tra mạng, DNS (thử 8.8.8.8), và cú pháp MONGODB_URI trong .env."
        ) from None
    except ServerSelectionTimeoutError:
        raise ConnectionError(
            "Không kết nối được máy chủ MongoDB sau 10 giây. "
            "Kiểm tra mạng và danh sách IP được phép (Network Access) trên Atlas."
        ) from None
    except OperationFailure:
        raise ConnectionError(
            "Xác thực thất bại. Kiểm tra username/password trong MONGODB_URI."
        ) from None
    return client[db_name]
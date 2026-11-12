"""Kết nối MongoDB Atlas cho pipeline Học máy KÉN (CHỈ ĐỌC).

Chuỗi kết nối lấy từ file .env, không hard-code. Thứ tự tìm .env:
    1. my-server-mongodb/.env  (cùng cấp với KEN_ML, trong cùng project)
    2. KEN_ML/.env             (tùy chọn, nếu muốn ghi đè)
    3. Biến môi trường hệ thống (nếu đã đặt sẵn)

Các biến cần có:
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

ROOT_DIR = Path(__file__).resolve().parent.parent          # KEN_ML
PROJECT_DIR = ROOT_DIR.parent                              # thư mục project chứa cả 2 folder
SERVER_ENV = PROJECT_DIR / "my-server-mongodb" / ".env"
LOCAL_ENV = ROOT_DIR / ".env"
DEFAULT_DB_NAME = "ken_space_booking"


def _load_env() -> None:
    """Nạp .env từ my-server-mongodb, sau đó KEN_ML (nếu có).

    override=False nên biến môi trường đã có sẽ không bị ghi đè;
    file nạp trước có ưu tiên cao hơn file nạp sau.
    """
    for env_path in (SERVER_ENV, LOCAL_ENV):
        if env_path.is_file():
            load_dotenv(env_path, override=False)


def get_database() -> Database:
    """Trả về đối tượng Database sau khi kết nối và ping thành công."""
    _load_env()
    uri = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")
    db_name = os.getenv("DB_NAME", DEFAULT_DB_NAME)
    if not uri:
        raise RuntimeError(
            "Không tìm thấy MONGODB_URI. Đã thử đọc: "
            f"{SERVER_ENV} và {LOCAL_ENV}, cùng biến môi trường hệ thống."
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
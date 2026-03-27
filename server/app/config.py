from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# server 根目录，用于解析默认模型路径。
SERVER_DIR = Path(__file__).resolve().parents[1]


def _as_bool(value: str | None, default: bool) -> bool:
    """将环境变量中的布尔字符串转换为 bool。"""
    if value is None:
        return default
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _resolve_path(value: str, default: Path) -> Path:
    """解析路径配置。

    规则：
    1. 为空时使用默认路径。
    2. 绝对路径直接返回。
    3. 相对路径相对于 server 目录解析。
    """
    raw = (value or '').strip()
    candidate = Path(raw) if raw else default
    return candidate if candidate.is_absolute() else (SERVER_DIR / candidate).resolve()


@dataclass(slots=True)
class ServerSettings:
    """OCR 服务运行配置。"""

    host: str
    port: int
    reload: bool
    device: str
    det_model_dir: Path
    rec_model_dir: Path
    use_textline_orientation: bool
    enable_doc_orientation: bool
    enable_doc_unwarping: bool


def get_settings() -> ServerSettings:
    """从环境变量读取服务配置。"""
    return ServerSettings(
        host=os.getenv('SERVER_HOST', '127.0.0.1'),
        port=int(os.getenv('SERVER_PORT', '18733')),
        reload=_as_bool(os.getenv('SERVER_RELOAD'), True),
        device=os.getenv('PPOCR_DEVICE', 'auto').strip() or 'auto',
        det_model_dir=_resolve_path(
            os.getenv('PPOCR_DET_MODEL_DIR', './models/ppocr/det/PP-OCRv5_mobile_det'),
            SERVER_DIR / 'models' / 'ppocr' / 'det' / 'PP-OCRv5_mobile_det',
        ),
        rec_model_dir=_resolve_path(
            os.getenv('PPOCR_REC_MODEL_DIR', './models/ppocr/rec/korean_PP-OCRv5_mobile_rec'),
            SERVER_DIR / 'models' / 'ppocr' / 'rec' / 'korean_PP-OCRv5_mobile_rec',
        ),
        use_textline_orientation=_as_bool(os.getenv('PPOCR_USE_TEXTLINE_ORIENTATION'), False),
        enable_doc_orientation=_as_bool(os.getenv('PPOCR_ENABLE_DOC_ORIENTATION'), False),
        enable_doc_unwarping=_as_bool(os.getenv('PPOCR_ENABLE_DOC_UNWARPING'), False),
    )

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class ModelStatus:
    """模型目录状态。"""

    det_dir: Path
    rec_dir: Path

    @property
    def det_ready(self) -> bool:
        """检测模型目录是否存在且非空。"""
        return self.det_dir.exists() and any(self.det_dir.iterdir())

    @property
    def rec_ready(self) -> bool:
        """识别模型目录是否存在且非空。"""
        return self.rec_dir.exists() and any(self.rec_dir.iterdir())

    @property
    def ready(self) -> bool:
        """检测模型与识别模型是否都已准备完成。"""
        return self.det_ready and self.rec_ready

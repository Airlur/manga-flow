from __future__ import annotations

from pydantic import BaseModel, Field


class ModelPaths(BaseModel):
    """模型路径信息。"""

    det: str
    rec: str


class HealthResponse(BaseModel):
    """健康检查响应。"""

    status: str = 'ok'
    service: str = 'mangaflow-ocr-server'
    python_version: str
    paddle_version: str | None = None
    paddleocr_version: str | None = None
    gpu_available: bool | None = None
    selected_device: str
    model_ready: bool
    model_paths: ModelPaths
    dependency_ready: bool
    load_error: str | None = None


class OCRImageRequest(BaseModel):
    """JSON 方式提交的 OCR 请求。"""

    imageBase64: str
    filename: str | None = None


class OCRBox(BaseModel):
    """矩形包围框。"""

    x0: int
    y0: int
    x1: int
    y1: int


class OCRBlock(BaseModel):
    """单个文本块识别结果。"""

    text: str
    score: float
    bbox: OCRBox
    polygon: list[list[int]] = Field(default_factory=list)


class OCRTimings(BaseModel):
    """接口耗时信息。"""

    total_ms: float


class OCRResponse(BaseModel):
    """OCR 接口响应。"""

    text: str
    blocks: list[OCRBlock]
    image_width: int
    image_height: int
    device: str
    timings: OCRTimings

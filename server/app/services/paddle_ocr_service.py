from __future__ import annotations

import json
from io import BytesIO
import importlib.metadata
import platform
import threading
from time import perf_counter
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.config import get_settings
from app.services.model_manager import ModelStatus


class OCRServiceError(RuntimeError):
    """OCR 服务异常。"""


class PaddleOCRService:
    """PaddleOCR 服务封装。

    当前职责：
    - 初始化 det + rec 模型。
    - 对外提供统一 OCR 预测入口。
    - 同时兼容 `predict()` 和旧版 `ocr()` 调用方式。
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self._lock = threading.Lock()
        self._predict_lock = threading.Lock()
        self._ocr: Any | None = None
        self._load_error: str | None = None
        self._dependency_ready = True
        self._selected_device = 'cpu'
        self._paddle_version: str | None = None
        self._paddleocr_version: str | None = None
        self._gpu_available: bool | None = None

    @property
    def model_status(self) -> ModelStatus:
        """返回当前模型目录状态。"""
        return ModelStatus(
            det_dir=self.settings.det_model_dir,
            rec_dir=self.settings.rec_model_dir,
        )

    def get_health_snapshot(self) -> dict[str, Any]:
        """生成健康检查响应数据。"""
        self._probe_runtime()
        status = self.model_status
        return {
            'python_version': platform.python_version(),
            'paddle_version': self._paddle_version,
            'paddleocr_version': self._paddleocr_version,
            'gpu_available': self._gpu_available,
            'selected_device': self._selected_device,
            'model_ready': status.ready,
            'model_paths': {
                'det': str(status.det_dir),
                'rec': str(status.rec_dir),
            },
            'dependency_ready': self._dependency_ready,
            'load_error': self._load_error,
        }

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        """执行单张图片 OCR 预测。"""
        ocr = self._ensure_initialized()
        image = self._decode_image(image_bytes)
        start = perf_counter()

        try:
            with self._predict_lock:
                raw_result = self._run_prediction(ocr, image)
            blocks = self._normalize_result(raw_result)
            total_ms = round((perf_counter() - start) * 1000, 2)
        except OCRServiceError:
            raise
        except Exception as error:
            raise OCRServiceError(f'PaddleOCR 推理失败：{error}') from error

        return {
            'text': '\n'.join(block['text'] for block in blocks),
            'blocks': blocks,
            'image_width': int(image.shape[1]),
            'image_height': int(image.shape[0]),
            'device': self._selected_device,
            'timings': {
                'total_ms': total_ms,
            },
        }

    def _ensure_initialized(self) -> Any:
        """懒加载 PaddleOCR 实例，避免服务启动时立即占用大量资源。"""
        if self._ocr is not None:
            return self._ocr

        with self._lock:
            if self._ocr is not None:
                return self._ocr

            self._probe_runtime()
            status = self.model_status
            if not status.ready:
                raise OCRServiceError('模型目录未准备完成，请确认 det/rec 模型已经放到 server/models/ppocr 下。')

            try:
                from paddleocr import PaddleOCR  # type: ignore
            except Exception as error:  # pragma: no cover
                self._dependency_ready = False
                self._load_error = f'导入 paddleocr 失败：{error}'
                raise OCRServiceError(self._load_error) from error

            try:
                self._ocr = self._create_ocr_instance(PaddleOCR)
            except Exception as error:  # pragma: no cover
                self._load_error = f'初始化 PaddleOCR 失败：{error}'
                raise OCRServiceError(self._load_error) from error

            return self._ocr

    def _probe_runtime(self) -> None:
        """探测 Paddle、PaddleOCR 与 GPU 状态。"""
        try:
            import paddle  # type: ignore

            self._paddle_version = getattr(paddle, '__version__', None)
            self._gpu_available = bool(paddle.device.is_compiled_with_cuda())
            self._selected_device = self._resolve_device(self.settings.device, self._gpu_available)
        except Exception as error:  # pragma: no cover
            self._dependency_ready = False
            self._gpu_available = None
            self._selected_device = 'cpu'
            if self._load_error is None:
                self._load_error = f'导入 paddle 失败：{error}'

        try:
            self._paddleocr_version = importlib.metadata.version('paddleocr')
        except importlib.metadata.PackageNotFoundError:
            self._paddleocr_version = None

    def _resolve_device(self, device: str, gpu_available: bool | None) -> str:
        """根据配置与运行时状态，决定最终使用的设备。"""
        normalized = (device or 'auto').strip().lower()
        if normalized in {'cpu', 'gpu:0', 'gpu'}:
            return 'gpu:0' if normalized.startswith('gpu') and gpu_available else 'cpu'
        return 'gpu:0' if gpu_available else 'cpu'

    def _create_ocr_instance(self, paddle_ocr_cls: Any) -> Any:
        """创建 PaddleOCR 实例。

        优先尝试 3.x 新参数；如果运行环境是旧接口，再回退到兼容参数。
        """
        det_model_name = self._read_model_name(self.settings.det_model_dir)
        rec_model_name = self._read_model_name(self.settings.rec_model_dir)

        new_api_kwargs = {
            'text_detection_model_name': det_model_name,
            'text_detection_model_dir': str(self.settings.det_model_dir),
            'text_recognition_model_name': rec_model_name,
            'text_recognition_model_dir': str(self.settings.rec_model_dir),
            'use_doc_orientation_classify': self.settings.enable_doc_orientation,
            'use_doc_unwarping': self.settings.enable_doc_unwarping,
            'use_textline_orientation': self.settings.use_textline_orientation,
            'device': self._selected_device,
        }

        try:
            return paddle_ocr_cls(**new_api_kwargs)
        except TypeError:
            legacy_kwargs = {
                'det_model_dir': str(self.settings.det_model_dir),
                'rec_model_dir': str(self.settings.rec_model_dir),
                'use_angle_cls': False,
                'lang': 'korean',
                'use_gpu': self._selected_device.startswith('gpu'),
                'show_log': False,
            }
            return paddle_ocr_cls(**legacy_kwargs)

    def _read_model_name(self, model_dir: Any) -> str:
        """从模型目录的 config.json 读取模型名，避免 PaddleOCR 3.x 误判默认模型。"""
        config_path = model_dir / 'config.json'
        fallback_name = model_dir.name

        if not config_path.exists():
            return fallback_name

        try:
            config = json.loads(config_path.read_text(encoding='utf-8'))
        except Exception:
            return fallback_name

        global_config = config.get('Global')
        if not isinstance(global_config, dict):
            return fallback_name

        model_name = global_config.get('model_name')
        return str(model_name).strip() if model_name else fallback_name

    def _decode_image(self, image_bytes: bytes) -> np.ndarray:
        """将上传图片解码为 OpenCV 使用的 BGR 数组。"""
        try:
            image = Image.open(BytesIO(image_bytes)).convert('RGB')
        except Exception as error:
            raise OCRServiceError(f'图片解码失败：{error}') from error

        rgb_array = np.array(image)
        return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)

    def _run_prediction(self, ocr: Any, image: np.ndarray) -> Any:
        """兼容不同 PaddleOCR 版本的预测调用方式。"""
        if hasattr(ocr, 'predict'):
            return ocr.predict(image)
        if hasattr(ocr, 'ocr'):
            return ocr.ocr(image, cls=False)
        raise OCRServiceError('当前 PaddleOCR 版本不支持可用的预测接口。')

    def _normalize_result(self, raw_result: Any) -> list[dict[str, Any]]:
        """将 PaddleOCR 输出整理为插件侧更容易消费的统一结构。"""
        if raw_result is None:
            return []

        if not isinstance(raw_result, list) and hasattr(raw_result, '__iter__'):
            raw_result = list(raw_result)

        # 新版结构：[{ rec_texts, rec_scores, dt_polys, ... }]
        if isinstance(raw_result, list) and raw_result and isinstance(raw_result[0], dict):
            first = raw_result[0]
            texts = first.get('rec_texts') or []
            scores = first.get('rec_scores') or []
            polygons = first.get('dt_polys') or []
            blocks: list[dict[str, Any]] = []

            for index, text in enumerate(texts):
                polygon = self._polygon_to_points(polygons[index] if index < len(polygons) else [])
                blocks.append({
                    'text': str(text).strip(),
                    'score': float(scores[index] if index < len(scores) else 0.0),
                    'bbox': self._polygon_to_bbox(polygon),
                    'polygon': polygon,
                })

            return [block for block in blocks if block['text']]

        # 旧版结构：[[polygon, (text, score)], ...]
        if isinstance(raw_result, list):
            lines = raw_result[0] if raw_result and isinstance(raw_result[0], list) else raw_result
            blocks = []

            for item in lines:
                if not isinstance(item, (list, tuple)) or len(item) < 2:
                    continue

                polygon = self._polygon_to_points(item[0])
                text_info = item[1]
                if not isinstance(text_info, (list, tuple)) or len(text_info) < 2:
                    continue

                text = str(text_info[0]).strip()
                score = float(text_info[1])
                if not text:
                    continue

                blocks.append({
                    'text': text,
                    'score': score,
                    'bbox': self._polygon_to_bbox(polygon),
                    'polygon': polygon,
                })

            return blocks

        return []

    def _polygon_to_points(self, polygon: Any) -> list[list[int]]:
        """将 polygon 转为整数坐标点列表。"""
        points: list[list[int]] = []
        if polygon is None or isinstance(polygon, (str, bytes)):
            return points

        for point in polygon:
            if point is None or isinstance(point, (str, bytes)):
                continue

            if isinstance(point, (list, tuple)):
                coords = point
            elif hasattr(point, 'tolist'):
                coords = point.tolist()
            elif hasattr(point, '__iter__'):
                coords = list(point)
            else:
                continue

            if not isinstance(coords, (list, tuple)) or len(coords) < 2:
                continue

            try:
                x = int(round(float(coords[0])))
                y = int(round(float(coords[1])))
            except (TypeError, ValueError, OverflowError):
                continue

            points.append([x, y])

        return points

    def _polygon_to_bbox(self, polygon: list[list[int]]) -> dict[str, int]:
        """根据 polygon 计算最小外接矩形。"""
        if not polygon:
            return {'x0': 0, 'y0': 0, 'x1': 0, 'y1': 0}

        xs = [point[0] for point in polygon]
        ys = [point[1] for point in polygon]
        return {
            'x0': min(xs),
            'y0': min(ys),
            'x1': max(xs),
            'y1': max(ys),
        }


# 单例服务实例，避免重复初始化模型。
_service: PaddleOCRService | None = None


def get_paddle_ocr_service() -> PaddleOCRService:
    """获取 OCR 服务单例。"""
    global _service
    if _service is None:
        _service = PaddleOCRService()
    return _service

from fastapi import APIRouter

from app.schemas import HealthResponse
from app.services.paddle_ocr_service import get_paddle_ocr_service

# 健康检查路由。
router = APIRouter(tags=['健康检查'])


@router.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    """返回当前服务、依赖与模型加载状态。"""
    service = get_paddle_ocr_service()
    return HealthResponse(**service.get_health_snapshot())

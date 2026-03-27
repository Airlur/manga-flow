from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.ocr import router as ocr_router

# FastAPI 应用入口。
app = FastAPI(
    title='MangaFlow 本地 OCR 服务',
    version='0.1.0',
    description='基于 PaddleOCR 的 MangaFlow 本地 OCR 服务。',
)

# 注册接口路由。
app.include_router(health_router)
app.include_router(ocr_router)


@app.get('/')
def root() -> dict[str, str]:
    """根路径检查，用于确认服务是否已启动。"""
    return {
        'name': 'MangaFlow 本地 OCR 服务',
        'status': 'ok',
    }

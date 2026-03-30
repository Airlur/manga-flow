from __future__ import annotations

import base64

from fastapi import HTTPException, UploadFile

# 当前只允许常见位图格式，先不开放 pdf / gif 等复杂输入。
_ALLOWED_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/bmp',
}


async def read_upload_image(file: UploadFile) -> bytes:
    """读取并校验上传图片。"""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='仅支持 jpg/png/webp/bmp 格式图片。')

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail='上传图片内容为空。')

    return data


def decode_base64_image(image_base64: str) -> bytes:
    """解析前端传来的 base64 图片数据。"""
    raw_value = (image_base64 or '').strip()
    if not raw_value:
        raise HTTPException(status_code=400, detail='图片内容为空。')

    if raw_value.startswith('data:'):
        parts = raw_value.split(',', 1)
        raw_value = parts[1] if len(parts) == 2 else ''

    if not raw_value:
        raise HTTPException(status_code=400, detail='图片内容为空。')

    try:
        return base64.b64decode(raw_value, validate=True)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f'图片 base64 解析失败：{error}') from error

from __future__ import annotations

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

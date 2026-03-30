from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import OCRImageRequest, OCRResponse
from app.services.paddle_ocr_service import OCRServiceError, get_paddle_ocr_service
from app.utils.image_io import decode_base64_image, read_upload_image

# OCR 接口路由。
router = APIRouter(tags=['OCR'])


@router.post('/ocr', response_model=OCRResponse)
async def ocr(file: UploadFile = File(...)) -> OCRResponse:
    """处理单张图片 OCR。"""
    image_bytes = await read_upload_image(file)
    service = get_paddle_ocr_service()

    try:
        result = service.predict(image_bytes)
    except OCRServiceError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return OCRResponse(**result)


@router.post('/ocr/json', response_model=OCRResponse)
def ocr_json(payload: OCRImageRequest) -> OCRResponse:
    """处理 base64 JSON 图片 OCR。"""
    image_bytes = decode_base64_image(payload.imageBase64)
    service = get_paddle_ocr_service()

    try:
        result = service.predict(image_bytes)
    except OCRServiceError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return OCRResponse(**result)


@router.post('/ocr/batch', response_model=list[OCRResponse])
async def ocr_batch(files: list[UploadFile] = File(...)) -> list[OCRResponse]:
    """处理多张图片 OCR，按上传顺序返回结果。"""
    if not files:
        raise HTTPException(status_code=400, detail='请至少上传一张图片。')

    service = get_paddle_ocr_service()
    responses: list[OCRResponse] = []

    for file in files:
        image_bytes = await read_upload_image(file)
        try:
            result = service.predict(image_bytes)
        except OCRServiceError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error
        responses.append(OCRResponse(**result))

    return responses

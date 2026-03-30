import { FileScan } from 'lucide-react';

type OcrEngineKey = 'local' | 'cloud' | 'paddle_local';

interface OcrEngineLogoProps {
    engine: OcrEngineKey;
}

const GOOGLE_CLOUD_VISION_ICON_PATH = 'src/assets/ocr/google-cloud-vision.png';
const PADDLE_OCR_ICON_PATH = 'src/assets/ocr/paddleocr.png';

function getExtensionAssetUrl(path: string): string {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(path);
    }

    return path;
}

const googleCloudVisionLogoUrl = getExtensionAssetUrl(GOOGLE_CLOUD_VISION_ICON_PATH);
const paddleOcrLogoUrl = getExtensionAssetUrl(PADDLE_OCR_ICON_PATH);

export function OcrEngineLogo({ engine }: OcrEngineLogoProps) {
    if (engine === 'cloud') {
        return (
            <span className="mf-ocr-logo mf-ocr-logo--cloud" aria-hidden="true">
                <img className="mf-ocr-logo__image" src={googleCloudVisionLogoUrl} alt="" />
            </span>
        );
    }

    if (engine === 'paddle_local') {
        return (
            <span className="mf-ocr-logo mf-ocr-logo--paddle" aria-hidden="true">
                <img className="mf-ocr-logo__image" src={paddleOcrLogoUrl} alt="" />
            </span>
        );
    }

    return (
        <span className="mf-ocr-logo mf-ocr-logo--local" aria-hidden="true">
            <FileScan className="mf-ocr-logo__icon" strokeWidth={1.9} />
        </span>
    );
}

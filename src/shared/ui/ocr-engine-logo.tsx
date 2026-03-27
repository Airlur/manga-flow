import { Cpu } from 'lucide-react';

type OcrEngineKey = 'local' | 'cloud';

interface OcrEngineLogoProps {
    engine: OcrEngineKey;
}

const GOOGLE_CLOUD_VISION_ICON_PATH = 'src/assets/ocr/google-cloud-vision.png';

function getExtensionAssetUrl(path: string): string {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(path);
    }

    return path;
}

const googleCloudVisionLogoUrl = getExtensionAssetUrl(GOOGLE_CLOUD_VISION_ICON_PATH);

export function OcrEngineLogo({ engine }: OcrEngineLogoProps) {
    if (engine === 'cloud') {
        return (
            <span className="mf-ocr-logo mf-ocr-logo--cloud" aria-hidden="true">
                <img className="mf-ocr-logo__image" src={googleCloudVisionLogoUrl} alt="" />
            </span>
        );
    }

    return (
        <span className="mf-ocr-logo mf-ocr-logo--local" aria-hidden="true">
            <Cpu className="mf-ocr-logo__icon" strokeWidth={1.9} />
        </span>
    );
}

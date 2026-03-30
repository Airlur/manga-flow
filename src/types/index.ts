export interface OpenAIProvider {
    id: string;
    name: string;
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    models: string[];
    enabled: boolean;
}

export interface Settings {
    sourceLang: 'ko' | 'ja' | 'en' | 'zh' | 'auto';
    targetLang: 'ko' | 'ja' | 'en' | 'zh';
    translateEngine: 'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl';

    apiBaseUrl: string;
    apiKey: string;
    model: string;
    openaiProviders?: OpenAIProvider[];

    deeplxUrl: string;
    deeplApiKey: string;

    fontSize: number;
    fontScale?: number;
    fontColor: string;
    maskOpacity?: number;

    ocrEngine: 'local' | 'cloud' | 'paddle_local';
    cloudOcrKey: string;
    paddleOcrServerUrl?: string;
    requestDelay?: number;

    devMode?: boolean;
    devPhase?: 'roi' | 'ocr' | 'translate' | 'full';
    showOcrBoxes?: boolean;
    showRoiBoxes?: boolean;
    showMaskBoxes?: boolean;

    sitePolicy?: 'auto_detect' | 'whitelist_only' | 'always_show';
    siteWhitelist?: string[];
}

export interface OCRResult {
    text: string;
    confidence: number;
    blocks: TextBlock[];
}

export interface TextBlock {
    text: string;
    bbox: BBox;
    confidence: number;
}

export interface RenderGroup {
    bbox: BBox;
    text: string;
    blocks: TextBlock[];
}

export interface BBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export interface TranslationResult {
    original: string;
    translated: string;
    engine: string;
}

export interface CacheEntry {
    imageHash: string;
    timestamp: number;
    ocrResult: OCRResult;
    translation: string;
    renderedImage: string;
}

export interface TranslationProgress {
    current: number;
    total: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface StageTimings {
    roiMs: number;
    ocrMs: number;
    translateMs: number;
    renderMs: number;
    totalMs: number;
}

export interface ImageTranslationResult {
    originalSrc: string;
    renderedSrc?: string;
    rendered: boolean;
    timings: StageTimings;
}

export interface BatchTranslationResult {
    success: number;
    failed: number;
    timings: StageTimings;
}

export interface SiteConfig {
    name: string;
    imageSelector: string;
    containerSelector: string;
    lazyLoadAttr: string;
    language: 'ko' | 'ja' | 'en' | 'auto';
    features?: {
        lazyLoad?: boolean;
        infiniteScroll?: boolean;
    };
}

export type FloatingBallState = 'idle' | 'translating' | 'paused' | 'completed' | 'error';

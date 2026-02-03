// 漫译 MangaFlow - 全局类型定义

// 设置配置
export interface Settings {
    sourceLang: 'ko' | 'ja' | 'en' | 'auto';
    targetLang: 'zh';
    // 翻译引擎选择
    translateEngine: 'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl';
    // OpenAI 兼容 API 配置
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    // DeepLX 配置（如: https://api.deeplx.org/YOUR_KEY/translate）
    deeplxUrl: string;
    // DeepL 官方 API 配置
    deeplApiKey: string;
    // 显示设置
    fontSize: number;
    fontColor: string;
    // OCR 设置
    ocrEngine: 'local' | 'cloud';
    cloudOcrKey: string;
    // 请求延迟（毫秒，用于有 RPM 限制的 API）
    requestDelay?: number;

    // 开发模式（仅调试用）
    devMode?: boolean;
    devPhase?: 'roi' | 'ocr' | 'translate' | 'full';
    showOcrBoxes?: boolean;
    showRoiBoxes?: boolean;
    showMaskBoxes?: boolean;
}

// OCR 结果
export interface OCRResult {
    text: string;
    confidence: number;
    blocks: TextBlock[];
}

// 文本块
export interface TextBlock {
    text: string;
    bbox: BBox;
    confidence: number;
}

// 边界框
export interface BBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

// 翻译结果
export interface TranslationResult {
    original: string;
    translated: string;
    engine: string;
}

// 缓存条目
export interface CacheEntry {
    imageHash: string;
    timestamp: number;
    ocrResult: OCRResult;
    translation: string;
    renderedImage: string;
}

// 翻译进度
export interface TranslationProgress {
    current: number;
    total: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
}

// 站点配置
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

// 悬浮球状态
export type FloatingBallState = 'idle' | 'translating' | 'paused' | 'completed' | 'error';

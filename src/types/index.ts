export interface OpenAIProvider {
    id: string;
    name: string;
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    models: string[];
    enabled: boolean;
}

export interface QWenConfig {
    apiKey: string;
    model: 'qwen-turbo' | 'qwen-plus' | 'qwen-max' | string;
    apiBaseUrl: string;
}

export interface BilingualModeConfig {
    enabled: boolean;
    showOriginalText: boolean;
    originalTextOpacity: number;
    originalTextPosition: 'top' | 'bottom';
}

export interface AutoTranslateConfig {
    enabled: boolean;
    autoStartOnComicSites: boolean;
}

export interface KeyboardShortcut {
    id: string;
    name: string;
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    enabled: boolean;
}

export interface KeyboardShortcutsConfig {
    toggleTranslation: KeyboardShortcut;
    clearCache: KeyboardShortcut;
    switchEngine: KeyboardShortcut;
    pauseOCR: KeyboardShortcut;
    invokeSelection: KeyboardShortcut;
    exportCurrent: KeyboardShortcut;
}

export interface FloatingBallPrefs {
    globallyDisabled: boolean;
    disabledSites: string[];
}

export interface WebDAVConfig {
    serverUrl: string;
    username: string;
    password: string;
    rememberPassword: boolean;
    autoSync: boolean;
    syncDelaySeconds: number;
    backupLimit: number;
}

export interface SyncSnapshot {
    schemaVersion: number;
    app: 'MangaFlow';
    exportedAt: string;
    settings: Settings;
    floatingBallPrefs: FloatingBallPrefs;
}

export interface WebDAVBackupItem {
    fileName: string;
    label: string;
    lastModified?: string;
    size?: number;
    isLatest?: boolean;
}

export interface Settings {
    sourceLang: 'ko' | 'ja' | 'en' | 'zh' | 'auto';
    targetLang: 'ko' | 'ja' | 'en' | 'zh';
    translateEngine: 'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl' | 'qwen';

    apiBaseUrl: string;
    apiKey: string;
    model: string;
    openaiProviders?: OpenAIProvider[];

    deeplxUrl: string;
    deeplApiKey: string;

    qwenConfig?: QWenConfig;

    fontSize: number;
    fontScale?: number;
    fontColor: string;
    maskOpacity?: number;

    bilingualMode?: BilingualModeConfig;

    autoTranslate?: AutoTranslateConfig;

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

    keyboardShortcuts?: KeyboardShortcutsConfig;
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
    originalText?: string;
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

export interface SelectionRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ExportOptions {
    format: 'png' | 'jpeg' | 'webp';
    quality: number;
    includeOriginal: boolean;
    includeTranslation: boolean;
}

export interface ExportResult {
    success: boolean;
    dataUrl?: string;
    blob?: Blob;
    error?: string;
}

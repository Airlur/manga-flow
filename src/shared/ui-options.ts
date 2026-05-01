export interface AppOption<T extends string> {
    value: T;
    label: string;
    description?: string;
    shortLabel?: string;
    group?: string;
}

export const SOURCE_LANGUAGE_OPTIONS: AppOption<'auto' | 'ko' | 'ja' | 'en' | 'zh'>[] = [
    { value: 'auto', label: '自动检测', shortLabel: 'Auto' },
    { value: 'ko', label: '韩语', shortLabel: 'KO' },
    { value: 'ja', label: '日语', shortLabel: 'JA' },
    { value: 'en', label: '英语', shortLabel: 'EN' },
    { value: 'zh', label: '简体中文', shortLabel: 'ZH' },
];

export const TARGET_LANGUAGE_OPTIONS: AppOption<'zh' | 'ko' | 'ja' | 'en'>[] = [
    { value: 'zh', label: '简体中文', shortLabel: 'ZH' },
    { value: 'ko', label: '韩语', shortLabel: 'KO' },
    { value: 'ja', label: '日语', shortLabel: 'JA' },
    { value: 'en', label: '英语', shortLabel: 'EN' },
];

export const TRANSLATION_ENGINE_OPTIONS: AppOption<'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl' | 'qwen'>[] = [
    { value: 'openai', label: 'OpenAI 兼容 API', group: 'AI 翻译' },
    { value: 'qwen', label: '通义千问 (阿里云)', group: 'AI 翻译' },
    { value: 'microsoft', label: 'Microsoft Translator', group: '常规翻译' },
    { value: 'google', label: 'Google Translate', group: '常规翻译' },
    { value: 'deepl', label: 'DeepL 官方 API', group: '常规翻译' },
    { value: 'deeplx', label: 'DeepLX', group: '常规翻译' },
];

export const QWEN_MODEL_OPTIONS: AppOption<'qwen-turbo' | 'qwen-plus' | 'qwen-max'>[] = [
    { value: 'qwen-turbo', label: 'qwen-turbo (经济版)' },
    { value: 'qwen-plus', label: 'qwen-plus (标准版)' },
    { value: 'qwen-max', label: 'qwen-max (高级版)' },
];

export const POPUP_SOURCE_LANGUAGE_OPTIONS: AppOption<'ko' | 'ja' | 'en' | 'zh'>[] = [
    { value: 'ko', label: '韩语' },
    { value: 'ja', label: '日语' },
    { value: 'en', label: '英语' },
    { value: 'zh', label: '简体中文' },
];

export const POPUP_TARGET_LANGUAGE_OPTIONS: AppOption<'zh' | 'ko' | 'ja' | 'en'>[] = [
    { value: 'ko', label: '韩语' },
    { value: 'ja', label: '日语' },
    { value: 'en', label: '英语' },
    { value: 'zh', label: '简体中文' },
];

export const POPUP_TRANSLATION_ENGINE_OPTIONS: AppOption<'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl' | 'qwen'>[] = [
    { value: 'openai', label: 'OpenAI 兼容', group: 'AI 翻译' },
    { value: 'qwen', label: '通义千问', group: 'AI 翻译' },
    { value: 'microsoft', label: 'Microsoft Translator', group: '常规翻译' },
    { value: 'google', label: 'Google Translate', group: '常规翻译' },
    { value: 'deepl', label: 'DeepL', group: '常规翻译' },
    { value: 'deeplx', label: 'DeepLX', group: '常规翻译' },
];

export const POPUP_OCR_ENGINE_OPTIONS: AppOption<'local' | 'cloud' | 'paddle_local'>[] = [
    { value: 'cloud', label: 'Google Vision', group: '云端 OCR' },
    { value: 'local', label: 'Tesseract OCR', group: '本地 OCR' },
    { value: 'paddle_local', label: 'PaddleOCR 本地服务', group: '本地 OCR' },
];

export const OCR_ENGINE_OPTIONS: AppOption<'local' | 'cloud' | 'paddle_local'>[] = [
    { value: 'cloud', label: 'Google Cloud Vision', group: '云端 OCR' },
    { value: 'local', label: 'Tesseract OCR', group: '本地 OCR' },
    { value: 'paddle_local', label: 'PaddleOCR 本地服务', group: '本地 OCR' },
];

export const SITE_POLICY_OPTIONS: AppOption<'auto_detect' | 'whitelist_only' | 'always_show'>[] = [
    { value: 'auto_detect', label: '自动检测后显示' },
    { value: 'whitelist_only', label: '仅白名单站点' },
    { value: 'always_show', label: '始终显示' },
];

export const DEV_PHASE_OPTIONS: AppOption<'roi' | 'ocr' | 'translate' | 'full'>[] = [
    { value: 'roi', label: '阶段 A · ROI' },
    { value: 'ocr', label: '阶段 B · OCR' },
    { value: 'translate', label: '阶段 C · 翻译' },
    { value: 'full', label: '阶段 D · 完整流程' },
];

export interface AppOption<T extends string> {
    value: T;
    label: string;
    description?: string;
    shortLabel?: string;
    group?: string;
}

export const SOURCE_LANGUAGE_OPTIONS: AppOption<'auto' | 'ko' | 'ja' | 'en' | 'zh'>[] = [
    {
        value: 'auto',
        label: '自动检测',
        description: '优先让 OCR / 翻译链路自动判断原文语言',
        shortLabel: 'Auto',
    },
    {
        value: 'ko',
        label: '韩语',
        description: '当前主攻方向，适合韩漫页面',
        shortLabel: 'KO',
    },
    {
        value: 'ja',
        label: '日语',
        description: '适合日漫场景',
        shortLabel: 'JA',
    },
    {
        value: 'en',
        label: '英语',
        description: '适合英文漫画或英文站点',
        shortLabel: 'EN',
    },
    {
        value: 'zh',
        label: '简体中文',
        description: '适合中文原文场景',
        shortLabel: 'ZH',
    },
];

export const TARGET_LANGUAGE_OPTIONS: AppOption<'zh' | 'ko' | 'ja' | 'en'>[] = [
    {
        value: 'zh',
        label: '简体中文',
        description: '输出简体中文译文',
        shortLabel: 'ZH',
    },
    {
        value: 'ko',
        label: '韩语',
        description: '输出韩语译文',
        shortLabel: 'KO',
    },
    {
        value: 'ja',
        label: '日语',
        description: '输出日语译文',
        shortLabel: 'JA',
    },
    {
        value: 'en',
        label: '英语',
        description: '输出英语译文',
        shortLabel: 'EN',
    },
];

export const TRANSLATION_ENGINE_OPTIONS: AppOption<'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl'>[] = [
    {
        value: 'microsoft',
        label: 'Microsoft Translator',
        description: '免额外模型配置，适合轻量测试',
        group: '常规翻译',
    },
    {
        value: 'google',
        label: 'Google Translate',
        description: '响应快，便于快速验证',
        group: '常规翻译',
    },
    {
        value: 'openai',
        label: 'OpenAI 兼容 API',
        description: '适配 GPT / DeepSeek / Qwen 等兼容接口',
        group: 'AI 翻译',
    },
    {
        value: 'deeplx',
        label: 'DeepLX',
        description: '适合自建或第三方 DeepLX 服务',
        group: '常规翻译',
    },
    {
        value: 'deepl',
        label: 'DeepL 官方 API',
        description: '需要配置官方 API Key',
        group: '常规翻译',
    },
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

export const POPUP_TRANSLATION_ENGINE_OPTIONS: AppOption<'microsoft' | 'google' | 'openai' | 'deeplx' | 'deepl'>[] = [
    { value: 'openai', label: 'OpenAI 兼容', group: 'AI 翻译' },
    { value: 'microsoft', label: 'Microsoft Translator', group: '常规翻译' },
    { value: 'google', label: 'Google Translate', group: '常规翻译' },
    { value: 'deepl', label: 'DeepL', group: '常规翻译' },
    { value: 'deeplx', label: 'DeepLX', group: '常规翻译' },
];

export const POPUP_OCR_ENGINE_OPTIONS: AppOption<'local' | 'cloud'>[] = [
    { value: 'local', label: '本地 OCR' },
    { value: 'cloud', label: 'Google Vision' },
];

export const OCR_ENGINE_OPTIONS: AppOption<'local' | 'cloud'>[] = [
    {
        value: 'local',
        label: '本地 OCR',
        description: '当前内置方案，免额外云端配置',
    },
    {
        value: 'cloud',
        label: 'Google Cloud Vision',
        description: '云端 OCR，需要配置 API Key',
    },
];

export const SITE_POLICY_OPTIONS: AppOption<'auto_detect' | 'whitelist_only' | 'always_show'>[] = [
    {
        value: 'auto_detect',
        label: '全站预检后显示',
        description: '仅检测到漫画图片时显示悬浮球',
    },
    {
        value: 'whitelist_only',
        label: '仅白名单站点',
        description: '只在列出的域名上启用',
    },
    {
        value: 'always_show',
        label: '始终显示',
        description: '在所有页面上显示悬浮球',
    },
];

export const DEV_PHASE_OPTIONS: AppOption<'roi' | 'ocr' | 'translate' | 'full'>[] = [
    {
        value: 'roi',
        label: '阶段 A · ROI',
        description: '仅执行检测区域，不调用 OCR',
    },
    {
        value: 'ocr',
        label: '阶段 B · OCR',
        description: '执行 ROI + OCR，不继续翻译',
    },
    {
        value: 'translate',
        label: '阶段 C · 翻译',
        description: '执行 OCR + 翻译，不做最终渲染',
    },
    {
        value: 'full',
        label: '阶段 D · 完整流程',
        description: '执行擦除、渲染与最终展示',
    },
];

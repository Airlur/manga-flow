import type {
    AutoTranslateConfig,
    BilingualModeConfig,
    KeyboardShortcut,
    KeyboardShortcutsConfig,
    OpenAIProvider,
    QWenConfig,
    Settings,
} from '../types';

const DEFAULT_OPENAI_MODEL = '';
export const DEFAULT_PADDLE_OCR_SERVER_URL = 'http://127.0.0.1:18733';
export const DEFAULT_QWEN_API_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const LEGACY_PROVIDER_NAME_PATTERNS = [/\?/];

const DEFAULT_QWEN_CONFIG: QWenConfig = {
    apiKey: '',
    model: 'qwen-turbo',
    apiBaseUrl: DEFAULT_QWEN_API_BASE_URL,
};

const DEFAULT_BILINGUAL_MODE_CONFIG: BilingualModeConfig = {
    enabled: false,
    showOriginalText: true,
    originalTextOpacity: 0.6,
    originalTextPosition: 'top',
};

const DEFAULT_AUTO_TRANSLATE_CONFIG: AutoTranslateConfig = {
    enabled: false,
    autoStartOnComicSites: false,
};

function createDefaultShortcut(
    id: string,
    name: string,
    key: string,
    ctrl = false,
    alt = false,
    shift = false
): KeyboardShortcut {
    return { id, name, key, ctrl, alt, shift, enabled: true };
}

const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcutsConfig = {
    toggleTranslation: createDefaultShortcut('toggleTranslation', '开关全局翻译', 'T', true, false, false),
    clearCache: createDefaultShortcut('clearCache', '清空缓存', 'C', true, true, false),
    switchEngine: createDefaultShortcut('switchEngine', '切换翻译引擎', 'E', true, false, false),
    pauseOCR: createDefaultShortcut('pauseOCR', '暂停 OCR 识别', 'P', true, false, false),
    invokeSelection: createDefaultShortcut('invokeSelection', '呼出手动选区', 'S', true, false, false),
    exportCurrent: createDefaultShortcut('exportCurrent', '导出当前页面', 'D', true, false, false),
};

function createProviderId(index: number): string {
    return `openai-provider-${index + 1}`;
}

function getFallbackProviderName(index: number): string {
    return index === 0 ? '默认服务商' : `服务商 ${index + 1}`;
}

function normalizeProviderName(name: string | undefined, index: number): string {
    const trimmed = name?.trim() || '';
    if (!trimmed || LEGACY_PROVIDER_NAME_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return getFallbackProviderName(index);
    }
    return trimmed;
}

function normalizeModelName(value: string | undefined): string {
    return value?.trim() || '';
}

export function createOpenAIProvider(
    seed: Partial<OpenAIProvider> = {},
    index = 0
): OpenAIProvider {
    const model = normalizeModelName(seed.model);
    const models = Array.from(
        new Set([model, ...(seed.models || [])].map((item) => item.trim()).filter(Boolean))
    );

    return {
        id: seed.id?.trim() || createProviderId(index),
        name: normalizeProviderName(seed.name, index),
        apiBaseUrl: seed.apiBaseUrl?.trim() || '',
        apiKey: seed.apiKey?.trim() || '',
        model: model || models[0] || DEFAULT_OPENAI_MODEL,
        models,
        enabled: seed.enabled ?? true,
    };
}

export function getEnabledOpenAIProviders(settings?: Partial<Settings>): OpenAIProvider[] {
    const normalized = normalizeSettings(settings);
    return normalized.openaiProviders?.filter((provider) => provider.enabled) ?? [];
}

export function getPrimaryOpenAIProvider(settings?: Partial<Settings>): OpenAIProvider | null {
    const normalized = normalizeSettings(settings);
    return normalized.openaiProviders?.find((provider) => provider.enabled)
        ?? normalized.openaiProviders?.[0]
        ?? null;
}

function normalizeOpenAIProviders(settings?: Partial<Settings>): OpenAIProvider[] {
    const providers = Array.isArray(settings?.openaiProviders) ? settings.openaiProviders : [];

    if (providers.length > 0) {
        return providers.map((provider, index) => createOpenAIProvider(provider, index));
    }

    return [
        createOpenAIProvider({
            id: 'openai-provider-1',
            name: '默认服务商',
            apiBaseUrl: settings?.apiBaseUrl || '',
            apiKey: settings?.apiKey || '',
            model: settings?.model || DEFAULT_OPENAI_MODEL,
            models: settings?.model ? [settings.model] : [],
            enabled: true,
        }),
    ];
}

function normalizeQWenConfig(config?: Partial<QWenConfig>): QWenConfig {
    return {
        ...DEFAULT_QWEN_CONFIG,
        ...config,
        apiKey: config?.apiKey?.trim() || '',
        model: config?.model?.trim() || DEFAULT_QWEN_CONFIG.model,
        apiBaseUrl: config?.apiBaseUrl?.trim() || DEFAULT_QWEN_CONFIG.apiBaseUrl,
    };
}

function normalizeBilingualModeConfig(config?: Partial<BilingualModeConfig>): BilingualModeConfig {
    return {
        ...DEFAULT_BILINGUAL_MODE_CONFIG,
        ...config,
        enabled: config?.enabled ?? DEFAULT_BILINGUAL_MODE_CONFIG.enabled,
        showOriginalText: config?.showOriginalText ?? DEFAULT_BILINGUAL_MODE_CONFIG.showOriginalText,
        originalTextOpacity: Math.min(1, Math.max(0, config?.originalTextOpacity ?? DEFAULT_BILINGUAL_MODE_CONFIG.originalTextOpacity)),
        originalTextPosition: config?.originalTextPosition === 'bottom' ? 'bottom' : 'top',
    };
}

function normalizeAutoTranslateConfig(config?: Partial<AutoTranslateConfig>): AutoTranslateConfig {
    return {
        ...DEFAULT_AUTO_TRANSLATE_CONFIG,
        ...config,
        enabled: config?.enabled ?? DEFAULT_AUTO_TRANSLATE_CONFIG.enabled,
        autoStartOnComicSites: config?.autoStartOnComicSites ?? DEFAULT_AUTO_TRANSLATE_CONFIG.autoStartOnComicSites,
    };
}

function normalizeKeyboardShortcut(shortcut?: Partial<KeyboardShortcut>): KeyboardShortcut {
    return {
        id: shortcut?.id || '',
        name: shortcut?.name || '',
        key: (shortcut?.key || '').toUpperCase(),
        ctrl: Boolean(shortcut?.ctrl),
        alt: Boolean(shortcut?.alt),
        shift: Boolean(shortcut?.shift),
        enabled: shortcut?.enabled ?? true,
    };
}

function normalizeKeyboardShortcutsConfig(config?: Partial<KeyboardShortcutsConfig>): KeyboardShortcutsConfig {
    return {
        toggleTranslation: normalizeKeyboardShortcut(config?.toggleTranslation ?? DEFAULT_KEYBOARD_SHORTCUTS.toggleTranslation),
        clearCache: normalizeKeyboardShortcut(config?.clearCache ?? DEFAULT_KEYBOARD_SHORTCUTS.clearCache),
        switchEngine: normalizeKeyboardShortcut(config?.switchEngine ?? DEFAULT_KEYBOARD_SHORTCUTS.switchEngine),
        pauseOCR: normalizeKeyboardShortcut(config?.pauseOCR ?? DEFAULT_KEYBOARD_SHORTCUTS.pauseOCR),
        invokeSelection: normalizeKeyboardShortcut(config?.invokeSelection ?? DEFAULT_KEYBOARD_SHORTCUTS.invokeSelection),
        exportCurrent: normalizeKeyboardShortcut(config?.exportCurrent ?? DEFAULT_KEYBOARD_SHORTCUTS.exportCurrent),
    };
}

export const DEFAULT_SETTINGS: Settings = {
    sourceLang: 'ko',
    targetLang: 'zh',
    translateEngine: 'google',
    apiBaseUrl: '',
    apiKey: '',
    model: DEFAULT_OPENAI_MODEL,
    openaiProviders: [
        createOpenAIProvider({
            id: 'openai-provider-1',
            name: '默认服务商',
            model: DEFAULT_OPENAI_MODEL,
            models: [],
        }),
    ],
    deeplxUrl: '',
    deeplApiKey: '',
    qwenConfig: { ...DEFAULT_QWEN_CONFIG },
    fontSize: 14,
    fontScale: 1,
    fontColor: '#000000',
    maskOpacity: 0.24,
    bilingualMode: { ...DEFAULT_BILINGUAL_MODE_CONFIG },
    autoTranslate: { ...DEFAULT_AUTO_TRANSLATE_CONFIG },
    ocrEngine: 'local',
    cloudOcrKey: '',
    paddleOcrServerUrl: DEFAULT_PADDLE_OCR_SERVER_URL,
    requestDelay: 0,
    devMode: true,
    devPhase: 'roi',
    showOcrBoxes: true,
    showRoiBoxes: true,
    showMaskBoxes: false,
    sitePolicy: 'auto_detect',
    siteWhitelist: [],
    keyboardShortcuts: { ...DEFAULT_KEYBOARD_SHORTCUTS },
};

export function normalizeSettings(settings?: Partial<Settings>): Settings {
    const openaiProviders = normalizeOpenAIProviders(settings);
    const primaryProvider = openaiProviders.find((provider) => provider.enabled) ?? openaiProviders[0];

    return {
        ...DEFAULT_SETTINGS,
        ...settings,
        apiBaseUrl: primaryProvider?.apiBaseUrl || '',
        apiKey: primaryProvider?.apiKey || '',
        model: primaryProvider?.model || normalizeModelName(settings?.model) || DEFAULT_OPENAI_MODEL,
        openaiProviders,
        targetLang: settings?.targetLang || DEFAULT_SETTINGS.targetLang,
        paddleOcrServerUrl: settings?.paddleOcrServerUrl?.trim() || DEFAULT_SETTINGS.paddleOcrServerUrl,
        sitePolicy: settings?.sitePolicy || DEFAULT_SETTINGS.sitePolicy,
        siteWhitelist: Array.isArray(settings?.siteWhitelist) ? settings.siteWhitelist : [],
        qwenConfig: normalizeQWenConfig(settings?.qwenConfig),
        bilingualMode: normalizeBilingualModeConfig(settings?.bilingualMode),
        autoTranslate: normalizeAutoTranslateConfig(settings?.autoTranslate),
        keyboardShortcuts: normalizeKeyboardShortcutsConfig(settings?.keyboardShortcuts),
    };
}

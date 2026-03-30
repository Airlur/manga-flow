import type { OpenAIProvider, Settings } from '../types';

const DEFAULT_OPENAI_MODEL = '';
export const DEFAULT_PADDLE_OCR_SERVER_URL = 'http://127.0.0.1:18733';
const LEGACY_PROVIDER_NAME_PATTERNS = [/\?/];

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
    fontSize: 14,
    fontScale: 1,
    fontColor: '#000000',
    maskOpacity: 0.24,
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
    };
}

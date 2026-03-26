import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
    sourceLang: 'ko',
    targetLang: 'zh',
    translateEngine: 'google',
    apiBaseUrl: '',
    apiKey: '',
    model: 'gpt-4o-mini',
    deeplxUrl: '',
    deeplApiKey: '',
    fontSize: 14,
    fontScale: 1,
    fontColor: '#000000',
    maskOpacity: 0.24,
    ocrEngine: 'local',
    cloudOcrKey: '',
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
    return {
        ...DEFAULT_SETTINGS,
        ...settings,
        targetLang: 'zh',
        sitePolicy: settings?.sitePolicy || DEFAULT_SETTINGS.sitePolicy,
        siteWhitelist: Array.isArray(settings?.siteWhitelist) ? settings.siteWhitelist : [],
    };
}

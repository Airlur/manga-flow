import type { WebDAVConfig } from '../types';

export const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
    serverUrl: '',
    username: '',
    password: '',
    rememberPassword: true,
    autoSync: false,
    syncDelaySeconds: 2,
    backupLimit: 6,
};

export function normalizeWebDAVConfig(config?: Partial<WebDAVConfig>): WebDAVConfig {
    return {
        ...DEFAULT_WEBDAV_CONFIG,
        ...config,
        serverUrl: config?.serverUrl?.trim() || '',
        username: config?.username?.trim() || '',
        password: config?.password || '',
        rememberPassword: config?.rememberPassword ?? DEFAULT_WEBDAV_CONFIG.rememberPassword,
        autoSync: config?.autoSync ?? DEFAULT_WEBDAV_CONFIG.autoSync,
        syncDelaySeconds: clampNumber(config?.syncDelaySeconds, 1, 30, DEFAULT_WEBDAV_CONFIG.syncDelaySeconds),
        backupLimit: clampNumber(config?.backupLimit, 5, 50, DEFAULT_WEBDAV_CONFIG.backupLimit),
    };
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
    const normalized = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(Math.max(Math.round(normalized), min), max);
}

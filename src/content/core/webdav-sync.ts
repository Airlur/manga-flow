import { normalizeSettings } from '../../config/default-settings';
import { normalizeWebDAVConfig } from '../../config/webdav-defaults';
import type {
    FloatingBallPrefs,
    Settings,
    SyncSnapshot,
    WebDAVBackupItem,
    WebDAVConfig,
} from '../../types';

const LATEST_FILE_NAME = 'mangaflow_latest.json';
const BACKUP_FILE_PREFIX = 'mangaflow_backup_';
const BACKUP_FILE_SUFFIX = '.json';
const REMOTE_DIR_NAME = 'mangaflow';
const SNAPSHOT_SCHEMA_VERSION = 1;
const ensuredDirectoryUrls = new Set<string>();

interface ProxyResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export function createSyncSnapshot(settings: Settings, floatingBallPrefs: FloatingBallPrefs): SyncSnapshot {
    return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        app: 'MangaFlow',
        exportedAt: new Date().toISOString(),
        settings: normalizeSettings(settings),
        floatingBallPrefs: {
            globallyDisabled: Boolean(floatingBallPrefs.globallyDisabled),
            disabledSites: Array.isArray(floatingBallPrefs.disabledSites) ? floatingBallPrefs.disabledSites : [],
        },
    };
}

export function validateSyncSnapshot(raw: unknown): SyncSnapshot {
    if (!raw || typeof raw !== 'object') {
        throw new Error('同步文件格式无效');
    }

    const candidate = raw as Partial<SyncSnapshot>;
    if (candidate.app !== 'MangaFlow') {
        throw new Error('同步文件不是 MangaFlow 导出');
    }

    return {
        schemaVersion: typeof candidate.schemaVersion === 'number' ? candidate.schemaVersion : SNAPSHOT_SCHEMA_VERSION,
        app: 'MangaFlow',
        exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
        settings: normalizeSettings(candidate.settings),
        floatingBallPrefs: {
            globallyDisabled: Boolean(candidate.floatingBallPrefs?.globallyDisabled),
            disabledSites: Array.isArray(candidate.floatingBallPrefs?.disabledSites)
                ? candidate.floatingBallPrefs?.disabledSites
                : [],
        },
    };
}

export async function testWebDAVConnection(config: Partial<WebDAVConfig>): Promise<void> {
    const normalized = assertWebDAVConfig(config);
    await requestWebDAV(buildWebDAVCollectionUrl(normalized.serverUrl), {
        method: 'PROPFIND',
        headers: {
            ...buildAuthHeaders(normalized),
            Depth: '0',
        },
    });

    await ensureSyncDirectory(normalized);
}

export async function pushSyncSnapshot(config: Partial<WebDAVConfig>, snapshot: SyncSnapshot): Promise<{ fileName: string }> {
    const normalized = assertWebDAVConfig(config);
    await ensureSyncDirectory(normalized);
    const payload = JSON.stringify(snapshot, null, 2);
    const latestUrl = buildSyncFileUrl(normalized.serverUrl, LATEST_FILE_NAME);
    const backupFileName = buildBackupFileName(new Date(snapshot.exportedAt));
    const backupUrl = buildSyncFileUrl(normalized.serverUrl, backupFileName);

    await requestWebDAV(latestUrl, {
        method: 'PUT',
        headers: {
            ...buildAuthHeaders(normalized),
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: payload,
    });

    await requestWebDAV(backupUrl, {
        method: 'PUT',
        headers: {
            ...buildAuthHeaders(normalized),
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: payload,
    });

    const backups = await listWebDAVBackups(normalized);
    const outdatedBackups = backups
        .filter((item) => !item.isLatest)
        .slice(normalized.backupLimit);

    for (const item of outdatedBackups) {
        await deleteWebDAVBackup(normalized, item.fileName);
    }

    return { fileName: backupFileName };
}

export async function pullLatestSnapshot(config: Partial<WebDAVConfig>): Promise<SyncSnapshot> {
    const normalized = assertWebDAVConfig(config);
    await ensureSyncDirectory(normalized);
    return fetchSnapshot(normalized, LATEST_FILE_NAME);
}

export async function restoreBackupSnapshot(config: Partial<WebDAVConfig>, fileName: string): Promise<SyncSnapshot> {
    const normalized = assertWebDAVConfig(config);
    await ensureSyncDirectory(normalized);
    return fetchSnapshot(normalized, fileName);
}

export async function listWebDAVBackups(config: Partial<WebDAVConfig>): Promise<WebDAVBackupItem[]> {
    const normalized = assertWebDAVConfig(config);
    await ensureSyncDirectory(normalized);
    const xml = await requestWebDAV<string>(buildSyncDirectoryUrl(normalized.serverUrl), {
        method: 'PROPFIND',
        headers: {
            ...buildAuthHeaders(normalized),
            Depth: '1',
        },
    });

    return parseWebDAVList(xml);
}

export async function deleteWebDAVBackup(config: Partial<WebDAVConfig>, fileName: string): Promise<void> {
    const normalized = assertWebDAVConfig(config);
    await requestWebDAV(buildSyncFileUrl(normalized.serverUrl, fileName), {
        method: 'DELETE',
        headers: buildAuthHeaders(normalized),
    });
}

function assertWebDAVConfig(config?: Partial<WebDAVConfig>): WebDAVConfig {
    const normalized = normalizeWebDAVConfig(config);

    if (!normalized.serverUrl) {
        throw new Error('请先填写服务器地址');
    }

    if (!normalized.username) {
        throw new Error('请先填写用户名');
    }

    if (!normalized.password) {
        throw new Error('请先填写密码');
    }

    return normalized;
}

async function fetchSnapshot(config: WebDAVConfig, fileName: string): Promise<SyncSnapshot> {
    const raw = await requestWebDAV<unknown>(buildSyncFileUrl(config.serverUrl, fileName), {
        method: 'GET',
        headers: {
            ...buildAuthHeaders(config),
            Accept: 'application/json',
        },
    });

    if (typeof raw === 'string') {
        return validateSyncSnapshot(JSON.parse(raw));
    }

    return validateSyncSnapshot(raw);
}

async function requestWebDAV<T = unknown>(url: string, options: RequestInit, timeoutMs = 15000): Promise<T> {
    const normalizedOptions = new Headers(options.headers || {});

    const response = await chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        url,
        timeoutMs,
        options: {
            ...options,
            headers: Object.fromEntries(normalizedOptions.entries()),
        },
    }) as ProxyResponse<T>;

    if (!response?.success) {
        throw new Error(response?.error || 'WebDAV 请求失败');
    }

    return response.data as T;
}

function buildWebDAVCollectionUrl(serverUrl: string, directoryName = ''): string {
    const normalizedBase = serverUrl.trim().replace(/\/+$/, '');
    return directoryName
        ? `${normalizedBase}/${encodeURIComponent(directoryName)}/`
        : `${normalizedBase}/`;
}

function buildSyncDirectoryUrl(serverUrl: string): string {
    return buildWebDAVCollectionUrl(serverUrl, REMOTE_DIR_NAME);
}

function buildSyncDirectoryCreateUrl(serverUrl: string): string {
    const normalizedBase = serverUrl.trim().replace(/\/+$/, '');
    return `${normalizedBase}/${encodeURIComponent(REMOTE_DIR_NAME)}`;
}

function buildSyncFileUrl(serverUrl: string, fileName: string): string {
    return `${buildSyncDirectoryUrl(serverUrl).replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`;
}

function buildBackupFileName(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mi = `${date.getMinutes()}`.padStart(2, '0');
    const ss = `${date.getSeconds()}`.padStart(2, '0');
    return `${BACKUP_FILE_PREFIX}${yyyy}${mm}${dd}-${hh}${mi}${ss}${BACKUP_FILE_SUFFIX}`;
}

function parseWebDAVList(xml: string): WebDAVBackupItem[] {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(xml, 'application/xml');
    const responseNodes = Array.from(documentNode.getElementsByTagNameNS('*', 'response'));

    const items: WebDAVBackupItem[] = [];

    responseNodes.forEach((node) => {
        const href = getNodeText(node, 'href');
        if (!href) return;

        const fileName = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
        if (!fileName) return;

        if (fileName !== LATEST_FILE_NAME && !isBackupFileName(fileName)) {
            return;
        }

        items.push({
            fileName,
            label: fileName === LATEST_FILE_NAME ? '最新版本' : formatBackupLabel(fileName),
            lastModified: getNodeText(node, 'getlastmodified') || undefined,
            size: parseOptionalNumber(getNodeText(node, 'getcontentlength')),
            isLatest: fileName === LATEST_FILE_NAME,
        });
    });

    return items.sort((left, right) => {
        if (left.isLatest) return -1;
        if (right.isLatest) return 1;
        return right.fileName.localeCompare(left.fileName);
    });
}

function buildAuthHeaders(config: WebDAVConfig): Record<string, string> {
    const token = encodeBasicToken(`${config.username}:${config.password}`);
    return {
        Authorization: `Basic ${token}`,
    };
}

function encodeBasicToken(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';

    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}

async function ensureSyncDirectory(config: WebDAVConfig): Promise<void> {
    const directoryUrl = buildSyncDirectoryUrl(config.serverUrl);
    const createUrl = buildSyncDirectoryCreateUrl(config.serverUrl);

    if (ensuredDirectoryUrls.has(directoryUrl)) {
        return;
    }

    try {
        await verifySyncDirectory(config, directoryUrl);
        ensuredDirectoryUrls.add(directoryUrl);
        return;
    } catch (error) {
        if (!hasStatusCode(error, 404)) {
            throw error;
        }
    }

    try {
        await requestWebDAV(createUrl, {
            method: 'MKCOL',
            headers: buildAuthHeaders(config),
        });
    } catch (error) {
        if (!hasStatusCode(error, 405) && !hasStatusCode(error, 409) && !hasStatusCode(error, 301) && !hasStatusCode(error, 302)) {
            throw error;
        }
    }

    await verifySyncDirectory(config, directoryUrl);
    ensuredDirectoryUrls.add(directoryUrl);
}

async function verifySyncDirectory(config: WebDAVConfig, directoryUrl: string): Promise<void> {
    await requestWebDAV(directoryUrl, {
        method: 'PROPFIND',
        headers: {
            ...buildAuthHeaders(config),
            Depth: '0',
        },
    });
}

function hasStatusCode(error: unknown, statusCode: number): boolean {
    const message = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '';

    return new RegExp(`\b${statusCode}\b`).test(message);
}

function getNodeText(parent: Element, localName: string): string {
    const node = parent.getElementsByTagNameNS('*', localName)[0];
    return node?.textContent?.trim() || '';
}

function parseOptionalNumber(value: string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function isBackupFileName(fileName: string): boolean {
    return fileName.startsWith(BACKUP_FILE_PREFIX) && fileName.endsWith(BACKUP_FILE_SUFFIX);
}

function formatBackupLabel(fileName: string): string {
    const matched = fileName.match(/^mangaflow_backup_(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/);
    if (!matched) return fileName;

    const [, yyyy, mm, dd, hh, mi, ss] = matched;
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

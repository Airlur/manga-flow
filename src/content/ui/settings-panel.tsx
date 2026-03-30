import { createRoot, type Root } from 'react-dom/client';

import { DEV_MODE } from '../../config/app-config';
import { normalizeSettings } from '../../config/default-settings';
import { normalizeWebDAVConfig } from '../../config/webdav-defaults';
import type { Settings, SyncSnapshot, WebDAVBackupItem, WebDAVConfig } from '../../types';
import { showToast } from './toast';
import { SettingsPanelView } from './settings-panel-view';

interface SettingsPanelOptions {
    onSave: (settings: Settings) => void | Promise<void>;
    onSaveWebDAVConfig: (config: WebDAVConfig) => Promise<void>;
    onClose: () => void;
    onClearOCRCache: () => Promise<void>;
    onClearTranslationCache: () => Promise<void>;
    onTestWebDAV: (config: WebDAVConfig) => Promise<void>;
    onPushWebDAV: (config: WebDAVConfig, settings: Settings) => Promise<{ fileName: string }>;
    onPullWebDAV: (config: WebDAVConfig) => Promise<SyncSnapshot>;
    onListWebDAVBackups: (config: WebDAVConfig) => Promise<WebDAVBackupItem[]>;
    onRestoreWebDAVBackup: (config: WebDAVConfig, fileName: string) => Promise<SyncSnapshot>;
    onDeleteWebDAVBackup: (config: WebDAVConfig, fileName: string) => Promise<void>;
}

interface SettingsPanelInitialState {
    settings: Settings;
    webdavConfig: WebDAVConfig;
}

export class SettingsPanel {
    private readonly options: SettingsPanelOptions;
    private element: HTMLElement | null = null;
    private root: Root | null = null;
    private isVisible = false;
    private renderKey = 0;
    private currentSettings = normalizeSettings();
    private currentWebDAVConfig = normalizeWebDAVConfig();

    constructor(options: SettingsPanelOptions) {
        this.options = options;
        this.createElement();
        this.render();
    }

    show(): void {
        void this.open();
    }

    hide(): void {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.render();
        this.options.onClose();
    }

    private async open(): Promise<void> {
        const nextState = await this.loadPanelState();
        if (!nextState) return;

        this.currentSettings = nextState.settings;
        this.currentWebDAVConfig = nextState.webdavConfig;
        this.isVisible = true;
        this.renderKey += 1;
        this.render();
    }

    private createElement(): void {
        const element = document.createElement('div');
        element.id = 'manga-flow-settings-root';
        element.className = 'manga-flow-settings-root';
        document.body.appendChild(element);

        this.element = element;
        this.root = createRoot(element);
    }

    private render(): void {
        if (!this.root) return;

        this.root.render(
            <SettingsPanelView
                visible={this.isVisible}
                initialSettings={this.currentSettings}
                initialWebDAVConfig={this.currentWebDAVConfig}
                renderKey={this.renderKey}
                showDevTools={DEV_MODE}
                onClose={() => this.hide()}
                onClearOCRCache={this.options.onClearOCRCache}
                onClearTranslationCache={this.options.onClearTranslationCache}
                onSaveWebDAVConfig={this.options.onSaveWebDAVConfig}
                onTestWebDAV={this.options.onTestWebDAV}
                onPushWebDAV={this.options.onPushWebDAV}
                onPullWebDAV={this.options.onPullWebDAV}
                onListWebDAVBackups={this.options.onListWebDAVBackups}
                onRestoreWebDAVBackup={this.options.onRestoreWebDAVBackup}
                onDeleteWebDAVBackup={this.options.onDeleteWebDAVBackup}
                onSave={async (settings) => {
                    await this.options.onSave(settings);
                    this.hide();
                }}
            />
        );
    }

    private async loadPanelState(): Promise<SettingsPanelInitialState | null> {
        if (!chrome?.runtime?.id) {
            console.warn('[MangaFlow] 扩展上下文已失效，请重新加载扩展');
            showToast('扩展上下文已失效，请重新加载扩展', 'warning');
            return null;
        }

        try {
            const result = await chrome.storage.local.get(['settings', 'webdavConfig']);
            return {
                settings: normalizeSettings(result.settings as Partial<Settings> | undefined),
                webdavConfig: normalizeWebDAVConfig(result.webdavConfig as Partial<WebDAVConfig> | undefined),
            };
        } catch (error) {
            console.error('[MangaFlow] 读取设置失败:', error);
            showToast('读取设置失败，请稍后重试', 'error');
            return null;
        }
    }
}

import { createRoot, type Root } from 'react-dom/client';

import { DEV_MODE } from '../../config/app-config';
import { normalizeSettings } from '../../config/default-settings';
import type { Settings } from '../../types';
import { showToast } from './toast';
import { SettingsPanelView } from './settings-panel-view';

interface SettingsPanelOptions {
    onSave: (settings: Settings) => void;
    onClose: () => void;
    onClearOCRCache: () => Promise<void>;
    onClearTranslationCache: () => Promise<void>;
}

export class SettingsPanel {
    private readonly options: SettingsPanelOptions;
    private element: HTMLElement | null = null;
    private root: Root | null = null;
    private isVisible = false;
    private renderKey = 0;
    private currentSettings = normalizeSettings();

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
        const nextSettings = await this.loadSettings();
        if (!nextSettings) return;

        this.currentSettings = nextSettings;
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
                renderKey={this.renderKey}
                showDevTools={DEV_MODE}
                onClose={() => this.hide()}
                onClearOCRCache={this.options.onClearOCRCache}
                onClearTranslationCache={this.options.onClearTranslationCache}
                onSave={(settings) => {
                    this.options.onSave(settings);
                    this.hide();
                }}
            />
        );
    }

    private async loadSettings(): Promise<Settings | null> {
        if (!chrome?.runtime?.id) {
            console.warn('[MangaFlow] 扩展上下文已失效，无法读取设置。');
            showToast('扩展上下文已失效，请刷新页面后重试。', 'warning');
            return null;
        }

        try {
            const result = await chrome.storage.local.get('settings');
            return normalizeSettings(result.settings as Partial<Settings> | undefined);
        } catch (error) {
            console.error('[MangaFlow] 读取设置失败:', error);
            showToast('读取设置失败，请稍后重试。', 'error');
            return null;
        }
    }
}

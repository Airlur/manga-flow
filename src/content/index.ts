// 漫译 MangaFlow - 内容脚本入口
// 负责悬浮球显示策略、翻译流程与运行态切换

import { FloatingBall } from './ui/floating-ball';
import { SettingsPanel } from './ui/settings-panel';
import { ImageDetector } from './core/image-detector';
import { TranslationController } from './core/translation-controller';
import { DebugOverlayManager } from './core/debug-overlay';
import { showToast } from './ui/toast';
import { DEFAULT_SETTINGS, normalizeSettings } from '../config/default-settings';
import type {
    Settings,
    StageTimings,
    ImageTranslationResult,
    FloatingBallState,
} from '../types';

type ViewMode = 'original' | 'translated';

interface TranslatedImageRecord {
    originalSrc: string;
    translatedSrc: string;
}

interface FloatingBallPrefs {
    globallyDisabled: boolean;
    disabledSites: string[];
}

class MangaFlow {
    private floatingBall: FloatingBall | null = null;
    private settingsPanel: SettingsPanel | null = null;
    private imageDetector: ImageDetector | null = null;
    private translationController: TranslationController | null = null;
    private isInitialized = false;
    private isTranslating = false;
    private translatedImages: Set<string> = new Set();
    private translatedImageRecords = new Map<HTMLImageElement, TranslatedImageRecord>();
    private settings: Settings = DEFAULT_SETTINGS;
    private pageQualified = false;
    private floatingBallHiddenForTab = false;
    private viewMode: ViewMode = 'translated';
    private ballState: FloatingBallState = 'idle';
    private stageTimings: StageTimings = this.createEmptyTimings();
    private elapsedTimerId: number | null = null;
    private elapsedBaseMs = 0;
    private elapsedStartedAt: number | null = null;
    private floatingBallPrefs: FloatingBallPrefs = {
        globallyDisabled: false,
        disabledSites: [],
    };

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            await this.setup();
        }
    }

    private async setup(): Promise<void> {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('漫译 MangaFlow 初始化中...');
        this.settings = await this.loadStoredSettings();
        this.floatingBallPrefs = await this.loadFloatingBallPrefs();

        this.floatingBall = new FloatingBall({
            onStart: () => this.startTranslation(),
            onPause: () => this.pauseTranslation(),
            onSettings: () => this.openSettings(),
            onDisableSite: () => this.disableCurrentSite(),
            onDisableGlobal: () => this.disableGlobally(),
            onToggleView: () => this.toggleViewMode(),
        });

        this.settingsPanel = new SettingsPanel({
            onSave: (settings) => this.saveSettings(settings),
            onClearOCRCache: () => this.clearOCRCache(),
            onClearTranslationCache: () => this.clearTranslationCache(),
            onClose: () => {
                console.log('[MangaFlow] 设置面板已关闭');
            },
        });

        this.imageDetector = new ImageDetector();
        this.translationController = new TranslationController();
        this.translationController.updateSettings(this.settings);
        this.translationController.setOnImageTranslated((result, img) => {
            this.handleImageTranslated(result, img);
        });

        this.imageDetector.setOnNewImage((img) => {
            this.onNewImageDetected(img);
        });
        this.imageDetector.setOnComicImageDetected((img) => {
            this.onComicImageQualified(img);
        });

        this.floatingBall.mount();
        this.floatingBall.setViewMode(this.viewMode);
        this.floatingBall.setHasTranslationResult(false);
        this.updateFloatingBallState('idle');

        await this.evaluatePageQualification();
        this.bindRuntimeMessages();

        console.log('漫译 MangaFlow 初始化完成');
    }

    private bindRuntimeMessages(): void {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message.type === 'START_TRANSLATION') {
                this.startTranslation()
                    .then(() => sendResponse({ success: true }))
                    .catch((error) => sendResponse({ success: false, error: (error as Error).message }));
                return true;
            }

            if (message.type === 'OPEN_SETTINGS') {
                this.openSettings();
                sendResponse({ success: true });
                return true;
            }

            if (message.type === 'CLEAR_CACHE') {
                this.clearCaches()
                    .then(() => {
                        sendResponse({ success: true });
                    })
                    .catch((error) => {
                        console.error('[MangaFlow] 清除缓存失败:', error);
                        sendResponse({ success: false, error: (error as Error).message });
                    });
                return true;
            }

            if (message.type === 'RESTORE_FLOATING_BALL') {
                const visible = this.restoreFloatingBallFromPopup();
                sendResponse({
                    success: visible,
                    visible,
                    qualified: this.pageQualified,
                });
                return true;
            }

            if (message.type === 'DISABLE_CURRENT_SITE_FLOATING_BALL') {
                this.disableCurrentSite()
                    .then(() => sendResponse({ success: true }))
                    .catch((error) => sendResponse({ success: false, error: (error as Error).message }));
                return true;
            }

            if (message.type === 'ENABLE_CURRENT_SITE_FLOATING_BALL') {
                this.restoreFloatingBallFromPopup()
                    .then((visible) => sendResponse({
                        success: true,
                        visible,
                        qualified: this.pageQualified,
                    }))
                    .catch((error) => sendResponse({ success: false, error: (error as Error).message }));
                return true;
            }

            if (message.type === 'HIDE_FLOATING_BALL') {
                this.hideFloatingBallForTab();
                sendResponse({ success: true });
                return true;
            }

            if (message.type === 'TOGGLE_VIEW_MODE') {
                const viewMode = this.toggleViewMode();
                sendResponse({ success: !!viewMode, viewMode });
                return true;
            }

            return false;
        });
    }

    private async onNewImageDetected(img: HTMLImageElement): Promise<void> {
        if (!this.isTranslating) return;

        const src = this.getOriginalSrc(img);
        if (!src || img.dataset.mfTranslated === '1' || this.translatedImages.has(src)) return;

        console.log('[MangaFlow] 检测到新图片，自动翻译:', src.substring(0, 50));
        this.translatedImages.add(src);

        try {
            await this.translationController?.translateSingleImage(img);
        } catch (error) {
            console.error('[MangaFlow] 自动翻译失败:', error);
        }
    }

    private onComicImageQualified(_img: HTMLImageElement): void {
        if (!this.pageQualified) {
            this.pageQualified = true;
            console.log('[MangaFlow] 页面通过漫画图片预检，允许显示悬浮球');
        }

        if (this.shouldShowFloatingBall()) {
            this.floatingBall?.show();
        }
    }

    private async evaluatePageQualification(): Promise<void> {
        const images = this.imageDetector?.getComicImages() || [];
        this.pageQualified = images.length > 0;
        console.log(`[MangaFlow] 页面预检结果：${this.pageQualified ? '漫画页' : '非漫画页'}（${images.length} 张候选图）`);
        this.applyFloatingBallVisibility();
    }

    private shouldShowFloatingBall(): boolean {
        if (this.floatingBallHiddenForTab) return false;
        if (this.floatingBallPrefs.globallyDisabled) return false;
        if (this.isCurrentSiteDisabled()) return false;

        switch (this.settings.sitePolicy) {
            case 'always_show':
                return true;
            case 'whitelist_only':
                return this.isCurrentSiteWhitelisted();
            case 'auto_detect':
            default:
                return this.pageQualified;
        }
    }

    private applyFloatingBallVisibility(): void {
        if (this.shouldShowFloatingBall()) {
            this.floatingBall?.show();
        } else {
            this.floatingBall?.hide();
        }
    }

    private isCurrentSiteWhitelisted(): boolean {
        const host = window.location.hostname;
        const whitelist = this.settings.siteWhitelist || [];
        return whitelist.some((item) => {
            const normalized = item.trim().toLowerCase();
            return normalized && (host === normalized || host.endsWith(`.${normalized}`));
        });
    }

    private isCurrentSiteDisabled(): boolean {
        const host = window.location.hostname.toLowerCase();
        return this.floatingBallPrefs.disabledSites.some((item) => {
            const normalized = item.trim().toLowerCase();
            return normalized && (host === normalized || host.endsWith(`.${normalized}`));
        });
    }

    private async disableCurrentSite(): Promise<void> {
        const host = window.location.hostname.toLowerCase();
        if (!this.floatingBallPrefs.disabledSites.includes(host)) {
            this.floatingBallPrefs.disabledSites.push(host);
            await this.persistFloatingBallPrefs();
        }
        this.hideFloatingBallForTab();
        showToast(`已禁用当前网站悬浮球：${host}`, 'info');
    }

    private async disableGlobally(): Promise<void> {
        this.floatingBallPrefs.globallyDisabled = true;
        await this.persistFloatingBallPrefs();
        this.hideFloatingBallForTab();
        showToast('已全局禁用悬浮球，可在扩展面板重新开启', 'info');
    }

    private async restoreFloatingBallFromPopup(): Promise<boolean> {
        this.floatingBallPrefs.globallyDisabled = false;
        const host = window.location.hostname.toLowerCase();
        this.floatingBallPrefs.disabledSites = this.floatingBallPrefs.disabledSites.filter((item) => {
            const normalized = item.trim().toLowerCase();
            return normalized && normalized !== host;
        });
        await this.persistFloatingBallPrefs();
        this.floatingBallHiddenForTab = false;
        this.applyFloatingBallVisibility();
        return this.shouldShowFloatingBall();
    }

    private hideFloatingBallForTab(): void {
        this.floatingBallHiddenForTab = true;
        this.floatingBall?.hide();
    }

    private async startTranslation(): Promise<void> {
        if (!this.imageDetector || !this.translationController) return;

        const isResume = this.ballState === 'paused';
        if (!isResume) {
            this.stageTimings = this.createEmptyTimings();
            this.resetElapsedClock();
        }

        this.translationController.resume();
        this.isTranslating = true;
        this.updateFloatingBallState('translating');
        this.startElapsedClock();

        try {
            const images = this.imageDetector.getComicImages()
                .filter((img) => img.dataset.mfTranslated !== '1');
            console.log(`检测到 ${images.length} 张漫画图片`);

            if (images.length === 0) {
                this.isTranslating = false;
                this.stopElapsedClock(false);
                this.floatingBall?.hideProgress();
                this.updateFloatingBallState('idle');
                showToast('当前页面未识别到可翻译的漫画图片', 'warning');
                return;
            }

            this.floatingBall?.updateProgress(0, images.length);
            images.forEach((img) => this.translatedImages.add(this.getOriginalSrc(img)));

            const result = await this.translationController.translateImages(images, (progress) => {
                this.floatingBall?.updateProgress(progress.current, progress.total);
            });

            this.stageTimings = result.timings;
            this.stopElapsedClock(true);
            this.isTranslating = true;

            if (result.failed === 0) {
                this.updateFloatingBallState('completed');
                showToast(`翻译完成：${result.success} 张图片｜${this.formatStageSummary(result.timings)}`, 'success', 4500);
            } else if (result.success === 0) {
                this.updateFloatingBallState('error');
                showToast(`翻译失败：${result.failed} 张图片｜${this.formatStageSummary(result.timings)}`, 'error', 4500);
            } else {
                this.updateFloatingBallState('completed');
                showToast(`翻译完成：${result.success} 张成功，${result.failed} 张失败｜${this.formatStageSummary(result.timings)}`, 'warning', 5000);
            }

            this.floatingBall?.setHasTranslationResult(this.translatedImageRecords.size > 0);
        } catch (error) {
            console.error('翻译失败:', error);
            this.isTranslating = false;
            this.stopElapsedClock(true);
            this.updateFloatingBallState('error');
            showToast(`翻译失败：${(error as Error).message}`, 'error');
        }
    }

    private pauseTranslation(): void {
        console.log('暂停翻译');
        this.isTranslating = false;
        this.translationController?.pause();
        this.stopElapsedClock(true);
        this.updateFloatingBallState('paused');
    }

    private handleImageTranslated(result: ImageTranslationResult, img: HTMLImageElement): void {
        if (!result.rendered || !result.renderedSrc) return;

        this.translatedImageRecords.set(img, {
            originalSrc: result.originalSrc,
            translatedSrc: result.renderedSrc,
        });

        this.floatingBall?.setHasTranslationResult(true);

        if (this.viewMode === 'original') {
            img.src = result.originalSrc;
            img.dataset.mfViewMode = 'original';
        } else {
            img.dataset.mfViewMode = 'translated';
        }
    }

    private toggleViewMode(): ViewMode | null {
        if (!this.translatedImageRecords.size) return null;

        this.viewMode = this.viewMode === 'translated' ? 'original' : 'translated';

        for (const [img, record] of this.translatedImageRecords.entries()) {
            if (!img.isConnected) {
                this.translatedImageRecords.delete(img);
                continue;
            }

            img.src = this.viewMode === 'translated' ? record.translatedSrc : record.originalSrc;
            img.dataset.mfViewMode = this.viewMode;
        }

        this.floatingBall?.setViewMode(this.viewMode);
        return this.viewMode;
    }

    private updateFloatingBallState(state: FloatingBallState): void {
        this.ballState = state;
        this.floatingBall?.setState(state);
    }

    private startElapsedClock(): void {
        if (!this.floatingBall) return;

        if (this.elapsedStartedAt === null) {
            this.elapsedStartedAt = Date.now();
        }

        this.floatingBall.setElapsedTime(this.getElapsedTimeMs());

        if (this.elapsedTimerId !== null) {
            window.clearInterval(this.elapsedTimerId);
        }

        this.elapsedTimerId = window.setInterval(() => {
            this.floatingBall?.setElapsedTime(this.getElapsedTimeMs());
        }, 100);
    }

    private stopElapsedClock(keepDisplay: boolean): void {
        if (this.elapsedStartedAt !== null) {
            this.elapsedBaseMs += Date.now() - this.elapsedStartedAt;
            this.elapsedStartedAt = null;
        }

        if (this.elapsedTimerId !== null) {
            window.clearInterval(this.elapsedTimerId);
            this.elapsedTimerId = null;
        }

        this.floatingBall?.setElapsedTime(keepDisplay ? this.elapsedBaseMs : null);
    }

    private resetElapsedClock(): void {
        if (this.elapsedTimerId !== null) {
            window.clearInterval(this.elapsedTimerId);
            this.elapsedTimerId = null;
        }
        this.elapsedBaseMs = 0;
        this.elapsedStartedAt = null;
        this.floatingBall?.setElapsedTime(null);
    }

    private getElapsedTimeMs(): number {
        if (this.elapsedStartedAt === null) {
            return this.elapsedBaseMs;
        }
        return this.elapsedBaseMs + (Date.now() - this.elapsedStartedAt);
    }

    private formatStageSummary(timings: StageTimings): string {
        const formatSeconds = (value: number): string => `${(value / 1000).toFixed(1)}s`;
        return `OCR ${formatSeconds(timings.ocrMs)} | 翻译 ${formatSeconds(timings.translateMs)} | 渲染 ${formatSeconds(timings.renderMs)} | 总耗时 ${formatSeconds(timings.totalMs)}`;
    }

    private createEmptyTimings(): StageTimings {
        return {
            roiMs: 0,
            ocrMs: 0,
            translateMs: 0,
            renderMs: 0,
            totalMs: 0,
        };
    }

    private getOriginalSrc(img: HTMLImageElement): string {
        const dataSrc = img.dataset.mfOriginalSrc
            || img.getAttribute('data-src')
            || img.getAttribute('data-original')
            || img.getAttribute('data-lazy-src')
            || img.getAttribute('data-lazy')
            || img.getAttribute('data-srcset');
        if (dataSrc && !dataSrc.startsWith('data:image')) {
            return dataSrc;
        }
        return img.src || '';
    }

    private openSettings(): void {
        this.settingsPanel?.show();
    }

    private async loadStoredSettings(): Promise<Settings> {
        try {
            const result = await chrome.storage.local.get('settings');
            const settings = normalizeSettings(result.settings as Partial<Settings> | undefined);

            if (!result.settings) {
                await chrome.storage.local.set({ settings });
            }

            return settings;
        } catch (error) {
            console.error('[MangaFlow] 读取设置失败，使用默认值:', error);
            return DEFAULT_SETTINGS;
        }
    }

    private async loadFloatingBallPrefs(): Promise<FloatingBallPrefs> {
        try {
            const result = await chrome.storage.local.get('floatingBallPrefs');
            const prefs = result.floatingBallPrefs as Partial<FloatingBallPrefs> | undefined;
            return {
                globallyDisabled: prefs?.globallyDisabled ?? false,
                disabledSites: Array.isArray(prefs?.disabledSites) ? prefs.disabledSites : [],
            };
        } catch (error) {
            console.error('[MangaFlow] 读取悬浮球偏好失败:', error);
            return {
                globallyDisabled: false,
                disabledSites: [],
            };
        }
    }

    private async persistFloatingBallPrefs(): Promise<void> {
        await chrome.storage.local.set({
            floatingBallPrefs: this.floatingBallPrefs,
        });
    }

    private async clearCaches(): Promise<void> {
        await this.translationController?.clearCache();
        this.translatedImages.clear();
        this.translatedImageRecords.clear();
        console.log('[MangaFlow] 缓存已清空（OCR/翻译）');
    }

    private async clearOCRCache(): Promise<void> {
        await this.translationController?.clearOCRCache();
        console.log('[MangaFlow] OCR 缓存已清空');
    }

    private async clearTranslationCache(): Promise<void> {
        await this.translationController?.clearTranslationCache();
        console.log('[MangaFlow] 翻译缓存已清空');
    }

    private async saveSettings(settings: unknown): Promise<void> {
        this.settings = normalizeSettings(settings as Partial<Settings>);
        await chrome.storage.local.set({ settings: this.settings });
        console.log('设置已保存:', this.settings);
        DebugOverlayManager.getInstance().applySettings(this.settings);
        this.translationController?.updateSettings(this.settings);
        this.applyFloatingBallVisibility();
    }
}

new MangaFlow();

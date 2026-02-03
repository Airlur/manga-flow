// 漫译 MangaFlow - 内容脚本入口
// 注入到漫画页面，管理翻译流程

import { FloatingBall } from './ui/floating-ball';
import { SettingsPanel } from './ui/settings-panel';
import { ImageDetector } from './core/image-detector';
import { TranslationController } from './core/translation-controller';
import { DebugOverlayManager } from './core/debug-overlay';
import type { Settings } from '../types';

class MangaFlow {
    private floatingBall: FloatingBall | null = null;
    private settingsPanel: SettingsPanel | null = null;
    private imageDetector: ImageDetector | null = null;
    private translationController: TranslationController | null = null;
    private isInitialized = false;
    private isTranslating = false;  // 是否正在翻译模式
    private translatedImages: Set<string> = new Set();  // 已翻译的图片

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        // 等待 DOM 加载完成
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

        // 初始化 UI 组件
        this.floatingBall = new FloatingBall({
            onStart: () => this.startTranslation(),
            onPause: () => this.pauseTranslation(),
            onSettings: () => this.openSettings(),
        });

        this.settingsPanel = new SettingsPanel({
            onSave: (settings) => this.saveSettings(settings),
            onClose: () => {
                console.log('[MangaFlow] 设置面板已关闭');
            },
        });

        // 初始化核心模块
        this.imageDetector = new ImageDetector();
        this.translationController = new TranslationController();

        // 【关键】订阅懒加载新图片事件
        this.imageDetector.setOnNewImage((img) => {
            this.onNewImageDetected(img);
        });

        // 挂载 UI
        this.floatingBall.mount();

        // 监听来自 Popup 的消息
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message.type === 'START_TRANSLATION') {
                this.startTranslation();
                sendResponse({ success: true });
            } else if (message.type === 'OPEN_SETTINGS') {
                this.openSettings();
                sendResponse({ success: true });
            } else if (message.type === 'CLEAR_CACHE') {
                this.translationController?.clearCache()
                    .then(() => {
                        this.translatedImages.clear();
                        console.log('[MangaFlow] 缓存已清空（OCR/翻译）');
                        sendResponse({ success: true });
                    })
                    .catch((error) => {
                        console.error('[MangaFlow] 清除缓存失败:', error);
                        sendResponse({ success: false, error: (error as Error).message });
                    });
                return true;
            }
            return true;
        });

        console.log('漫译 MangaFlow 初始化完成');
    }

    // 处理新检测到的图片（懒加载触发）
    private async onNewImageDetected(img: HTMLImageElement): Promise<void> {
        // 只有在翻译模式下才自动翻译新图片
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

    private async startTranslation(): Promise<void> {
        if (!this.imageDetector || !this.translationController) return;

        console.log('开始翻译...');
        this.isTranslating = true;
        this.floatingBall?.setState('translating');

        try {
            // 检测当前可见的漫画图片
            const images = this.imageDetector.getComicImages()
                .filter((img) => img.dataset.mfTranslated !== '1');
            console.log(`检测到 ${images.length} 张漫画图片`);

            if (images.length === 0) {
                this.floatingBall?.setState('idle');
                return;
            }

            // 记录已处理的图片
            images.forEach(img => this.translatedImages.add(this.getOriginalSrc(img)));

            // 开始批量翻译
            const result = await this.translationController.translateImages(images, (progress) => {
                this.floatingBall?.updateProgress(progress.current, progress.total);
            });

            // 根据结果设置状态，但保持翻译模式（继续监听新图片）
            if (result.failed === 0) {
                this.floatingBall?.setState('completed');
            } else if (result.success === 0) {
                this.floatingBall?.setState('error');
            } else {
                this.floatingBall?.setState('completed');
            }
        } catch (error) {
            console.error('翻译失败:', error);
            this.floatingBall?.setState('error');
        }
    }

    private pauseTranslation(): void {
        console.log('暂停翻译');
        this.isTranslating = false;
        this.translationController?.pause();
        this.floatingBall?.setState('paused');
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

    private async saveSettings(settings: unknown): Promise<void> {
        await chrome.storage.local.set({ settings });
        console.log('设置已保存:', settings);
        DebugOverlayManager.getInstance().applySettings(settings as Settings);
        this.translationController?.updateSettings(settings as Settings);
    }
}

// 启动应用
new MangaFlow();

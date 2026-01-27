// 漫译 MangaFlow - 内容脚本入口
// 注入到漫画页面，管理翻译流程

import { FloatingBall } from './ui/floating-ball';
import { SettingsPanel } from './ui/settings-panel';
import { ImageDetector } from './core/image-detector';
import { TranslationController } from './core/translation-controller';

class MangaFlow {
    private floatingBall: FloatingBall | null = null;
    private settingsPanel: SettingsPanel | null = null;
    private imageDetector: ImageDetector | null = null;
    private translationController: TranslationController | null = null;
    private isInitialized = false;

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
                // 设置面板关闭时的回调，不再调用 hide 避免无限循环
                console.log('[MangaFlow] 设置面板已关闭');
            },
        });

        // 初始化核心模块
        this.imageDetector = new ImageDetector();
        this.translationController = new TranslationController();

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
            }
            return true;
        });

        console.log('漫译 MangaFlow 初始化完成');
    }

    private async startTranslation(): Promise<void> {
        if (!this.imageDetector || !this.translationController) return;

        console.log('开始翻译...');
        this.floatingBall?.setState('translating');

        try {
            // 检测漫画图片
            const images = this.imageDetector.getComicImages();
            console.log(`检测到 ${images.length} 张漫画图片`);

            if (images.length === 0) {
                this.floatingBall?.setState('idle');
                return;
            }

            // 开始批量翻译
            const result = await this.translationController.translateImages(images, (progress) => {
                this.floatingBall?.updateProgress(progress.current, progress.total);
            });

            // 根据结果设置状态
            if (result.failed === 0) {
                this.floatingBall?.setState('completed');
            } else if (result.success === 0) {
                this.floatingBall?.setState('error');
            } else {
                // 部分成功
                this.floatingBall?.setState('completed');
            }
        } catch (error) {
            console.error('翻译失败:', error);
            this.floatingBall?.setState('error');
        }
    }

    private pauseTranslation(): void {
        console.log('暂停翻译');
        this.translationController?.pause();
        this.floatingBall?.setState('paused');
    }

    private openSettings(): void {
        this.settingsPanel?.show();
    }

    private async saveSettings(settings: unknown): Promise<void> {
        await chrome.storage.local.set({ settings });
        console.log('设置已保存:', settings);
    }
}

// 启动应用
new MangaFlow();

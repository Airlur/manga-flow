// 漫译 MangaFlow - 翻译控制器
// 协调 OCR、翻译、渲染等模块

import type { TranslationProgress, Settings } from '../../types';
import { OCREngine } from './ocr-engine';
import { Translator } from './translator';
import { ImageProcessor } from './image-processor';
import { Renderer } from './renderer';
import { CacheManager } from './cache-manager';
import { TextFilter } from '../utils/text-filter';
import { showToast } from '@/content/ui/toast';

export class TranslationController {
    private ocrEngine: OCREngine;
    private translator: Translator;
    private imageProcessor: ImageProcessor;
    private renderer: Renderer;
    private cacheManager: CacheManager;
    private textFilter: TextFilter;

    private isPaused = false;
    private settings: Settings | null = null;

    constructor() {
        this.ocrEngine = new OCREngine();
        this.translator = new Translator();
        this.imageProcessor = new ImageProcessor();
        this.renderer = new Renderer();
        this.cacheManager = new CacheManager();
        this.textFilter = new TextFilter();
    }

    // 批量翻译图片
    async translateImages(
        images: HTMLImageElement[],
        onProgress?: (progress: TranslationProgress) => void
    ): Promise<{ success: number; failed: number }> {
        await this.loadSettings();
        await this.ocrEngine.init(this.settings?.sourceLang || 'ko');

        const total = images.length;
        const batchSize = 3;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < images.length; i += batchSize) {
            if (this.isPaused) break;

            const batch = images.slice(i, i + batchSize);

            // 并发处理一批图片
            const results = await Promise.allSettled(
                batch.map(async (img, batchIndex) => {
                    const index = i + batchIndex;
                    await this.translateSingleImage(img);
                    onProgress?.({
                        current: index + 1,
                        total,
                        status: 'processing',
                    });
                })
            );

            // 统计成功/失败
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    successCount++;
                } else {
                    failedCount++;
                    console.error('[MangaFlow] 图片翻译失败:', result.reason);
                }
            }
        }

        onProgress?.({
            current: total,
            total,
            status: this.isPaused ? 'pending' : 'completed',
        });

        // 显示结果 Toast
        if (failedCount === 0) {
            showToast(`翻译完成：${successCount} 张图片`, 'success');
        } else if (successCount === 0) {
            showToast(`翻译失败：所有 ${failedCount} 张图片都失败了`, 'error');
        } else {
            showToast(`翻译完成：${successCount} 张成功，${failedCount} 张失败`, 'warning');
        }

        return { success: successCount, failed: failedCount };
    }

    // 翻译单张图片
    private async translateSingleImage(img: HTMLImageElement): Promise<void> {
        const imgSrc = img.src;

        // 检查缓存
        const cached = await this.cacheManager.get(imgSrc);
        if (cached) {
            console.log('[MangaFlow] 使用缓存');
            img.src = cached.renderedImage;
            return;
        }

        console.log('[MangaFlow] 开始翻译图片:', imgSrc.substring(0, 50));

        // 1. OCR 识别
        const ocrResult = await this.ocrEngine.recognize(img);
        if (!ocrResult.blocks.length) {
            console.log('[MangaFlow] 未检测到文字');
            return;
        }

        // 2. 过滤不需要翻译的文本
        const filteredBlocks = ocrResult.blocks.filter((block) =>
            this.textFilter.shouldTranslate(block.text, block.bbox)
        );

        if (!filteredBlocks.length) {
            console.log('[MangaFlow] 过滤后无需翻译的文本');
            return;
        }

        // 3. 翻译
        const translations: string[] = [];
        for (const block of filteredBlocks) {
            const result = await this.translator.translate(
                block.text,
                this.settings?.sourceLang || 'ko',
                'zh'
            );
            translations.push(result.translated);
        }

        // 4. 背景修复 + 渲染
        const canvas = await this.imageProcessor.processImage(img, filteredBlocks);
        this.renderer.render(canvas, filteredBlocks, translations, {
            fontSize: this.settings?.fontSize || 14,
            fontColor: this.settings?.fontColor || '#000000',
            fontFamily: 'Arial, sans-serif',
        });

        // 5. 替换原图（处理跨域问题）
        try {
            const renderedImage = canvas.toDataURL('image/png');
            img.src = renderedImage;

            // 6. 保存缓存
            await this.cacheManager.set(imgSrc, {
                imageHash: await this.cacheManager.getImageHash(imgSrc),
                timestamp: Date.now(),
                ocrResult,
                translation: translations.join('\n'),
                renderedImage,
            });
        } catch (error) {
            // 跨域图片无法导出，抛出友好错误
            if ((error as Error).message.includes('Tainted')) {
                throw new Error('跨域图片无法导出，请检查图片来源');
            }
            throw error;
        }
    }

    // 加载设置
    private async loadSettings(): Promise<void> {
        const result = await chrome.storage.local.get('settings');
        this.settings = result.settings as Settings;
    }

    // 暂停
    pause(): void {
        this.isPaused = true;
    }

    // 继续
    resume(): void {
        this.isPaused = false;
    }
}

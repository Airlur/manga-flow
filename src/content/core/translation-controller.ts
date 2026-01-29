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
        // 配置 OCR 引擎
        this.ocrEngine.configure(this.settings || {});
        if (this.settings?.ocrEngine !== 'cloud') {
            await this.ocrEngine.initLocal(this.settings?.sourceLang || 'ko');
        }

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

    // 翻译单张图片（公开方法，供懒加载调用）
    // 阶段2：OCR + 翻译，暂不渲染图像
    private phase2Mode = true; // 阶段2：测试翻译效果

    async translateSingleImage(img: HTMLImageElement): Promise<void> {
        // 确保设置和 OCR 引擎已加载
        if (!this.settings) {
            await this.loadSettings();
        }
        // 配置 OCR 引擎
        this.ocrEngine.configure(this.settings || {});
        const sourceLang = this.settings?.sourceLang || 'ko';
        const targetLang = this.settings?.targetLang || 'zh';

        const imgSrc = img.src || img.getAttribute('data-src') || '';
        const imgName = imgSrc.substring(imgSrc.lastIndexOf('/') + 1);

        console.log(`[MangaFlow] 🔄 开始处理: ${imgName}`);
        console.log(`[MangaFlow] 📍 语言: ${sourceLang} → ${targetLang}`);

        // 1. OCR 识别（会自动绘制红框）
        const ocrStartTime = Date.now();
        const ocrResult = await this.ocrEngine.recognize(img, sourceLang);
        const ocrDuration = Date.now() - ocrStartTime;

        if (!ocrResult.blocks.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 未检测到有效文字`);
            return;
        }

        console.log(`[MangaFlow] ✅ ${imgName}: OCR 完成 (${ocrDuration}ms)，共 ${ocrResult.blocks.length} 个文本块`);

        // 2. 过滤不需要翻译的文本
        const filteredBlocks = ocrResult.blocks.filter((block) =>
            this.textFilter.shouldTranslate(block.text, block.bbox)
        );

        if (!filteredBlocks.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 过滤后无需翻译的文本`);
            return;
        }

        // 3. 批量翻译
        const engine = this.settings?.translateEngine || 'google';
        console.log(`[MangaFlow] 🌐 翻译中... (引擎: ${engine}, 共 ${filteredBlocks.length} 条)`);

        const translateStartTime = Date.now();
        const textsToTranslate = filteredBlocks.map(block => block.text);

        let translations: string[];
        try {
            const results = await this.translator.translateBatch(
                textsToTranslate,
                sourceLang,
                targetLang
            );
            translations = results.map(r => r.translated);
        } catch (error) {
            console.error(`[MangaFlow] ❌ 批量翻译失败:`, error);
            translations = textsToTranslate.map(() => `[翻译失败: ${(error as Error).message}]`);
        }
        const translateDuration = Date.now() - translateStartTime;

        // 输出翻译结果对比
        console.group(`[MangaFlow] 📝 ${imgName} - 翻译结果`);
        console.log(`引擎: ${engine} | OCR: ${ocrDuration}ms | 翻译: ${translateDuration}ms`);
        console.log('─'.repeat(50));
        filteredBlocks.forEach((block, i) => {
            console.log(`[${i + 1}] 原文: "${block.text}"`);
            console.log(`    译文: "${translations[i]}"`);
            console.log('');
        });
        console.groupEnd();

        // ============ 阶段2：到此为止，暂不渲染 ============
        if (this.phase2Mode) {
            console.log(`[MangaFlow] 🛑 阶段2模式：翻译完成，跳过图像渲染`);
            return;
        }

        // ============ 阶段3+：图像渲染待后续启用 ============
        // 4. 背景修复 + 渲染
        console.log(`[MangaFlow] 🎨 渲染中...`);
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
            console.log(`[MangaFlow] ✅ ${imgName}: 翻译完成！`);

            // 6. 保存缓存 (阶段3启用后使用)
            // OCR 缓存
            const ocrEngine = this.settings?.ocrEngine || 'local';
            await this.cacheManager.setOCR(imgSrc, ocrEngine, ocrResult);
            // 翻译缓存
            const translateEngine = this.settings?.translateEngine || 'google';
            await this.cacheManager.setTranslation(imgSrc, translateEngine,
                filteredBlocks.map((block, i) => ({
                    original: block.text,
                    translated: translations[i],
                }))
            );
        } catch (error) {
            // 跨域图片无法导出，抛出友好错误
            console.error(`[MangaFlow] ❌ ${imgName}: 导出失败`, error);
            if ((error as Error).message.includes('Tainted')) {
                throw new Error(`跨域图片无法导出: ${imgName}`);
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

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
import { TextDetector } from './text-detector';
import { DebugOverlayManager } from './debug-overlay';
import type { TextBlock, BBox } from '../../types';
import { DEV_MODE } from '../../config/app-config';

type TextGroup = {
    bbox: BBox;
    blocks: TextBlock[];
    text: string;
    confidence: number;
};

export class TranslationController {
    private ocrEngine: OCREngine;
    private translator: Translator;
    private imageProcessor: ImageProcessor;
    private renderer: Renderer;
    private cacheManager: CacheManager;
    private textFilter: TextFilter;
    private textDetector: TextDetector;
    private debugOverlay: DebugOverlayManager;

    private isPaused = false;
    private settings: Settings | null = null;

    constructor() {
        this.ocrEngine = new OCREngine();
        this.translator = new Translator();
        this.imageProcessor = new ImageProcessor();
        this.renderer = new Renderer();
        this.cacheManager = new CacheManager();
        this.textFilter = new TextFilter();
        this.textDetector = new TextDetector();
        this.debugOverlay = DebugOverlayManager.getInstance();
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

    // 翻译单张图片
    async translateSingleImage(img: HTMLImageElement): Promise<void> {
        if (!this.settings) {
            await this.loadSettings();
        }

        this.ocrEngine.configure(this.settings || {});
        const sourceLang = this.settings?.sourceLang || 'ko';
        const targetLang = this.settings?.targetLang || 'zh';

        const devMode = DEV_MODE ? (this.settings?.devMode ?? true) : false;
        const devPhase = devMode ? (this.settings?.devPhase || 'full') : 'full';
        const showOcrBoxes = devMode ? (this.settings?.showOcrBoxes ?? true) : false;
        const showRoiBoxes = devMode ? (this.settings?.showRoiBoxes ?? true) : false;
        const showMaskBoxes = devMode ? (this.settings?.showMaskBoxes ?? false) : false;
        this.debugOverlay.setEnabled(devMode);
        this.debugOverlay.setShowFlags({
            ocr: showOcrBoxes,
            roi: showRoiBoxes,
            mask: showMaskBoxes,
        });
        this.ocrEngine.setDebugMode(devMode);

        const originalSrc = this.getOriginalSrc(img);
        if (img.dataset.mfTranslated === '1') {
            console.log(`[MangaFlow] 已翻译，跳过: ${originalSrc.substring(originalSrc.lastIndexOf('/') + 1)}`);
            return;
        }
        img.dataset.mfOriginalSrc = originalSrc;

        const imgSrc = originalSrc;
        const imgName = imgSrc.substring(imgSrc.lastIndexOf('/') + 1);

        console.log(`[MangaFlow] 🔄 开始处理: ${imgName}`);
        console.log(`[MangaFlow] 📍 语言: ${sourceLang} → ${targetLang}`);

        // 0. ROI 裁剪检测
        const roiStartTime = Date.now();
        const roiRegions = await this.textDetector.detect(img, {
            debug: devMode,
            debugLabel: `${imgName}-ROI`,
        });
        const roiDuration = Date.now() - roiStartTime;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const imgArea = Math.max(1, imgW * imgH);
        const roiArea = roiRegions.reduce((sum, r) => sum + Math.max(0, (r.x1 - r.x0) * (r.y1 - r.y0)), 0);
        const roiCoverage = roiArea / imgArea;
        console.log(`[MangaFlow] ✂️ ${imgName} ROI 检测完成 (${roiDuration}ms)，候选区域: ${roiRegions.length}，覆盖率 ${(roiCoverage * 100).toFixed(1)}%`);
        if (showOcrBoxes && roiRegions.length) {
            console.group(`[MangaFlow] 🟧 ${imgName} ROI 区域列表`);
            roiRegions.forEach((r, i) => {
                console.log(`  [${i + 1}] bbox: ${r.x0},${r.y0},${r.x1},${r.y1}`);
            });
            console.groupEnd();
        }

        const minRoiCoverage = 0.02;
        const useRoi = roiRegions.length > 0 && roiCoverage >= minRoiCoverage;
        if (!useRoi && roiRegions.length > 0) {
            console.log(`[MangaFlow] ⚠️ ROI 覆盖过低，回退全图 OCR（覆盖率 ${(roiCoverage * 100).toFixed(1)}%）`);
        }

        if (devMode && devPhase === 'roi') {
            console.log('[MangaFlow] 🛑 阶段 A：仅 ROI 检测，跳过 OCR/翻译/渲染');
            return;
        }

        // 1. OCR 识别（裁剪识别）
        const ocrStartTime = Date.now();
        let ocrResult = null;
        const ocrEngine = this.settings?.ocrEngine || 'local';
        const allowOcrCache = !(devMode && (devPhase === 'roi' || devPhase === 'ocr'));
        const cachedOcr = allowOcrCache ? await this.cacheManager.getOCR(imgSrc, ocrEngine) : null;
        if (cachedOcr) {
            console.log(`[MangaFlow] 📦 OCR 缓存命中 (${ocrEngine})`);
            ocrResult = cachedOcr;
        } else {
            const usedRegions = useRoi;
            if (useRoi) {
                ocrResult = await this.ocrEngine.recognizeRegions(
                    img,
                    roiRegions,
                    sourceLang,
                    devMode,
                    imgName
                );
            } else {
                ocrResult = await this.ocrEngine.recognize(img, sourceLang, devMode, imgName);
            }
            await this.cacheManager.setOCR(imgSrc, ocrEngine, ocrResult);
            if (usedRegions && ocrResult?.blocks?.length) {
                this.ocrEngine.logBlocks(ocrResult.blocks, `${imgName}: OCR 识别结果`);
            }
        }
        if (cachedOcr && ocrResult?.blocks?.length) {
            this.ocrEngine.logBlocks(ocrResult.blocks, `${imgName}: OCR 缓存结果`);
            this.ocrEngine.drawDebugBoxesFor(img, ocrResult.blocks, devMode);
        }
        const ocrDuration = Date.now() - ocrStartTime;

        if (!ocrResult || !ocrResult.blocks.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 未检测到有效文字`);
            return;
        }

        console.log(`[MangaFlow] ✅ ${imgName}: OCR 完成 (${ocrDuration}ms)，共 ${ocrResult.blocks.length} 个文本块`);

        if (devMode && devPhase === 'ocr') {
            console.log('[MangaFlow] 🛑 阶段 B：OCR 完成，跳过翻译/渲染');
            return;
        }

        // 2. 过滤不需要翻译的文本（含组内保护）
        const decisions = ocrResult.blocks.map((block) =>
            this.textFilter.classify(block.text, block.bbox)
        );
        const keptBlocks: TextBlock[] = [];
        const softDropped: Array<{ block: TextBlock; reason: string }> = [];

        ocrResult.blocks.forEach((block, index) => {
            const decision = decisions[index];
            if (decision.keep) {
                keptBlocks.push(block);
                return;
            }
            if (decision.hardDrop) return;
            softDropped.push({ block, reason: decision.reason });
        });

        if (keptBlocks.length && softDropped.length) {
            softDropped
                .filter((item) => item.reason === 'short' || item.reason === 'small')
                .forEach((item) => {
                    const nearKept = keptBlocks.some((kept) => this.isNearBlock(kept, item.block));
                    if (nearKept) {
                        keptBlocks.push(item.block);
                    }
                });
        }

        const filteredBlocks = keptBlocks;

        if (!filteredBlocks.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 过滤后无需翻译的文本`);
            return;
        }

        // 2.5 文本块聚类（按气泡/段落合并）
        const groups = this.groupTextBlocks(filteredBlocks);

        // 3. 批量翻译（按组）
        const engine = this.settings?.translateEngine || 'google';
        console.log(`[MangaFlow] 🌐 翻译中... (引擎: ${engine}, 共 ${groups.length} 条)`);

        const translateStartTime = Date.now();
        const textsToTranslate = groups.map(group => group.text);

        let translations: string[];
        try {
            const cachedTrans = await this.cacheManager.getTranslation(imgSrc, engine);
            if (cachedTrans && cachedTrans.length === textsToTranslate.length &&
                cachedTrans.every((t, i) => t.original === textsToTranslate[i])) {
                console.log(`[MangaFlow] 📦 翻译缓存命中 (${engine})`);
                translations = cachedTrans.map((t) => t.translated);
            } else {
                const results = await this.translator.translateBatch(
                    textsToTranslate,
                    sourceLang,
                    targetLang
                );
                translations = results.map(r => r.translated);
                await this.cacheManager.setTranslation(
                    imgSrc,
                    engine,
                    results.map((r) => ({ original: r.original, translated: r.translated }))
                );
            }
        } catch (error) {
            console.error(`[MangaFlow] ❌ 批量翻译失败:`, error);
            translations = textsToTranslate.map(() => `[翻译失败: ${(error as Error).message}]`);
        }
        const translateDuration = Date.now() - translateStartTime;

        console.group(`[MangaFlow] 📝 ${imgName} - 翻译结果`);
        console.log(`引擎: ${engine} | OCR: ${ocrDuration}ms | 翻译: ${translateDuration}ms`);
        console.log('─'.repeat(50));
        groups.forEach((group, i) => {
            console.log(`[${i + 1}] 原文: "${group.text}"`);
            console.log(`    译文: "${translations[i]}"`);
            console.log('');
        });
        console.groupEnd();

        if (devMode && devPhase === 'translate') {
            console.log('[MangaFlow] 🛑 阶段 C：翻译完成，跳过渲染');
            return;
        }

        // 4. 背景修复 + 渲染
        console.log(`[MangaFlow] 🎨 渲染中...`);
        const { blocks: renderBlocks, translations: renderTranslations, fontSizes } =
            this.expandTranslationsToBlocks(groups, translations);

        const { canvas, analysis } = await this.imageProcessor.processImage(img, renderBlocks);
        if (devMode) {
            const maskBoxes = analysis
                .map((item) => item.maskBox)
                .filter((box): box is BBox => !!box);
            if (maskBoxes.length) {
                this.debugOverlay.setMaskBoxes(img, maskBoxes);
            }
        }
        this.renderer.render(canvas, renderBlocks, renderTranslations, analysis, {
            fontSize: this.settings?.fontSize || 14,
            fontColor: this.settings?.fontColor || '#000000',
            fontFamily: 'Arial, sans-serif',
        }, fontSizes);

        // 5. 替换原图
        try {
            const renderedImage = canvas.toDataURL('image/png');
            img.src = renderedImage;
            img.dataset.mfTranslated = '1';
            console.log(`[MangaFlow] ✅ ${imgName}: 翻译完成！`);
        } catch (error) {
            console.error(`[MangaFlow] ❌ ${imgName}: 导出失败`, error);
            if ((error as Error).message.includes('Tainted')) {
                throw new Error(`跨域图片无法导出: ${imgName}`);
            }
            throw error;
        }
    }

    async clearCache(): Promise<void> {
        await this.cacheManager.clear();
    }

    updateSettings(settings: Settings): void {
        this.settings = settings;
    }

    // 加载设置
    private async loadSettings(): Promise<void> {
        if (!chrome?.runtime?.id) {
            throw new Error('扩展上下文已失效');
        }
        try {
            const result = await chrome.storage.local.get('settings');
            this.settings = result.settings as Settings;
        } catch (error) {
            console.error('[MangaFlow] 读取设置失败:', error);
            showToast('扩展已更新/重载，请刷新页面', 'warning');
            throw error;
        }
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

    private isNearBlock(a: TextBlock, b: TextBlock): boolean {
        const ax = a.bbox.x1 - a.bbox.x0;
        const ay = a.bbox.y1 - a.bbox.y0;
        const bx = b.bbox.x1 - b.bbox.x0;
        const by = b.bbox.y1 - b.bbox.y0;

        const vGap = Math.max(0, Math.max(a.bbox.y0 - b.bbox.y1, b.bbox.y0 - a.bbox.y1));
        const hGap = Math.max(0, Math.max(a.bbox.x0 - b.bbox.x1, b.bbox.x0 - a.bbox.x1));

        const maxH = Math.max(ay, by);
        const maxW = Math.max(ax, bx);

        return vGap < maxH * 0.6 && hGap < maxW * 0.5;
    }

    private expandTranslationsToBlocks(
        groups: TextGroup[],
        translations: string[]
    ): { blocks: TextBlock[]; translations: string[]; fontSizes: number[] } {
        const blocks: TextBlock[] = [];
        const texts: string[] = [];
        const fontSizes: number[] = [];
        const ctx = document.createElement('canvas').getContext('2d')!;
        const fontFamily = 'Arial, sans-serif';

        groups.forEach((group, index) => {
            const groupBlocks = [...group.blocks].sort((a, b) => {
                if (a.bbox.y0 === b.bbox.y0) return a.bbox.x0 - b.bbox.x0;
                return a.bbox.y0 - b.bbox.y0;
            });
            const translation = translations[index] || '';
            const lines = this.splitTranslationIntoLines(translation, groupBlocks, ctx, fontFamily);
            const fontSize = this.calculateGroupFontSize(groupBlocks, lines, ctx, fontFamily);

            groupBlocks.forEach((block, lineIndex) => {
                blocks.push(block);
                texts.push(lines[lineIndex] ?? '');
                fontSizes.push(fontSize);
            });
        });

        return { blocks, translations: texts, fontSizes };
    }

    private calculateGroupFontSize(
        blocks: TextBlock[],
        lines: string[],
        ctx: CanvasRenderingContext2D,
        fontFamily: string
    ): number {
        const heights = blocks.map((b) => b.bbox.y1 - b.bbox.y0);
        const avgHeight = heights.reduce((sum, h) => sum + h, 0) / Math.max(1, heights.length);
        let size = Math.max(12, Math.min(avgHeight * 0.8, 48));

        ctx.font = `bold ${Math.round(size)}px ${fontFamily}`;
        let minScale = 1;
        blocks.forEach((block, index) => {
            const line = (lines[index] ?? '').replace(/\s+/g, ' ').trim();
            if (!line) return;
            const textWidth = ctx.measureText(line).width;
            const blockWidth = Math.max(1, block.bbox.x1 - block.bbox.x0);
            if (textWidth > blockWidth * 0.95) {
                minScale = Math.min(minScale, (blockWidth * 0.95) / textWidth);
            }
        });

        if (minScale < 1) {
            size = Math.max(12, Math.floor(size * minScale));
        }

        return size;
    }

    private splitTranslationIntoLines(
        text: string,
        blocks: TextBlock[],
        ctx: CanvasRenderingContext2D,
        fontFamily: string
    ): string[] {
        const targetCount = Math.max(1, blocks.length);
        const trimmed = text.trim();
        if (!trimmed) return new Array(targetCount).fill('');

        let lines = trimmed.split(/\n+/).map((t) => t.trim()).filter(Boolean);

        if (lines.length <= 1) {
            const punctuated = this.splitByPunctuation(trimmed);
            if (punctuated.length > 1) {
                lines = punctuated;
            }
        }

        if (lines.length <= 1) {
            const groupBox = blocks.reduce(
                (acc, b) => ({
                    x0: Math.min(acc.x0, b.bbox.x0),
                    y0: Math.min(acc.y0, b.bbox.y0),
                    x1: Math.max(acc.x1, b.bbox.x1),
                    y1: Math.max(acc.y1, b.bbox.y1),
                }),
                { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
            );
            const avgHeight = blocks.reduce((sum, b) => sum + (b.bbox.y1 - b.bbox.y0), 0) / blocks.length;
            const fontSize = Math.max(12, Math.min(avgHeight * 0.8, 48));
            ctx.font = `bold ${Math.round(fontSize)}px ${fontFamily}`;
            lines = this.wrapText(ctx, trimmed, Math.max(1, groupBox.x1 - groupBox.x0));
        }

        return this.balanceLines(lines, targetCount);
    }

    private splitByPunctuation(text: string): string[] {
        const parts: string[] = [];
        let current = '';
        const punctuation = '。！？!?.,，；;：:';

        for (const ch of text) {
            current += ch;
            if (punctuation.includes(ch)) {
                const value = current.trim();
                if (value) parts.push(value);
                current = '';
            }
        }
        const tail = current.trim();
        if (tail) parts.push(tail);
        return parts;
    }

    private balanceLines(lines: string[], targetCount: number): string[] {
        let result = lines.map((line) => line.trim()).filter(Boolean);
        if (result.length === 0) result = [''];

        while (result.length > targetCount) {
            const tail = result.pop()!;
            result[result.length - 1] = `${result[result.length - 1]} ${tail}`.trim();
        }

        let guard = 0;
        while (result.length < targetCount && guard < 20) {
            guard += 1;
            let longestIndex = 0;
            for (let i = 1; i < result.length; i++) {
                if (result[i].length > result[longestIndex].length) {
                    longestIndex = i;
                }
            }
            const [a, b] = this.splitLineInHalf(result[longestIndex]);
            result.splice(longestIndex, 1, a, b);
            if (!b) break;
        }

        while (result.length < targetCount) {
            result.push('');
        }
        return result;
    }

    private splitLineInHalf(line: string): [string, string] {
        const trimmed = line.trim();
        if (!trimmed) return ['', ''];
        const mid = Math.floor(trimmed.length / 2);
        const leftSpace = trimmed.lastIndexOf(' ', mid);
        const rightSpace = trimmed.indexOf(' ', mid + 1);
        let cut = mid;
        if (leftSpace > 0) cut = leftSpace;
        else if (rightSpace > 0) cut = rightSpace;

        const first = trimmed.slice(0, cut).trim();
        const second = trimmed.slice(cut).trim();
        if (!first || !second) {
            return [trimmed, ''];
        }
        return [first, second];
    }

    private wrapText(
        ctx: CanvasRenderingContext2D,
        text: string,
        maxWidth: number
    ): string[] {
        const lines: string[] = [];
        const chars = text.split('');
        let currentLine = '';

        for (const char of chars) {
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    // 暂停
    pause(): void {
        this.isPaused = true;
    }

    // 继续
    resume(): void {
        this.isPaused = false;
    }

    // 文本块聚类（按气泡/段落合并）
    private groupTextBlocks(blocks: TextBlock[]): TextGroup[] {
        if (blocks.length <= 1) {
            return blocks.map((block) => ({
                bbox: block.bbox,
                blocks: [block],
                text: block.text,
                confidence: block.confidence,
            }));
        }

        const sorted = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
        const groups: Array<{ bbox: TextBlock['bbox']; blocks: TextBlock[] }> = [];

        const isClose = (g: { bbox: TextBlock['bbox'] }, b: TextBlock): boolean => {
            const gb = g.bbox;
            const bh = b.bbox.y1 - b.bbox.y0;
            const gh = gb.y1 - gb.y0;

            const vGap = Math.max(0, Math.max(gb.y0 - b.bbox.y1, b.bbox.y0 - gb.y1));
            const hGap = Math.max(0, Math.max(gb.x0 - b.bbox.x1, b.bbox.x0 - gb.x1));

            const maxH = Math.max(gh, bh);
            const maxW = Math.max(gb.x1 - gb.x0, b.bbox.x1 - b.bbox.x0);

            return vGap < maxH * 0.6 && hGap < maxW * 0.5;
        };

        for (const block of sorted) {
            let merged = false;
            for (const g of groups) {
                if (isClose(g, block)) {
                    g.blocks.push(block);
                    g.bbox = {
                        x0: Math.min(g.bbox.x0, block.bbox.x0),
                        y0: Math.min(g.bbox.y0, block.bbox.y0),
                        x1: Math.max(g.bbox.x1, block.bbox.x1),
                        y1: Math.max(g.bbox.y1, block.bbox.y1),
                    };
                    merged = true;
                    break;
                }
            }
            if (!merged) {
                groups.push({ bbox: { ...block.bbox }, blocks: [block] });
            }
        }

        return groups.map((g) => {
            const sortedBlocks = g.blocks.sort((a, b) => {
                if (a.bbox.y0 === b.bbox.y0) return a.bbox.x0 - b.bbox.x0;
                return a.bbox.y0 - b.bbox.y0;
            });

            const text = sortedBlocks.map((b) => b.text).join('\n');
            const confidence = sortedBlocks.reduce((sum, b) => sum + b.confidence, 0) / sortedBlocks.length;

            return { text, bbox: g.bbox, confidence, blocks: sortedBlocks };
        });
    }
}

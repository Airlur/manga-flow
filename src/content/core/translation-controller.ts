// 漫译 MangaFlow - 翻译控制器
// 协调 OCR、翻译、渲染等模块

import type {
    TranslationProgress,
    Settings,
    TextBlock,
    BBox,
    RenderGroup,
    ImageTranslationResult,
    BatchTranslationResult,
    StageTimings,
} from '../../types';
import { OCREngine } from './ocr-engine';
import { Translator } from './translator';
import { ImageProcessor } from './image-processor';
import { Renderer } from './renderer';
import { CacheManager } from './cache-manager';
import { TextFilter } from '../utils/text-filter';
import { showToast } from '@/content/ui/toast';
import { TextDetector } from './text-detector';
import { DebugOverlayManager } from './debug-overlay';
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
    private onImageTranslated: ((result: ImageTranslationResult, img: HTMLImageElement) => void) | null = null;

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

    setOnImageTranslated(callback: (result: ImageTranslationResult, img: HTMLImageElement) => void): void {
        this.onImageTranslated = callback;
    }

    // 批量翻译图片
    async translateImages(
        images: HTMLImageElement[],
        onProgress?: (progress: TranslationProgress) => void
    ): Promise<BatchTranslationResult> {
        await this.loadSettings();
        // 配置 OCR 引擎
        this.ocrEngine.configure(this.settings || {});
        if (this.settings?.ocrEngine === 'local') {
            await this.ocrEngine.initLocal(this.settings?.sourceLang || 'ko');
        }

        const batchStartTime = Date.now();
        const total = images.length;
        const batchSize = this.getImageBatchSize();
        const batchDelay = this.getBatchDelayMs();
        let successCount = 0;
        let failedCount = 0;
        const aggregatedTimings: StageTimings = {
            roiMs: 0,
            ocrMs: 0,
            translateMs: 0,
            renderMs: 0,
            totalMs: 0,
        };

        for (let i = 0; i < images.length; i += batchSize) {
            if (this.isPaused) break;

            const batch = images.slice(i, i + batchSize);

            // 并发处理一批图片
            const results = await Promise.allSettled(
                batch.map(async (img, batchIndex) => {
                    const index = i + batchIndex;
                    const result = await this.translateSingleImage(img);
                    onProgress?.({
                        current: index + 1,
                        total,
                        status: 'processing',
                    });
                    return result;
                })
            );

            // 统计成功/失败
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    successCount++;
                    if (result.value) {
                        aggregatedTimings.roiMs += result.value.timings.roiMs;
                        aggregatedTimings.ocrMs += result.value.timings.ocrMs;
                        aggregatedTimings.translateMs += result.value.timings.translateMs;
                        aggregatedTimings.renderMs += result.value.timings.renderMs;
                    }
                } else {
                    failedCount++;
                    console.error('[MangaFlow] 图片翻译失败:', result.reason);
                }
            }

            const hasNextBatch = i + batchSize < images.length;
            if (hasNextBatch && batchDelay > 0) {
                await new Promise((resolve) => setTimeout(resolve, batchDelay));
            }
        }

        onProgress?.({
            current: total,
            total,
            status: this.isPaused ? 'pending' : 'completed',
        });

        aggregatedTimings.totalMs = Date.now() - batchStartTime;

        return { success: successCount, failed: failedCount, timings: aggregatedTimings };
    }

    // 翻译单张图片
    async translateSingleImage(img: HTMLImageElement): Promise<ImageTranslationResult | null> {
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
            return null;
        }
        img.dataset.mfOriginalSrc = originalSrc;

        const imgSrc = originalSrc;
        const imgName = imgSrc.substring(imgSrc.lastIndexOf('/') + 1);
        const totalStartTime = Date.now();
        const stageTimings: StageTimings = {
            roiMs: 0,
            ocrMs: 0,
            translateMs: 0,
            renderMs: 0,
            totalMs: 0,
        };

        console.log(`[MangaFlow] 🔄 开始处理: ${imgName}`);
        console.log(`[MangaFlow] 📍 语言: ${sourceLang} → ${targetLang}`);

        // 0. ROI 裁剪检测
        const roiStartTime = Date.now();
        const roiRegions = await this.textDetector.detect(img, {
            debug: devMode,
            debugLabel: `${imgName}-ROI`,
        });
        const roiDuration = Date.now() - roiStartTime;
        stageTimings.roiMs = roiDuration;
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
            stageTimings.totalMs = Date.now() - totalStartTime;
            return { originalSrc, rendered: false, timings: stageTimings };
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
        stageTimings.ocrMs = ocrDuration;

        if (!ocrResult || !ocrResult.blocks.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 未检测到有效文字`);
            stageTimings.totalMs = Date.now() - totalStartTime;
            return { originalSrc, rendered: false, timings: stageTimings };
        }

        console.log(`[MangaFlow] ✅ ${imgName}: OCR 完成 (${ocrDuration}ms)，共 ${ocrResult.blocks.length} 个文本块`);

        if (devMode && devPhase === 'ocr') {
            console.log('[MangaFlow] 🛑 阶段 B：OCR 完成，跳过翻译/渲染');
            stageTimings.totalMs = Date.now() - totalStartTime;
            return { originalSrc, rendered: false, timings: stageTimings };
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

        const filteredBlocks = this.applyContextualFilters(keptBlocks, ocrResult.blocks);

        if (!filteredBlocks.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 过滤后无需翻译的文本`);
            stageTimings.totalMs = Date.now() - totalStartTime;
            return { originalSrc, rendered: false, timings: stageTimings };
        }

        // 2.5 文本块聚类（按气泡/段落合并）
        const groups = this.filterGroupsForTranslation(
            this.groupTextBlocks(filteredBlocks),
            ocrResult.blocks
        );

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
        stageTimings.translateMs = translateDuration;

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
            stageTimings.totalMs = Date.now() - totalStartTime;
            return { originalSrc, rendered: false, timings: stageTimings };
        }

        // 4. 背景修复 + 渲染（按组）
        console.log(`[MangaFlow] 🎨 渲染中...`);
        const renderStartTime = Date.now();
        const renderGroups = this.buildRenderGroups(groups, translations);
        const activeGroups = renderGroups.filter((g) => g.text && !g.text.startsWith('[翻译失败'));
        if (!activeGroups.length) {
            console.log(`[MangaFlow] ⚠️ ${imgName}: 无有效译文，跳过渲染`);
            stageTimings.totalMs = Date.now() - totalStartTime;
            return { originalSrc, rendered: false, timings: stageTimings };
        }

        const { canvas, analysis } = await this.imageProcessor.processImage(img, activeGroups);
        if (devMode) {
            const maskBoxes = analysis.map((item) => item.maskBox);
            if (maskBoxes.length) {
                this.debugOverlay.setMaskBoxes(img, maskBoxes);
            }
        }
        const fontScale = this.settings?.fontScale ?? (this.settings?.fontSize ? this.settings.fontSize / 14 : 1);
        this.renderer.render(canvas, activeGroups, analysis, {
            fontSize: this.settings?.fontSize || 14,
            fontScale,
            fontColor: this.settings?.fontColor || '#000000',
            maskOpacity: this.settings?.maskOpacity,
            fontFamily: 'Arial, sans-serif',
            bilingualMode: this.settings?.bilingualMode,
        });

        // 5. 替换原图
        try {
            const renderedImage = canvas.toDataURL('image/png');
            img.src = renderedImage;
            img.dataset.mfTranslated = '1';
            img.dataset.mfTranslatedSrc = renderedImage;
            img.dataset.mfViewMode = 'translated';
            stageTimings.renderMs = Date.now() - renderStartTime;
            stageTimings.totalMs = Date.now() - totalStartTime;
            const result: ImageTranslationResult = {
                originalSrc,
                renderedSrc: renderedImage,
                rendered: true,
                timings: stageTimings,
            };
            this.onImageTranslated?.(result, img);
            console.log(`[MangaFlow] ✅ ${imgName}: 翻译完成！`);
            return result;
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

    async clearOCRCache(): Promise<void> {
        await this.cacheManager.clearOCR();
    }

    async clearTranslationCache(): Promise<void> {
        await this.cacheManager.clearTranslation();
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

    private buildRenderGroups(groups: TextGroup[], translations: string[]): RenderGroup[] {
        return groups.map((group, index) => ({
            bbox: group.bbox,
            text: translations[index] || '',
            originalText: group.text,
            blocks: group.blocks,
        }));
    }

    private getImageBatchSize(): number {
        const engine = this.settings?.translateEngine || 'google';
        if (engine === 'openai') {
            return 2;
        }
        return 3;
    }

    private getBatchDelayMs(): number {
        const engine = this.settings?.translateEngine || 'google';
        if (engine !== 'openai') {
            return 0;
        }

        return Math.max(0, this.settings?.requestDelay || 0);
    }

    private filterGroupsForTranslation(groups: TextGroup[], allBlocks: TextBlock[]): TextGroup[] {
        if (!groups.length) return groups;
        const { medianArea } = this.computeMedianStats(allBlocks);
        return groups.filter((group) => {
            const compact = group.text.replace(/\s+/g, '');
            const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(compact);
            const isUpper = /^[A-Z]{2,6}$/.test(compact);
            const isShort = isCjk ? compact.length <= 3 : compact.length <= 4;
            const groupArea = (group.bbox.x1 - group.bbox.x0) * (group.bbox.y1 - group.bbox.y0);

            if (isUpper && groupArea > medianArea * 1.2) {
                return false;
            }

            if (isShort && group.blocks.length <= 2 && groupArea > medianArea * 1.6) {
                return false;
            }

            return true;
        });
    }

    private applyContextualFilters(keptBlocks: TextBlock[], allBlocks: TextBlock[]): TextBlock[] {
        if (!keptBlocks.length) return [];
        const { medianArea, medianHeight } = this.computeMedianStats(allBlocks);

        return keptBlocks.filter((block) => {
            const text = block.text.trim();
            const compact = text.replace(/\s+/g, '');
            const area = (block.bbox.x1 - block.bbox.x0) * (block.bbox.y1 - block.bbox.y0);
            const height = block.bbox.y1 - block.bbox.y0;
            const width = block.bbox.x1 - block.bbox.x0;
            const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
            const isUpper = /^[A-Z]{2,6}$/.test(compact);
            const isShort = compact.length <= 3;
            const isLarge = area > medianArea * 2.6 || height > medianHeight * 1.7;
            const isolated = !keptBlocks.some((other) => other !== block && this.isNearBlock(other, block));
            const aspect = width > 0 && height > 0 ? Math.max(width / height, height / width) : 1;
            const edgeDensity = this.estimateEdgeDensity(allBlocks, block);

            if (isCjk && isShort && isLarge && isolated) {
                console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: \"${text}\"`);
                return false;
            }

            if (!isCjk && isShort && isolated && isLarge) {
                console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: \"${text}\"`);
                return false;
            }

            if (isUpper && isolated && area > medianArea * 1.2) {
                console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: \"${text}\"`);
                return false;
            }

            if (isShort && isolated && aspect >= 2.4 && area > medianArea * 1.8) {
                console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: \"${text}\"`);
                return false;
            }

            if (isShort && isolated && edgeDensity >= 0.2 && area > medianArea * 1.2) {
                console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: \"${text}\"`);
                return false;
            }

            return true;
        });
    }

    private computeMedianStats(blocks: TextBlock[]): { medianArea: number; medianHeight: number } {
        if (!blocks.length) return { medianArea: 1, medianHeight: 1 };
        const areas = blocks.map((b) => (b.bbox.x1 - b.bbox.x0) * (b.bbox.y1 - b.bbox.y0)).sort((a, b) => a - b);
        const heights = blocks.map((b) => b.bbox.y1 - b.bbox.y0).sort((a, b) => a - b);
        const mid = Math.floor(areas.length / 2);
        const medianArea = areas[mid] || areas[0];
        const medianHeight = heights[mid] || heights[0];
        return { medianArea, medianHeight };
    }

    private estimateEdgeDensity(blocks: TextBlock[], block: TextBlock): number {
        const width = block.bbox.x1 - block.bbox.x0;
        const height = block.bbox.y1 - block.bbox.y0;
        if (width <= 0 || height <= 0) return 0;
        // 粗略估计：短词 + 高瘦比例视作高边缘密度
        const aspect = Math.max(width / height, height / width);
        if (aspect >= 2.8) return 0.25;
        return 0.08;
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

        const { medianArea, medianHeight } = this.computeMedianStats(blocks);
        const sorted = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
        const blockMeta = sorted.map((block) => {
            const width = block.bbox.x1 - block.bbox.x0;
            const height = block.bbox.y1 - block.bbox.y0;
            const area = Math.max(1, width * height);
            const text = block.text.trim();
            const compact = text.replace(/\s+/g, '');
            const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
            const isUpper = /^[A-Z]{2,6}$/.test(compact);
            const isShort = compact.length <= (isCjk ? 2 : 4);
            const aspect = width > 0 && height > 0 ? Math.max(width / height, height / width) : 1;
            const isDecorativeLike =
                (isShort && area > medianArea * 1.6 && (height > medianHeight * 1.4 || aspect >= 2.4)) ||
                (isUpper && area > medianArea * 1.2);
            return { width, height, area, isDecorativeLike };
        });
        const n = sorted.length;
        const parent = Array.from({ length: n }, (_, i) => i);

        const find = (x: number): number => {
            if (parent[x] !== x) parent[x] = find(parent[x]);
            return parent[x];
        };
        const union = (a: number, b: number): void => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent[rb] = ra;
        };

        const isClose = (a: TextBlock, b: TextBlock, metaA: { height: number; width: number; isDecorativeLike: boolean }, metaB: { height: number; width: number; isDecorativeLike: boolean }): boolean => {
            const bh = metaB.height;
            const ah = metaA.height;

            const vGap = Math.max(0, Math.max(a.bbox.y0 - b.bbox.y1, b.bbox.y0 - a.bbox.y1));
            const hGap = Math.max(0, Math.max(a.bbox.x0 - b.bbox.x1, b.bbox.x0 - a.bbox.x1));

            const maxH = Math.max(ah, bh);
            const maxW = Math.max(metaA.width, metaB.width);

            const overlap = Math.max(0, Math.min(a.bbox.x1, b.bbox.x1) - Math.max(a.bbox.x0, b.bbox.x0));
            const minW = Math.max(1, Math.min(metaA.width, metaB.width));
            const overlapRatio = overlap / minW;

            const isDecorPair = metaA.isDecorativeLike || metaB.isDecorativeLike;
            if (metaA.isDecorativeLike !== metaB.isDecorativeLike) {
                return false;
            }

            if (isDecorPair) {
                const nearVertDecor = vGap < Math.min(maxH * 0.4, medianHeight * 0.6);
                const nearHorizDecor = overlapRatio >= 0.5 || hGap < maxW * 0.2;
                return nearVertDecor && nearHorizDecor;
            }

            const nearVert = vGap < Math.min(maxH * 0.7, medianHeight * 0.9);
            const nearHoriz = overlapRatio >= 0.3 || hGap < maxW * 0.3;

            return nearVert && nearHoriz;
        };

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (isClose(sorted[i], sorted[j], blockMeta[i], blockMeta[j])) {
                    union(i, j);
                }
            }
        }

        const groupMap = new Map<number, { bbox: TextBlock['bbox']; blocks: TextBlock[] }>();
        for (let i = 0; i < n; i++) {
            const root = find(i);
            const block = sorted[i];
            const existing = groupMap.get(root);
            if (!existing) {
                groupMap.set(root, { bbox: { ...block.bbox }, blocks: [block] });
            } else {
                existing.blocks.push(block);
                existing.bbox = {
                    x0: Math.min(existing.bbox.x0, block.bbox.x0),
                    y0: Math.min(existing.bbox.y0, block.bbox.y0),
                    x1: Math.max(existing.bbox.x1, block.bbox.x1),
                    y1: Math.max(existing.bbox.y1, block.bbox.y1),
                };
            }
        }

        return Array.from(groupMap.values()).map((g) => {
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

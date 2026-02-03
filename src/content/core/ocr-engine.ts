// 漫译 MangaFlow - OCR 引擎模块
// 支持本地 (Tesseract.js) 和云端 (Google Cloud Vision) 两种模式
// 阶段1：仅做文本区域检测和 OCR 识别验证

import Tesseract from 'tesseract.js';
import type { OCRResult, TextBlock, Settings } from '../../types';
import { DebugOverlayManager } from './debug-overlay';

export type OCREngineType = 'local' | 'cloud';

export class OCREngine {
    // Tesseract 相关
    private worker: Tesseract.Worker | null = null;
    private tessInitialized = false;
    private currentLang = '';

    // 配置
    private engineType: OCREngineType = 'local';
    private cloudApiKey = '';
    private debugMode = true; // 阶段1：调试模式，显示红框

    // 文本检测阈值配置
    private config = {
        minConfidence: 50, // 最低置信度 (0-100)
        minTextLength: 2, // 最少字符数
        minBlockArea: 80, // 最小文本块面积 (像素)
    };

    // 语言映射 (Tesseract)
    private langMap: Record<string, string> = {
        ko: 'kor',
        ja: 'jpn+jpn_vert',
        en: 'eng',
        zh: 'chi_sim',
        auto: 'kor+jpn+eng',
    };

    /**
     * 设置 OCR 引擎配置
     */
    configure(settings: Partial<Settings>): void {
        if (settings.ocrEngine) {
            this.engineType = settings.ocrEngine;
        }
        if (settings.cloudOcrKey) {
            this.cloudApiKey = settings.cloudOcrKey;
        }
        console.log(`[MangaFlow] OCR 引擎: ${this.engineType === 'cloud' ? '☁️ Google Cloud Vision' : '💻 本地 Tesseract'}`);
    }

    /**
     * 初始化本地 Tesseract 引擎
     */
    async initLocal(lang: string = 'ko'): Promise<void> {
        const tessLang = this.langMap[lang] || 'kor+jpn+eng';

        if (this.tessInitialized && this.currentLang === tessLang) {
            return;
        }

        if (this.worker) {
            await this.worker.terminate();
        }

        console.log(`[MangaFlow] 📖 初始化本地 OCR，语言: ${tessLang}`);
        const startTime = performance.now();

        try {
            this.worker = await Tesseract.createWorker(tessLang, 1);
            this.currentLang = tessLang;
            this.tessInitialized = true;
            console.log(`[MangaFlow] ✅ 本地 OCR 初始化完成 (${(performance.now() - startTime).toFixed(0)}ms)`);
        } catch (error) {
            console.error('[MangaFlow] ❌ 本地 OCR 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 识别图片中的文字（主入口）
     */
    async recognize(
        image: HTMLImageElement | HTMLCanvasElement,
        lang: string = 'ko',
        debug = this.debugMode,
        filename?: string
    ): Promise<OCRResult> {
        const logName = filename || 'Image';
        console.log(`[MangaFlow] 🔍 开始 OCR 识别 [${logName}] (${this.engineType})...`);
        const startTime = performance.now();

        let result: OCRResult;

        if (this.engineType === 'cloud' && this.cloudApiKey) {
            result = await this.recognizeWithGoogleVision(image, filename);
        } else {
            result = await this.recognizeWithTesseract(image, lang);
        }

        const elapsed = performance.now() - startTime;
        console.log(`[MangaFlow] ✅ OCR 完成 (${elapsed.toFixed(0)}ms), 识别 ${result.blocks.length} 个文本块`);

        // 显示识别结果
        if (result.blocks.length > 0) {
            console.group('[MangaFlow] 📝 识别结果:');
            result.blocks.forEach((block, i) => {
                console.log(`  [${i + 1}] "${block.text}" (置信度: ${(block.confidence * 100).toFixed(0)}%)`);
            });
            console.groupEnd();

            // 阶段1：绘制红框
            if (debug) {
                this.drawDebugBoxes(image, result.blocks);
            }
        }

        return result;
    }

    /**
     * 仅识别指定区域（裁剪后 OCR）
     */
    async recognizeRegions(
        image: HTMLImageElement | HTMLCanvasElement,
        regions: Array<{ x0: number; y0: number; x1: number; y1: number }>,
        lang: string = 'ko',
        debug = this.debugMode,
        filename?: string
    ): Promise<OCRResult> {
        const safeImage = await this.ensureSafeImage(image);
        const allBlocks: TextBlock[] = [];

        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];
            const cropCanvas = this.cropRegionToCanvas(safeImage, region);
            const name = filename ? `${filename}#ROI${i + 1}` : `ROI${i + 1}`;

            let result: OCRResult;
            if (this.engineType === 'cloud' && this.cloudApiKey) {
                result = await this.recognizeWithGoogleVision(cropCanvas, name);
                const regionArea = Math.max(1, cropCanvas.width * cropCanvas.height);
                if (this.shouldFallback(result.blocks, regionArea)) {
                    const enhanced = this.preprocessCanvasForOcr(cropCanvas);
                    console.log(`[MangaFlow] OCR enhance: ${name} (${enhanced.mode})`);
                    const alt = await this.recognizeWithGoogleVision(enhanced.canvas, `${name}#ENH`);
                    const scaledAltBlocks = this.scaleBlocks(alt.blocks, 1 / enhanced.scale);
                    const altResult: OCRResult = {
                        text: scaledAltBlocks.map((b) => b.text).join('\n'),
                        confidence: scaledAltBlocks.length > 0
                            ? scaledAltBlocks.reduce((sum, b) => sum + b.confidence, 0) / scaledAltBlocks.length
                            : 0,
                        blocks: scaledAltBlocks,
                    };
                    if (this.countMeaningfulBlocks(altResult.blocks) > this.countMeaningfulBlocks(result.blocks)) {
                        result = altResult;
                    }
                }
            } else {
                result = await this.recognizeWithTesseract(cropCanvas, lang);
            }

            // ???????
            result.blocks.forEach((block) => {
                allBlocks.push({
                    text: block.text,
                    confidence: block.confidence,
                    bbox: {
                        x0: block.bbox.x0 + region.x0,
                        y0: block.bbox.y0 + region.y0,
                        x1: block.bbox.x1 + region.x0,
                        y1: block.bbox.y1 + region.y0,
                    },
                });
            });
        }

        const merged: OCRResult = {
            text: allBlocks.map((b) => b.text).join('\n'),
            confidence: allBlocks.length > 0
                ? allBlocks.reduce((sum, b) => sum + b.confidence, 0) / allBlocks.length
                : 0,
            blocks: allBlocks,
        };

        if (debug && allBlocks.length > 0) {
            this.drawDebugBoxes(image, allBlocks);
        }

        return merged;
    }

    /**
     * 使用 Tesseract.js 识别
     */
    private async recognizeWithTesseract(
        image: HTMLImageElement | HTMLCanvasElement,
        lang: string
    ): Promise<OCRResult> {
        if (!this.tessInitialized || !this.worker) {
            await this.initLocal(lang);
        }

        const result = await this.worker!.recognize(image);
        const blocks: TextBlock[] = [];

        result.data.blocks?.forEach((block) => {
            block.paragraphs?.forEach((para) => {
                para.lines?.forEach((line) => {
                    const text = line.text.trim();
                    const confidence = line.confidence;
                    const area = (line.bbox.x1 - line.bbox.x0) * (line.bbox.y1 - line.bbox.y0);

                    // 过滤
                    if (confidence < this.config.minConfidence) return;
                    if (text.length < this.config.minTextLength) return;
                    if (area < this.config.minBlockArea) return;
                    if (/^[\d\s\.\,\-\+\=\:\;\'\"\!\?\(\)\[\]\{\}\<\>\@\#\$\%\^\&\*\_\/\\]+$/.test(text)) return;

                    blocks.push({
                        text,
                        bbox: { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 },
                        confidence: confidence / 100,
                    });
                });
            });
        });

        return {
            text: blocks.map((b) => b.text).join('\n'),
            confidence: blocks.length > 0 ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length : 0,
            blocks,
        };
    }

    /**
     * 使用 Google Cloud Vision API 识别
     */
    private async recognizeWithGoogleVision(
        image: HTMLImageElement | HTMLCanvasElement,
        filename?: string
    ): Promise<OCRResult> {
        if (!this.cloudApiKey) {
            throw new Error('请在设置中配置 Google Cloud Vision API Key');
        }

        const logName = filename || 'Image';
        console.log(`[MangaFlow] ☁️ 调用 Google Cloud Vision API [${logName}]...`);

        // 将图片转为 base64
        const base64 = await this.imageToBase64(image);

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${this.cloudApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [
                        {
                            image: { content: base64 },
                            features: [{ type: 'TEXT_DETECTION', maxResults: 50 }],
                            imageContext: {
                                languageHints: ['ko', 'ja', 'zh', 'en'],
                            },
                        },
                    ],
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[MangaFlow] Google Vision API 错误:', errorText);
            throw new Error(`Google Vision API 错误: ${response.status}`);
        }

        const data = await response.json();

        // 检查错误
        if (data.responses?.[0]?.error) {
            throw new Error(data.responses[0].error.message);
        }

        // 解析结果
        const annotations = data.responses?.[0]?.textAnnotations || [];
        const blocks: TextBlock[] = [];

        // 第一个是全文，跳过；从第二个开始是各个文本块
        for (let i = 1; i < annotations.length; i++) {
            const ann = annotations[i];
            const text = ann.description?.trim();
            if (!text || text.length < this.config.minTextLength) continue;

            // 获取边界框
            const vertices = ann.boundingPoly?.vertices || [];
            if (vertices.length < 4) continue;

            const xs = vertices.map((v: { x?: number }) => v.x || 0);
            const ys = vertices.map((v: { y?: number }) => v.y || 0);
            const x0 = Math.min(...xs);
            const y0 = Math.min(...ys);
            const x1 = Math.max(...xs);
            const y1 = Math.max(...ys);

            // 过滤纯符号
            if (/^[\d\s\.\,\-\+\=\:\;\'\"\!\?\(\)\[\]\{\}\<\>\@\#\$\%\^\&\*\_\/\\]+$/.test(text)) continue;

            blocks.push({
                text,
                bbox: { x0, y0, x1, y1 },
                confidence: 0.95, // Google Vision 不返回置信度，默认较高
            });
        }

        // 合并相邻的文本块（Google Vision 按词返回，需要合并成行）
        const mergedBlocks = this.mergeAdjacentBlocks(blocks);

        return {
            text: annotations[0]?.description || '',
            confidence: 0.95,
            blocks: mergedBlocks,
        };
    }

    /**
     * 合并相邻的文本块（垂直距离接近的合并成一行）
     */
    private mergeAdjacentBlocks(blocks: TextBlock[]): TextBlock[] {
        if (blocks.length === 0) return [];

        // 按 y 坐标排序
        const sorted = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
        const merged: TextBlock[] = [];
        let current = { ...sorted[0] };

        for (let i = 1; i < sorted.length; i++) {
            const next = sorted[i];
            const verticalGap = Math.abs(next.bbox.y0 - current.bbox.y0);
            const lineHeight = current.bbox.y1 - current.bbox.y0;

            // 如果垂直距离在同一行范围内，合并
            if (verticalGap < lineHeight * 0.5) {
                current.text += ' ' + next.text;
                current.bbox.x0 = Math.min(current.bbox.x0, next.bbox.x0);
                current.bbox.y0 = Math.min(current.bbox.y0, next.bbox.y0);
                current.bbox.x1 = Math.max(current.bbox.x1, next.bbox.x1);
                current.bbox.y1 = Math.max(current.bbox.y1, next.bbox.y1);
            } else {
                merged.push(current);
                current = { ...next };
            }
        }
        merged.push(current);

        return merged;
    }


    private isMeaningfulText(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return false;
        if (/[가-힯]/.test(trimmed)) return trimmed.length >= 2;
        if (/[぀-ヿ]/.test(trimmed)) return trimmed.length >= 2;
        if (/[㐀-鿿]/.test(trimmed)) return trimmed.length >= 2;
        if (/[a-zA-Z]/.test(trimmed)) return trimmed.length >= 3;
        if (/\d/.test(trimmed)) return trimmed.length >= 3;
        return false;
    }

    private countMeaningfulBlocks(blocks: TextBlock[]): number {
        return blocks.filter((block) => this.isMeaningfulText(block.text)).length;
    }

    private shouldFallback(blocks: TextBlock[], regionArea: number): boolean {
        if (!blocks.length) return true;
        const meaningful = this.countMeaningfulBlocks(blocks);
        if (meaningful === 0) return true;
        if (meaningful <= 1) {
            const avgArea = blocks.reduce((sum, b) => sum + (b.bbox.x1 - b.bbox.x0) * (b.bbox.y1 - b.bbox.y0), 0) / Math.max(1, blocks.length);
            if (avgArea < regionArea * 0.005) return true;
        }
        return false;
    }

    private preprocessCanvasForOcr(input: HTMLCanvasElement): { canvas: HTMLCanvasElement; scale: number; mode: string } {
        const maxTarget = 1000;
        const maxDim = Math.max(input.width, input.height);
        let scale = 2;
        if (maxDim * scale > maxTarget) {
            scale = Math.max(1, maxTarget / maxDim);
        }

        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(input.width * scale));
        out.height = Math.max(1, Math.round(input.height * scale));
        const ctx = out.getContext('2d', { willReadFrequently: true })!;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(input, 0, 0, out.width, out.height);

        const imageData = ctx.getImageData(0, 0, out.width, out.height);
        const data = imageData.data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            sum += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        const mean = sum / Math.max(1, data.length / 4);
        const invert = mean < 110;
        const contrast = 1.4;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            gray = (gray - 128) * contrast + 128;
            if (invert) gray = 255 - gray;
            gray = Math.max(0, Math.min(255, gray));
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }

        ctx.putImageData(imageData, 0, 0);
        return { canvas: out, scale, mode: invert ? 'invert' : 'gray' };
    }

    private scaleBlocks(blocks: TextBlock[], scale: number): TextBlock[] {
        return blocks.map((block) => ({
            text: block.text,
            confidence: block.confidence,
            bbox: {
                x0: Math.round(block.bbox.x0 * scale),
                y0: Math.round(block.bbox.y0 * scale),
                x1: Math.round(block.bbox.x1 * scale),
                y1: Math.round(block.bbox.y1 * scale),
            },
        }));
    }


    /**
     * 将图片转为 base64（不含 data:image/xxx;base64, 前缀）
     * 处理跨域图片：先尝试直接转换，失败则通过 fetch 获取
     */
    private async imageToBase64(image: HTMLImageElement | HTMLCanvasElement): Promise<string> {
        // 如果是 canvas，直接转换
        if (image instanceof HTMLCanvasElement) {
            const dataUrl = image.toDataURL('image/png');
            return dataUrl.replace(/^data:image\/\w+;base64,/, '');
        }

        // 如果是图片，先尝试直接 canvas 转换
        try {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            return dataUrl.replace(/^data:image\/\w+;base64,/, '');
        } catch {
            // 跨域图片，使用 fetch 获取
            console.log('[MangaFlow] ⚠️ 图片跨域，使用 fetch 方式获取...');
            return await this.fetchImageAsBase64(image.src);
        }
    }

    /**
     * 通过 fetch 获取图片并转为 base64（绕过 CORS）
     */
    private async fetchImageAsBase64(url: string): Promise<string> {
        try {
            // 通过 background script 获取图片（CSP 限制较少）
            const response = await chrome.runtime.sendMessage({
                type: 'FETCH_IMAGE',
                imageUrl: url,
            });

            if (!response.success || response.error) {
                throw new Error(response.error || '获取图片失败');
            }

            // service worker 返回的是完整的 data URL，需要去掉前缀
            const dataUrl = response.imageData as string;
            return dataUrl.replace(/^data:image\/\w+;base64,/, '');
        } catch (error) {
            console.error('[MangaFlow] 获取图片失败:', error);
            throw new Error('无法获取图片: ' + (error as Error).message);
        }
    }

    private async ensureSafeImage(image: HTMLImageElement | HTMLCanvasElement): Promise<HTMLImageElement | HTMLCanvasElement> {
        if (image instanceof HTMLCanvasElement) return image;

        // 尝试直接读取像素
        try {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            ctx.getImageData(0, 0, 1, 1);
            return image;
        } catch {
            const base64 = await this.fetchImageAsBase64(image.src);
            return await this.loadImageFromBase64(base64);
        }
    }

    private cropRegionToCanvas(
        image: HTMLImageElement | HTMLCanvasElement,
        region: { x0: number; y0: number; x1: number; y1: number }
    ): HTMLCanvasElement {
        const width = Math.max(1, Math.floor(region.x1 - region.x0));
        const height = Math.max(1, Math.floor(region.y1 - region.y0));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(
            image,
            region.x0,
            region.y0,
            width,
            height,
            0,
            0,
            width,
            height
        );
        return canvas;
    }

    private loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            // fetchImageAsBase64 返回的是不带前缀的纯 base64
            img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        });
    }

    /**
     * 阶段1：绘制调试红框
     */
    private drawDebugBoxes(image: HTMLImageElement | HTMLCanvasElement, blocks: TextBlock[]): void {
        DebugOverlayManager.getInstance().setOcrBoxes(image, blocks);
    }

    logBlocks(blocks: TextBlock[], label: string = 'OCR 识别结果'): void {
        if (!blocks.length) return;
        console.group(`[MangaFlow] 📝 ${label}:`);
        blocks.forEach((block, i) => {
            const conf = Math.round(block.confidence * 100);
            const { x0, y0, x1, y1 } = block.bbox;
            console.log(`  [${i + 1}] "${block.text}" (置信度: ${conf}%, bbox: ${x0},${y0},${x1},${y1})`);
        });
        console.groupEnd();
    }

    drawDebugBoxesFor(image: HTMLImageElement | HTMLCanvasElement, blocks: TextBlock[], debug: boolean): void {
        if (!debug || !blocks.length) return;
        this.drawDebugBoxes(image, blocks);
    }

    clearDebugBoxes(): void {
        DebugOverlayManager.getInstance().clearOcrBoxes();
    }

    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    getEngineType(): OCREngineType {
        return this.engineType;
    }

    isInitialized(): boolean {
        return this.engineType === 'cloud' ? !!this.cloudApiKey : this.tessInitialized;
    }

    async destroy(): Promise<void> {
        this.clearDebugBoxes();
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.tessInitialized = false;
        }
    }
}

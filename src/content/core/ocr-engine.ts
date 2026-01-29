// 漫译 MangaFlow - OCR 引擎模块
// 支持本地 (Tesseract.js) 和云端 (Google Cloud Vision) 两种模式
// 阶段1：仅做文本区域检测和 OCR 识别验证

import Tesseract from 'tesseract.js';
import type { OCRResult, TextBlock, Settings } from '../../types';

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
        debug = this.debugMode
    ): Promise<OCRResult> {
        console.log(`[MangaFlow] 🔍 开始 OCR 识别 (${this.engineType})...`);
        const startTime = performance.now();

        let result: OCRResult;

        if (this.engineType === 'cloud' && this.cloudApiKey) {
            result = await this.recognizeWithGoogleVision(image);
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
    private async recognizeWithGoogleVision(image: HTMLImageElement | HTMLCanvasElement): Promise<OCRResult> {
        if (!this.cloudApiKey) {
            throw new Error('请在设置中配置 Google Cloud Vision API Key');
        }

        // 将图片转为 base64
        const base64 = await this.imageToBase64(image);

        console.log('[MangaFlow] ☁️ 调用 Google Cloud Vision API...');

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

    /**
     * 阶段1：绘制调试红框
     */
    private drawDebugBoxes(image: HTMLImageElement | HTMLCanvasElement, blocks: TextBlock[]): void {
        const parent = image.parentElement;
        if (!parent) return;

        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        const rect = image.getBoundingClientRect();
        const naturalWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
        const naturalHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
        const scaleX = rect.width / naturalWidth;
        const scaleY = rect.height / naturalHeight;

        const parentRect = parent.getBoundingClientRect();
        const offsetX = rect.left - parentRect.left;
        const offsetY = rect.top - parentRect.top;

        // 移除旧的调试框
        parent.querySelectorAll('.manga-flow-ocr-box').forEach((el) => el.remove());

        // 绘制红框
        blocks.forEach((block, index) => {
            const box = document.createElement('div');
            box.className = 'manga-flow-ocr-box';
            box.style.left = `${offsetX + block.bbox.x0 * scaleX}px`;
            box.style.top = `${offsetY + block.bbox.y0 * scaleY}px`;
            box.style.width = `${(block.bbox.x1 - block.bbox.x0) * scaleX}px`;
            box.style.height = `${(block.bbox.y1 - block.bbox.y0) * scaleY}px`;

            const label = document.createElement('span');
            label.className = 'manga-flow-ocr-label';
            label.textContent = `${index + 1}`;
            box.appendChild(label);

            parent.appendChild(box);
        });

        console.log('[MangaFlow] 🔴 已绘制调试红框');
    }

    clearDebugBoxes(): void {
        document.querySelectorAll('.manga-flow-ocr-box').forEach((el) => el.remove());
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

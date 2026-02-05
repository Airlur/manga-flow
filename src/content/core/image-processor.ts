// 漫译 MangaFlow - 图像处理模块
// 组级别背景分析与擦除

import type { RenderGroup, BBox } from '../../types';

export interface GroupAnalysis {
    bbox: BBox;
    maskBox: BBox;
    avgColor: string;
    variance: number;
    luminance: number;
    edgeDensity: number;
    dominantRatio: number;
    ringVariance: number;
    bubbleLuminance: number;
    ringLightRatio: number;
    isDark: boolean;
    isComplex: boolean;
    isBubble: boolean;
    isLightBubble: boolean;
    renderMode: 'erase' | 'mask';
}

export class ImageProcessor {
    /**
     * 处理图片：按组擦除背景并返回 Canvas
     */
    async processImage(
        img: HTMLImageElement,
        groups: RenderGroup[]
    ): Promise<{ canvas: HTMLCanvasElement; analysis: GroupAnalysis[] }> {
        let canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        let ctx = canvas.getContext('2d')!;

        // 绘制原图
        ctx.drawImage(img, 0, 0);

        // 检测跨域
        let isTainted = false;
        try {
            ctx.getImageData(0, 0, 1, 1);
        } catch {
            isTainted = true;
        }

        if (isTainted) {
            console.log('[MangaFlow] ⚠️ 跨域图片，使用代理重绘', img.src);
            const base64Image = await this.fetchImageViaProxy(img.src);
            const proxyImg = await this.loadImageFromBase64(base64Image);

            canvas = document.createElement('canvas');
            canvas.width = proxyImg.naturalWidth;
            canvas.height = proxyImg.naturalHeight;
            ctx = canvas.getContext('2d')!;
            ctx.drawImage(proxyImg, 0, 0);
        }

        console.log(`[MangaFlow] 🧹 组级擦除 ${groups.length} 个区域...`);
        const analysis: GroupAnalysis[] = [];

        for (const group of groups) {
            const maskBox = this.expandBox(group.bbox, canvas.width, canvas.height);
            const analysisBox = this.expandAnalysisBox(group.bbox, canvas.width, canvas.height);
            const stats = this.analyzeRegion(ctx, analysisBox);
            const isBubble = this.isBubbleRegion(stats);
            const isComplex = this.isComplexRegion(stats);
            const sourceText = this.getGroupSourceText(group);
            const isShort = this.isShortLabel(sourceText);
            const isLightBubble = !isShort && isBubble
                && stats.edgeDensity <= 0.08
                && stats.ringVariance <= 4500
                && stats.dominantRatio >= 0.65
                && stats.bubbleLuminance >= 205
                && stats.ringLightRatio >= 0.55;

            const renderMode: GroupAnalysis['renderMode'] = (!isShort && isBubble && !isComplex) ? 'erase' : 'mask';

            const info: GroupAnalysis = {
                bbox: group.bbox,
                maskBox,
                avgColor: stats.avgColor,
                variance: stats.variance,
                luminance: stats.luminance,
                edgeDensity: stats.edgeDensity,
                dominantRatio: stats.dominantRatio,
                ringVariance: stats.ringVariance,
                bubbleLuminance: stats.bubbleLuminance,
                ringLightRatio: stats.ringLightRatio,
                isDark: stats.luminance < 128,
                isComplex,
                isBubble,
                isLightBubble,
                renderMode,
            };

            if (renderMode === 'erase') {
                this.eraseRegion(ctx, maskBox, info);
            }

            analysis.push(info);
        }

        return { canvas, analysis };
    }

    private expandBox(box: BBox, canvasWidth: number, canvasHeight: number): BBox {
        const width = box.x1 - box.x0;
        const height = box.y1 - box.y0;
        const padX = Math.min(
            Math.max(6, Math.round(height * 0.6)),
            Math.round(width * 0.08)
        );
        const padY = Math.max(4, Math.round(height * 0.25));

        const x0 = Math.max(0, Math.floor(box.x0 - padX));
        const y0 = Math.max(0, Math.floor(box.y0 - padY));
        const x1 = Math.min(canvasWidth, Math.ceil(box.x1 + padX));
        const y1 = Math.min(canvasHeight, Math.ceil(box.y1 + padY));

        return { x0, y0, x1, y1 };
    }

    private expandAnalysisBox(box: BBox, canvasWidth: number, canvasHeight: number): BBox {
        const width = box.x1 - box.x0;
        const height = box.y1 - box.y0;
        const padX = Math.min(
            Math.max(4, Math.round(height * 0.35)),
            Math.round(width * 0.06)
        );
        const padY = Math.max(3, Math.round(height * 0.18));

        const x0 = Math.max(0, Math.floor(box.x0 - padX));
        const y0 = Math.max(0, Math.floor(box.y0 - padY));
        const x1 = Math.min(canvasWidth, Math.ceil(box.x1 + padX));
        const y1 = Math.min(canvasHeight, Math.ceil(box.y1 + padY));

        return { x0, y0, x1, y1 };
    }

    private analyzeRegion(
        ctx: CanvasRenderingContext2D,
        box: BBox
    ): {
        avgColor: string;
        variance: number;
        ringVariance: number;
        luminance: number;
        edgeDensity: number;
        dominantRatio: number;
        bubbleLuminance: number;
        ringLightRatio: number;
    } {
        const width = Math.max(1, Math.floor(box.x1 - box.x0));
        const height = Math.max(1, Math.floor(box.y1 - box.y0));
        const imageData = ctx.getImageData(box.x0, box.y0, width, height);
        const data = imageData.data;

        const step = Math.max(1, Math.floor(Math.max(width, height) / 180));
        const hist = new Uint32Array(512);
        const ringHist = new Uint32Array(512);
        let sampleCount = 0;
        let lumSum = 0;
        let lumSumSq = 0;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let edgeCount = 0;
        let ringCount = 0;
        let ringLumSum = 0;
        let ringLumSumSq = 0;
        let ringRSum = 0;
        let ringGSum = 0;
        let ringBSum = 0;
        let ringEdgeCount = 0;
        let ringLightSum = 0;
        let ringLightCount = 0;
        const ringMargin = Math.max(2, Math.round(Math.min(width, height) * 0.08));

        const getLum = (idx: number): number => {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            return 0.299 * r + 0.587 * g + 0.114 * b;
        };

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                lumSum += lum;
                lumSumSq += lum * lum;
                rSum += r;
                gSum += g;
                bSum += b;
                sampleCount++;

                const bucket = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
                hist[bucket]++;

                const isRing = x < ringMargin || y < ringMargin || x >= width - ringMargin || y >= height - ringMargin;
                if (isRing) {
                    ringLumSum += lum;
                    ringLumSumSq += lum * lum;
                    ringRSum += r;
                    ringGSum += g;
                    ringBSum += b;
                    ringCount++;
                    ringHist[bucket]++;
                    if (lum >= 200) {
                        ringLightSum += lum;
                        ringLightCount++;
                    }
                }

                if (x + step < width && y + step < height) {
                    const idxRight = (y * width + (x + step)) * 4;
                    const idxDown = ((y + step) * width + x) * 4;
                    const lumRight = getLum(idxRight);
                    const lumDown = getLum(idxDown);
                    const grad = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
                    if (grad > 40) {
                        edgeCount++;
                        if (isRing) ringEdgeCount++;
                    }
                }
            }
        }

        const avgLum = lumSum / Math.max(1, sampleCount);
        const variance = lumSumSq / Math.max(1, sampleCount) - avgLum * avgLum;
        const ringAvgLum = ringLumSum / Math.max(1, ringCount);
        const ringLightAvg = ringLightCount ? (ringLightSum / ringLightCount) : ringAvgLum;
        const ringLightRatio = ringLightCount / Math.max(1, ringCount);
        const ringVariance = ringLumSumSq / Math.max(1, ringCount) - ringAvgLum * ringAvgLum;
        const avgR = Math.round((ringCount ? ringRSum : rSum) / Math.max(1, ringCount || sampleCount));
        const avgG = Math.round((ringCount ? ringGSum : gSum) / Math.max(1, ringCount || sampleCount));
        const avgB = Math.round((ringCount ? ringBSum : bSum) / Math.max(1, ringCount || sampleCount));

        let maxBin = 0;
        for (const count of hist) {
            if (count > maxBin) maxBin = count;
        }

        let ringMaxBin = 0;
        for (const count of ringHist) {
            if (count > ringMaxBin) ringMaxBin = count;
        }

        const dominantRatio = (ringCount ? ringMaxBin : maxBin) / Math.max(1, ringCount || sampleCount);
        const edgeDensity = (ringCount ? ringEdgeCount : edgeCount) / Math.max(1, ringCount || sampleCount);

        return {
            avgColor: `rgb(${avgR},${avgG},${avgB})`,
            variance: Math.max(0, variance),
            ringVariance: Math.max(0, ringVariance),
            luminance: avgLum,
            edgeDensity,
            dominantRatio,
            bubbleLuminance: ringLightAvg,
            ringLightRatio,
        };
    }

    private isBubbleRegion(stats: { dominantRatio: number; edgeDensity: number; ringVariance: number }): boolean {
        if (stats.dominantRatio >= 0.62 && stats.edgeDensity <= 0.1) return true;
        if (stats.dominantRatio >= 0.56 && stats.edgeDensity <= 0.08 && stats.ringVariance <= 4500) return true;
        return false;
    }

    private isComplexRegion(stats: { edgeDensity: number; ringVariance: number }): boolean {
        return stats.edgeDensity >= 0.14 || stats.ringVariance >= 6500;
    }

    private isShortLabel(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return false;
        const compact = trimmed.replace(/\s+/g, '');
        const normalized = compact.replace(/[^A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/g, '');
        if (!normalized) return false;
        const hasCjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(normalized);
        const hasLatin = /[A-Za-z]/.test(normalized);
        if (normalized.length <= 8) return true;
        if (hasCjk && normalized.length <= 10) return true;
        if (hasLatin && normalized.length <= 14) return true;
        return false;
    }

    private getGroupSourceText(group: RenderGroup): string {
        if (!group.blocks?.length) return '';
        return group.blocks.map((block) => block.text).join(' ');
    }

    private eraseRegion(
        ctx: CanvasRenderingContext2D,
        box: BBox,
        info: GroupAnalysis
    ): void {
        const width = Math.max(1, Math.floor(box.x1 - box.x0));
        const height = Math.max(1, Math.floor(box.y1 - box.y0));
        const imageData = ctx.getImageData(box.x0, box.y0, width, height);
        const data = imageData.data;

        let { bgR, bgG, bgB } = this.sampleEdgeColor(data, width, { x: 0, y: 0, w: width, h: height });
        if (info.isLightBubble && info.bubbleLuminance >= 205) {
            bgR = 255;
            bgG = 255;
            bgB = 255;
        }
        const threshold = info.isBubble ? 35 : 28;
        const pixelsToErase = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const dist = Math.sqrt(
                Math.pow(r - bgR, 2) +
                Math.pow(g - bgG, 2) +
                Math.pow(b - bgB, 2)
            );
            if (dist > threshold) {
                pixelsToErase[i / 4] = 1;
            }
        }

        // 膨胀
        const expandedMask = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (pixelsToErase[idx]) {
                    expandedMask[idx] = 1;
                    expandedMask[idx - 1] = 1;
                    expandedMask[idx + 1] = 1;
                    expandedMask[idx - width] = 1;
                    expandedMask[idx + width] = 1;
                }
            }
        }

        for (let i = 0; i < data.length / 4; i++) {
            if (expandedMask[i]) {
                const idx = i * 4;
                data[idx] = bgR;
                data[idx + 1] = bgG;
                data[idx + 2] = bgB;
            }
        }

        ctx.putImageData(imageData, box.x0, box.y0);
    }

    /**
     * 在指定的局部区域采样边缘颜色
     */
    private sampleEdgeColor(
        data: Uint8ClampedArray,
        totalWidth: number,
        box: { x: number; y: number; w: number; h: number }
    ): { bgR: number; bgG: number; bgB: number } {
        let rSum = 0, gSum = 0, bSum = 0;
        let count = 0;
        const step = 2;

        const addSample = (x: number, y: number) => {
            const idx = (y * totalWidth + x) * 4;
            if (idx < 0 || idx >= data.length) return;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
        };

        for (let x = box.x; x < box.x + box.w; x += step) {
            addSample(x, box.y);
            addSample(x, box.y + box.h - 1);
        }
        for (let y = box.y; y < box.y + box.h; y += step) {
            addSample(box.x, y);
            addSample(box.x + box.w - 1, y);
        }

        if (count === 0) return { bgR: 255, bgG: 255, bgB: 255 };
        return {
            bgR: Math.round(rSum / count),
            bgG: Math.round(gSum / count),
            bgB: Math.round(bSum / count),
        };
    }

    /**
     * 通过 Service Worker 代理加载跨域图片
     */
    private async fetchImageViaProxy(imageUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { type: 'FETCH_IMAGE', imageUrl },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response?.success && response.imageData) {
                        resolve(response.imageData);
                    } else {
                        reject(new Error(response?.error || '获取图片失败'));
                    }
                }
            );
        });
    }

    private loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = base64;
        });
    }
}

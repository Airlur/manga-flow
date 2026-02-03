// 漫译 MangaFlow - 图像处理模块
// 使用像素级替换实现“智能擦除”

import type { TextBlock } from '../../types';

export interface BlockAnalysis {
    isComplex: boolean; // 背景复杂（高方差）
    isDark: boolean;    // 背景偏暗（需要白色文字）
    avgColor: string;
    variance: number;
    luminance: number;
    maskBox?: { x0: number; y0: number; x1: number; y1: number };
}

export class ImageProcessor {
    /**
     * 处理图片：擦除原文区域并返回干净的 Canvas
     */
    async processImage(
        img: HTMLImageElement,
        blocks: TextBlock[]
    ): Promise<{ canvas: HTMLCanvasElement; analysis: BlockAnalysis[] }> {
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

        console.log(`[MangaFlow] 🧹 智能像素擦除 ${blocks.length} 个区域...`);
        const analysis: BlockAnalysis[] = [];

        for (const block of blocks) {
            const result = this.smartErase(ctx, block, canvas.width, canvas.height);
            analysis.push(result);
        }

        return { canvas, analysis };
    }

    /**
     * 智能像素擦除
     */
    private smartErase(
        ctx: CanvasRenderingContext2D,
        block: TextBlock,
        canvasWidth: number,
        canvasHeight: number
    ): BlockAnalysis {
        const { x0, y0, x1, y1 } = block.bbox;
        const width = x1 - x0;
        const height = y1 - y0;

        // 1. 扩大处理区域（Padding）
        const compactText = block.text.replace(/\s+/g, '');
        const longLine = compactText.length >= 10;
        const padX = Math.floor(width * (longLine ? 0.35 : 0.25));
        const padY = Math.floor(height * 0.2);

        const drawX = Math.max(0, Math.floor(x0 - padX));
        const drawY = Math.max(0, Math.floor(y0 - padY));
        const drawW = Math.min(canvasWidth - drawX, Math.floor(width + padX * 2));
        const drawH = Math.min(canvasHeight - drawY, Math.floor(height + padY * 2));
        const maskBox = {
            x0: drawX,
            y0: drawY,
            x1: drawX + Math.max(0, drawW),
            y1: drawY + Math.max(0, drawH),
        };

        if (drawW <= 0 || drawH <= 0) {
            return {
                isComplex: false,
                isDark: false,
                avgColor: '#FFFFFF',
                variance: 0,
                luminance: 255,
                maskBox,
            };
        }

        // 2. 获取像素数据
        const imageData = ctx.getImageData(drawX, drawY, drawW, drawH);
        const data = imageData.data;
        const len = data.length;

        // 3. 背景采样：只在原 bbox 附近采样，避免混入边框颜色
        const relX0 = Math.floor(x0 - drawX);
        const relY0 = Math.floor(y0 - drawY);
        const relW = Math.floor(width);
        const relH = Math.floor(height);

        const safeMargin = 2;
        const sampleBox = {
            x: Math.max(0, relX0 - safeMargin),
            y: Math.max(0, relY0 - safeMargin),
            w: Math.min(drawW, relW + safeMargin * 2),
            h: Math.min(drawH, relH + safeMargin * 2)
        };

        let { bgR, bgG, bgB, variance } = this.sampleEdgeColor(data, drawW, sampleBox);

        const luminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
        const isDark = luminance < 128;

        const isWhiteIsh = luminance > 200;
        const varianceThreshold = isWhiteIsh ? 6000 : 2500;
        const isComplex = variance > varianceThreshold;

        // 复杂度保护
        if (isComplex) {
            console.log(`[MangaFlow] ⚠️ 背景太复杂 (Var:${Math.round(variance)}, Lum:${Math.round(luminance)}), 跳过擦除`);
            return { isComplex: true, isDark, avgColor: `rgb(${bgR},${bgG},${bgB})`, variance, luminance, maskBox };
        }

        // 4. 像素替换（阈值 & 膨胀）
        const threshold = isWhiteIsh ? 45 : 30;
        const pixelsToErase = new Uint8Array(drawW * drawH);

        for (let i = 0; i < len; i += 4) {
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

        // 膨胀（扩大覆盖范围）
        const expandedMask = new Uint8Array(drawW * drawH);
        for (let y = 1; y < drawH - 1; y++) {
            for (let x = 1; x < drawW - 1; x++) {
                const idx = y * drawW + x;
                if (pixelsToErase[idx]) {
                    expandedMask[idx] = 1;
                    expandedMask[idx - 1] = 1;
                    expandedMask[idx + 1] = 1;
                    expandedMask[idx - drawW] = 1;
                    expandedMask[idx + drawW] = 1;
                }
            }
        }

        // 写回
        for (let i = 0; i < len / 4; i++) {
            if (expandedMask[i]) {
                const idx = i * 4;
                data[idx] = bgR;
                data[idx + 1] = bgG;
                data[idx + 2] = bgB;
            }
        }
        ctx.putImageData(imageData, drawX, drawY);

        return { isComplex, isDark, avgColor: `rgb(${bgR},${bgG},${bgB})`, variance, luminance, maskBox };
    }

    /**
     * 在指定的局部区域采样边缘
     */
    private sampleEdgeColor(
        data: Uint8ClampedArray,
        totalWidth: number,
        box: { x: number; y: number; w: number; h: number }
    ): { bgR: number; bgG: number; bgB: number; variance: number } {
        let rSum = 0, gSum = 0, bSum = 0;
        let count = 0;
        const samples: { r: number; g: number; b: number }[] = [];
        const step = 2;

        const addSample = (x: number, y: number) => {
            const idx = (y * totalWidth + x) * 4;
            if (idx < 0 || idx >= data.length) return;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            rSum += r; gSum += g; bSum += b;
            samples.push({ r, g, b });
            count++;
        };

        // Top & Bottom of box
        for (let x = box.x; x < box.x + box.w; x += step) {
            addSample(x, box.y);
            addSample(x, box.y + box.h - 1);
        }
        // Left & Right of box
        for (let y = box.y; y < box.y + box.h; y += step) {
            addSample(box.x, y);
            addSample(box.x + box.w - 1, y);
        }

        if (count === 0) return { bgR: 255, bgG: 255, bgB: 255, variance: 0 };

        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);

        let varSum = 0;
        for (const s of samples) {
            const dist = Math.pow(s.r - avgR, 2) + Math.pow(s.g - avgG, 2) + Math.pow(s.b - avgB, 2);
            varSum += dist;
        }

        return { bgR: avgR, bgG: avgG, bgB: avgB, variance: varSum / count };
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

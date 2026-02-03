// 漫译 MangaFlow - 轻量文本区域检测（无模型版）
// 基于边缘检测 + 连通域的候选 ROI 提取

import type { BBox } from '../../types';
import { DebugOverlayManager } from './debug-overlay';

export interface DetectOptions {
    maxSize?: number;
    minWidth?: number;
    minHeight?: number;
    minArea?: number;
    maxRegions?: number;
    debug?: boolean;
    debugLabel?: string;
}

export class TextDetector {
    async detect(
        image: HTMLImageElement | HTMLCanvasElement,
        options: DetectOptions = {}
    ): Promise<BBox[]> {
        const maxSize = options.maxSize ?? 900;
        const minWidth = options.minWidth ?? 20;
        const minHeight = options.minHeight ?? 12;
        const minArea = options.minArea ?? 200;
        const maxRegions = options.maxRegions ?? 40;

        const { canvas, scale } = await this.renderToCanvas(image, maxSize);
        const ctx = canvas.getContext('2d')!;

        let imageData: ImageData;
        try {
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
            // 已在 renderToCanvas 处理中处理跨域，这里正常不会失败
            console.warn('[MangaFlow] ROI 检测读取像素失败');
            return [];
        }

        const { width, height, data } = imageData;
        const gray = new Uint8ClampedArray(width * height);

        // 灰度
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[p] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
        }

        // Sobel 边缘
        const mag = new Float32Array(width * height);
        let sum = 0;
        let sumSq = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const g00 = gray[idx - width - 1];
                const g01 = gray[idx - width];
                const g02 = gray[idx - width + 1];
                const g10 = gray[idx - 1];
                const g12 = gray[idx + 1];
                const g20 = gray[idx + width - 1];
                const g21 = gray[idx + width];
                const g22 = gray[idx + width + 1];

                const gx = -g00 - 2 * g10 - g20 + g02 + 2 * g12 + g22;
                const gy = -g00 - 2 * g01 - g02 + g20 + 2 * g21 + g22;
                const m = Math.abs(gx) + Math.abs(gy);
                mag[idx] = m;
                sum += m;
                sumSq += m * m;
            }
        }

        const count = (width - 2) * (height - 2);
        const mean = sum / Math.max(1, count);
        const variance = sumSq / Math.max(1, count) - mean * mean;
        const std = Math.sqrt(Math.max(0, variance));
        const threshold = mean + std * 0.6;

        // 二值化边缘
        const edge = new Uint8Array(width * height);
        for (let i = 0; i < mag.length; i++) {
            if (mag[i] > threshold) edge[i] = 1;
        }

        // 膨胀 2 次
        let dilated = edge;
        for (let iter = 0; iter < 2; iter++) {
            const next = new Uint8Array(width * height);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (dilated[idx]) {
                        next[idx] = 1;
                        next[idx - 1] = 1;
                        next[idx + 1] = 1;
                        next[idx - width] = 1;
                        next[idx + width] = 1;
                    }
                }
            }
            dilated = next;
        }

        // 连通域
        const visited = new Uint8Array(width * height);
        const boxes: BBox[] = [];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (!dilated[idx] || visited[idx]) continue;

                // BFS
                let minX = x, maxX = x, minY = y, maxY = y;
                let pixels = 0;
                const qx: number[] = [x];
                const qy: number[] = [y];
                visited[idx] = 1;

                while (qx.length) {
                    const cx = qx.pop()!;
                    const cy = qy.pop()!;
                    const cidx = cy * width + cx;
                    pixels++;
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = cx + dx;
                            const ny = cy + dy;
                            if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
                            const nidx = ny * width + nx;
                            if (dilated[nidx] && !visited[nidx]) {
                                visited[nidx] = 1;
                                qx.push(nx);
                                qy.push(ny);
                            }
                        }
                    }
                }

                const bw = maxX - minX + 1;
                const bh = maxY - minY + 1;
                const area = bw * bh;
                if (bw < minWidth || bh < minHeight || area < minArea) continue;

                boxes.push({ x0: minX, y0: minY, x1: maxX, y1: maxY });
            }
        }

        // 合并相近框
        const merged = this.mergeBoxes(boxes);

        // 按面积排序，取前 N 个
        const sorted = merged.sort((a, b) => {
            const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
            const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
            return areaB - areaA;
        }).slice(0, maxRegions);

        // 放大并映射回原图尺寸
        const scaleBack = scale;
        const expanded = sorted.map((b) => this.expandBox({
            x0: Math.round(b.x0 * scaleBack),
            y0: Math.round(b.y0 * scaleBack),
            x1: Math.round(b.x1 * scaleBack),
            y1: Math.round(b.y1 * scaleBack),
        }, scaleBack));

        if (options.debug) {
            this.drawDebugBoxes(image, expanded, options.debugLabel || 'ROI');
        }

        return expanded;
    }

    // 合并相近/重叠的框
    private mergeBoxes(boxes: BBox[]): BBox[] {
        const merged: BBox[] = [];

        for (const box of boxes) {
            let mergedToExisting = false;
            for (const m of merged) {
                if (this.shouldMerge(m, box)) {
                    m.x0 = Math.min(m.x0, box.x0);
                    m.y0 = Math.min(m.y0, box.y0);
                    m.x1 = Math.max(m.x1, box.x1);
                    m.y1 = Math.max(m.y1, box.y1);
                    mergedToExisting = true;
                    break;
                }
            }
            if (!mergedToExisting) merged.push({ ...box });
        }

        return merged;
    }

    private shouldMerge(a: BBox, b: BBox): boolean {
        const ax = a.x1 - a.x0;
        const ay = a.y1 - a.y0;
        const bx = b.x1 - b.x0;
        const by = b.y1 - b.y0;

        const horizGap = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
        const vertGap = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));

        const maxH = Math.max(ay, by);
        const maxW = Math.max(ax, bx);

        return horizGap < maxW * 0.35 && vertGap < maxH * 0.6;
    }

    private expandBox(box: BBox, scale: number): BBox {
        const pad = Math.max(4, Math.round(6 * (scale / 1)));
        return {
            x0: Math.max(0, box.x0 - pad),
            y0: Math.max(0, box.y0 - pad),
            x1: box.x1 + pad,
            y1: box.y1 + pad,
        };
    }

    private async renderToCanvas(
        image: HTMLImageElement | HTMLCanvasElement,
        maxSize: number
    ): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
        const width = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
        const height = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
        const maxDim = Math.max(width, height);
        const scale = maxDim > maxSize ? maxDim / maxSize : 1;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width / scale);
        canvas.height = Math.round(height / scale);
        const ctx = canvas.getContext('2d')!;

        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        // 检测跨域污染
        try {
            ctx.getImageData(0, 0, 1, 1);
            return { canvas, scale };
        } catch {
            // 跨域：通过 SW 拉取 base64 再绘制
            if (image instanceof HTMLImageElement) {
                const base64 = await this.fetchImageViaProxy(image.src);
                const proxyImg = await this.loadImageFromBase64(base64);
                canvas.width = Math.round(proxyImg.naturalWidth / scale);
                canvas.height = Math.round(proxyImg.naturalHeight / scale);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(proxyImg, 0, 0, canvas.width, canvas.height);
            }
            return { canvas, scale };
        }
    }

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

    private drawDebugBoxes(
        image: HTMLImageElement | HTMLCanvasElement,
        boxes: BBox[],
        labelPrefix: string
    ): void {
        DebugOverlayManager.getInstance().setRoiBoxes(image, boxes, labelPrefix);
    }

    clearDebugBoxes(): void {
        DebugOverlayManager.getInstance().clearRoiBoxes();
    }
}

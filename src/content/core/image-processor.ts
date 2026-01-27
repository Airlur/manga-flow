// 漫译 MangaFlow - 图像处理模块
// 背景复杂度分析 + 四级降级修复 + 跨域图片代理

import type { TextBlock, BBox } from '../../types';

export class ImageProcessor {
    // 处理图片，修复文字区域背景
    async processImage(
        img: HTMLImageElement,
        blocks: TextBlock[]
    ): Promise<HTMLCanvasElement> {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;

        // 尝试直接绘制，如果失败则通过代理获取
        try {
            ctx.drawImage(img, 0, 0);
            // 测试是否可以读取像素数据（跨域图片会在这里报错）
            ctx.getImageData(0, 0, 1, 1);
        } catch (error) {
            console.log('[MangaFlow] 检测到跨域图片，使用代理获取:', img.src);
            // 通过 Service Worker 代理获取图片
            const base64Image = await this.fetchImageViaProxy(img.src);
            const proxyImg = await this.loadImageFromBase64(base64Image);
            ctx.drawImage(proxyImg, 0, 0);
        }

        // 对每个文本块进行背景修复
        for (const block of blocks) {
            const complexity = this.analyzeComplexity(ctx, block.bbox);
            this.inpaint(ctx, block.bbox, complexity);
        }

        return canvas;
    }

    // 通过 Service Worker 代理获取图片
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

    // 从 Base64 加载图片
    private loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('加载代理图片失败'));
            img.src = base64;
        });
    }

    // 分析背景复杂度 (0-1)
    analyzeComplexity(ctx: CanvasRenderingContext2D, bbox: BBox): number {
        const width = bbox.x1 - bbox.x0;
        const height = bbox.y1 - bbox.y0;

        if (width <= 0 || height <= 0) return 0;

        // 扩展取样区域（取边缘区域）
        const padding = 3;
        const regions = [
            // 上边缘
            { x: bbox.x0, y: Math.max(0, bbox.y0 - padding), w: width, h: padding },
            // 下边缘
            { x: bbox.x0, y: bbox.y1, w: width, h: padding },
            // 左边缘
            { x: Math.max(0, bbox.x0 - padding), y: bbox.y0, w: padding, h: height },
            // 右边缘
            { x: bbox.x1, y: bbox.y0, w: padding, h: height },
        ];

        let totalVariance = 0;
        let sampleCount = 0;

        for (const region of regions) {
            try {
                const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
                const variance = this.calculateColorVariance(imageData.data);
                totalVariance += variance;
                sampleCount++;
            } catch {
                // 忽略越界错误
            }
        }

        if (sampleCount === 0) return 0.5;

        // 归一化复杂度 (0-1)
        const avgVariance = totalVariance / sampleCount;
        return Math.min(1, avgVariance / 100);
    }

    // 计算颜色方差
    private calculateColorVariance(data: Uint8ClampedArray): number {
        if (data.length < 4) return 0;

        const pixels = data.length / 4;
        let sumR = 0,
            sumG = 0,
            sumB = 0;

        for (let i = 0; i < data.length; i += 4) {
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
        }

        const avgR = sumR / pixels;
        const avgG = sumG / pixels;
        const avgB = sumB / pixels;

        let variance = 0;
        for (let i = 0; i < data.length; i += 4) {
            variance += Math.pow(data[i] - avgR, 2);
            variance += Math.pow(data[i + 1] - avgG, 2);
            variance += Math.pow(data[i + 2] - avgB, 2);
        }

        return Math.sqrt(variance / (pixels * 3));
    }

    // 四级降级修复策略
    inpaint(ctx: CanvasRenderingContext2D, bbox: BBox, complexity: number): void {
        const padding = 4; // 扩展边距
        const x = bbox.x0 - padding;
        const y = bbox.y0 - padding;
        const width = bbox.x1 - bbox.x0 + padding * 2;
        const height = bbox.y1 - bbox.y0 + padding * 2;

        if (complexity < 0.15) {
            // Level 1: 纯色背景 - 直接填充
            const color = this.getDominantColor(ctx, bbox);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
        } else if (complexity < 0.35) {
            // Level 2: 简单渐变 - 模糊填充
            this.blurAndFill(ctx, bbox, x, y, width, height);
        } else if (complexity < 0.6) {
            // Level 3: 中等复杂 - 边缘采样填充
            this.contextAwareFill(ctx, bbox, x, y, width, height);
        } else {
            // Level 4: 复杂背景 - 半透明遮罩
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(x, y, width, height);
            // 添加细边框
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, width, height);
        }
    }

    // 获取主色调
    private getDominantColor(ctx: CanvasRenderingContext2D, bbox: BBox): string {
        // 从边缘采样获取主色
        const samples: number[][] = [];
        const samplePoints = [
            [bbox.x0 - 2, bbox.y0],
            [bbox.x1 + 2, bbox.y0],
            [bbox.x0 - 2, bbox.y1],
            [bbox.x1 + 2, bbox.y1],
        ];

        for (const [x, y] of samplePoints) {
            try {
                const data = ctx.getImageData(x, y, 1, 1).data;
                samples.push([data[0], data[1], data[2]]);
            } catch {
                // 忽略越界
            }
        }

        if (samples.length === 0) {
            return 'rgb(255, 255, 255)';
        }

        // 计算平均颜色
        const avg = samples
            .reduce(
                (acc, s) => [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]],
                [0, 0, 0]
            )
            .map((v) => Math.round(v / samples.length));

        return `rgb(${avg[0]}, ${avg[1]}, ${avg[2]})`;
    }

    // 模糊填充
    private blurAndFill(
        ctx: CanvasRenderingContext2D,
        bbox: BBox,
        x: number,
        y: number,
        width: number,
        height: number
    ): void {
        // 先用主色填充
        const color = this.getDominantColor(ctx, bbox);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);

        // 添加轻微模糊效果（通过多次半透明覆盖模拟）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, width, height);
    }

    // 上下文感知填充
    private contextAwareFill(
        ctx: CanvasRenderingContext2D,
        bbox: BBox,
        x: number,
        y: number,
        width: number,
        height: number
    ): void {
        const bboxWidth = bbox.x1 - bbox.x0;
        // 从上边缘采样渐变
        try {
            const topData = ctx.getImageData(bbox.x0, Math.max(0, bbox.y0 - 5), bboxWidth, 3);
            const bottomData = ctx.getImageData(bbox.x0, bbox.y1 + 2, bboxWidth, 3);

            // 创建垂直渐变
            const gradient = ctx.createLinearGradient(x, y, x, y + height);
            gradient.addColorStop(0, this.getAverageColorFromData(topData.data));
            gradient.addColorStop(1, this.getAverageColorFromData(bottomData.data));

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, width, height);
        } catch {
            // 回退到纯色填充
            const color = this.getDominantColor(ctx, bbox);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
        }
    }

    private getAverageColorFromData(data: Uint8ClampedArray): string {
        const pixels = data.length / 4;
        let r = 0,
            g = 0,
            b = 0;

        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }

        return `rgb(${Math.round(r / pixels)}, ${Math.round(g / pixels)}, ${Math.round(b / pixels)})`;
    }
}

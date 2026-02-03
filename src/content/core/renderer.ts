// 漫译 MangaFlow - 渲染器模块
// 在擦除后的区域渲染翻译文字

import type { TextBlock } from '../../types';
import type { BlockAnalysis } from './image-processor';

export interface RenderOptions {
    fontSize: number;
    fontColor: string;
    fontFamily: string;
    strokeColor?: string;     // 描边颜色，默认白色
    strokeWidth?: number;     // 描边宽度，默认自动
}

export class Renderer {
    /**
     * 渲染译文到 Canvas
     */
    render(
        canvas: HTMLCanvasElement,
        blocks: TextBlock[],
        translations: string[],
        analysis: BlockAnalysis[],
        options: RenderOptions,
        fontSizeOverrides?: number[]
    ): void {
        const ctx = canvas.getContext('2d')!;

        blocks.forEach((block, index) => {
            const translation = translations[index];
            if (!translation || translation.startsWith('[翻译失败')) return;

            const blockStats = analysis[index] || { isComplex: false, isDark: false };
            const { bbox } = block;
            const renderBox = this.getRenderBox(canvas, bbox, blockStats, translation);
            const width = renderBox.x1 - renderBox.x0;
            const height = renderBox.y1 - renderBox.y0;

            // 复杂背景下加半透明遮罩，避免叠字影响可读性


            // 1. 智能决定颜色
            // 策略：确保最高对比度
            // 暗背景 -> 白字黑边
            // 亮背景 -> 黑字白边
            let mainColor = '#000000';
            let strokeColor = '#FFFFFF';

            if (blockStats.isDark) {
                mainColor = '#FFFFFF';
                strokeColor = '#000000';
            } else {
                // 如果是用户自定义了颜色，这里暂时覆盖，因为用户通常不知道背景是黑是白
                // 但为了尊重用户，如果用户明确选了颜色...
                if (options.fontColor && options.fontColor !== '#000000') {
                    mainColor = options.fontColor;
                }
            }

            // 2. 智能计算最佳字号 (Iterative Fit)
            // 目标：让文字尽可能填满框，接近原文大小
            const fontFamily = options.fontFamily || 'Arial, sans-serif';
            const normalizedText = translation.replace(/\s*\n\s*/g, ' ');
            const overrideSize = fontSizeOverrides?.[index];
            const hasOverride = typeof overrideSize === 'number' && overrideSize > 0;
            const singleLine = hasOverride ? true : this.shouldForceSingleLine(normalizedText);
            const fontSize = hasOverride
                ? overrideSize
                : this.calculateBestFitFontSize(ctx, normalizedText, width, height, fontFamily, singleLine);

            // 设置最终样式
            ctx.font = `bold ${fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (blockStats.isComplex && !this.shouldSkipMask(normalizedText)) {
                const baseBox = blockStats.maskBox ?? bbox;
                const baseW = Math.max(1, baseBox.x1 - baseBox.x0);
                const baseH = Math.max(1, baseBox.y1 - baseBox.y0);
                const textWidth = ctx.measureText(normalizedText).width;
                const padX = Math.max(6, fontSize * 0.6);
                const targetW = Math.max(baseW, textWidth + padX * 2);
                const targetH = Math.max(baseH, fontSize * 1.3);
                const centerX = (bbox.x0 + bbox.x1) / 2;
                const centerY = (bbox.y0 + bbox.y1) / 2;
                const x0 = Math.max(0, centerX - targetW / 2);
                const y0 = Math.max(0, centerY - targetH / 2);
                const x1 = Math.min(canvas.width, centerX + targetW / 2);
                const y1 = Math.min(canvas.height, centerY + targetH / 2);

                const alpha = blockStats.isDark ? 0.26 : 0.16;
                const baseColor = blockStats.avgColor || (blockStats.isDark ? 'rgb(0,0,0)' : 'rgb(255,255,255)');
                const rgbaMatch = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                const fillStyle = rgbaMatch
                    ? `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`
                    : (blockStats.isDark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`);
                ctx.fillStyle = fillStyle;
                ctx.fillRect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
            }


            // 再次 wrap 以确保准确 (使用最终字号)
            const lines = singleLine ? [normalizedText] : this.wrapText(ctx, normalizedText, width);
            const lineHeight = fontSize * (singleLine ? 1.05 : 1.15); // 紧凑一点的行高
            const totalHeight = lines.length * lineHeight;

            // 计算起始 Y 坐标（垂直居中）
            const startY = renderBox.y0 + (height - totalHeight) / 2 + lineHeight / 2;
            const centerX = renderBox.x0 + width / 2;

            // 绘制
            lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight;

                // 3. 描边策略
                // 复杂背景(未擦除/拟声词) -> 超强描边 (1.5x)
                // 普通背景 -> 普通描边
                let strokeWidth = Math.max(3, fontSize * 0.15);

                if (blockStats.isComplex) {
                    strokeWidth = Math.max(4, fontSize * 0.25); // 更粗
                    // 拟声词通常也不需要背景擦除，所以需要很强的描边来压住原图
                }

                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.strokeText(line, centerX, y);

                ctx.fillStyle = mainColor;
                ctx.fillText(line, centerX, y);
            });
        });

        console.log(`[MangaFlow] ✅ 渲染完成 (v2 Smart Fit)，共 ${blocks.length} 个文本块`);
    }

    private getRenderBox(
        canvas: HTMLCanvasElement,
        bbox: { x0: number; y0: number; x1: number; y1: number },
        blockStats: BlockAnalysis,
        text: string
    ): { x0: number; y0: number; x1: number; y1: number } {
        let x0 = bbox.x0;
        let y0 = bbox.y0;
        let x1 = bbox.x1;
        let y1 = bbox.y1;

        const isShort = this.shouldForceSingleLine(text);
        if (isShort) {
            const width = x1 - x0;
            const height = y1 - y0;
            const targetW = Math.max(width, height * 2.6);
            const extraW = Math.max(0, (targetW - width) / 2);
            const extraH = Math.max(0, height * 0.2);
            x0 -= extraW;
            x1 += extraW;
            y0 -= extraH;
            y1 += extraH;
        }

        x0 = Math.max(0, x0);
        y0 = Math.max(0, y0);
        x1 = Math.min(canvas.width, x1);
        y1 = Math.min(canvas.height, y1);

        return { x0, y0, x1, y1 };
    }

    private shouldForceSingleLine(text: string): boolean {
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

    private shouldSkipMask(text: string): boolean {
        const trimmed = text.trim();
        if (!trimmed) return true;
        if (/^[\W_]+$/.test(trimmed)) return true;
        if (trimmed.length <= 1) return true;
        return false;
    }

    /**
     * 计算最佳适应字号 (从大到小尝试)
     */
    private calculateBestFitFontSize(
        ctx: CanvasRenderingContext2D,
        text: string,
        maxWidth: number,
        maxHeight: number,
        fontFamily: string,
        singleLine: boolean = false
    ): number {
        // 激进策略：从高度的 90% 开始尝试
        // 上限限制：64px (防止过大)
        // 下限限制：12px
        let startSize = Math.min(maxHeight * (singleLine ? 0.85 : 0.8), 64);
        const minSize = 12;

        // 如果文本很长，预先缩小一下起点
        if (text.length > 10) startSize = Math.min(startSize, maxHeight * (singleLine ? 0.8 : 0.7));
        

        for (let size = startSize; size >= minSize; size -= 2) {
            ctx.font = `bold ${size}px ${fontFamily}`;
            const lines = singleLine ? [text] : this.wrapText(ctx, text, maxWidth);
            const lineHeightFactor = singleLine ? 1.05 : 1.15;
            const totalHeight = lines.length * (size * lineHeightFactor);

            // 核心判断：高度是否容纳？
            const fitsHeight = totalHeight <= maxHeight * (singleLine ? 1.0 : 0.95);
            const fitsWidth = singleLine ? ctx.measureText(text).width <= maxWidth * 0.95 : true;
            if (fitsHeight && fitsWidth) {
                return size;
            }
        }
        return minSize;
    }

    /**
     * 文本换行处理
     */
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
}

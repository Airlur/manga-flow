// 漫译 MangaFlow - 渲染器模块
// 按组渲染译文

import type { RenderGroup } from '../../types';
import type { GroupAnalysis } from './image-processor';

export interface RenderOptions {
    fontSize: number;
    fontScale?: number;
    fontColor: string;
    maskOpacity?: number;
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
        groups: RenderGroup[],
        analysis: GroupAnalysis[],
        options: RenderOptions
    ): void {
        const ctx = canvas.getContext('2d')!;
        const fontFamily = options.fontFamily || 'Arial, sans-serif';

        groups.forEach((group, index) => {
            const translation = (group.text || '').trim();
            if (!translation || translation.startsWith('[翻译失败')) return;

            const stats = analysis[index];
            const renderBox = group.bbox;
            const maskBox = stats?.maskBox ?? group.bbox;
            const width = Math.max(1, renderBox.x1 - renderBox.x0);
            const height = Math.max(1, renderBox.y1 - renderBox.y0);

            const normalizedText = translation.replace(/\s*\n\s*/g, ' ');
            const baseFontSize = this.getBaseFontSize(group, height);
            const scale = options.fontScale ?? 1;
            const minSize = Math.max(11, Math.round(baseFontSize * 0.8));
            const maxSize = Math.min(52, Math.round(baseFontSize * 1.2));
            const scaledBase = Math.max(minSize, Math.min(maxSize, baseFontSize * scale));
            const singleLine = this.isShortLabel(normalizedText);
            const layout = this.layoutText(ctx, normalizedText, width, height, fontFamily, scaledBase, singleLine, minSize, maxSize);

            // 颜色策略
            let mainColor = '#000000';
            let strokeColor = '#FFFFFF';
            if (stats?.isDark) {
                mainColor = '#FFFFFF';
                strokeColor = '#000000';
            } else if (options.fontColor && options.fontColor !== '#000000') {
                mainColor = options.fontColor;
            }

            // 复杂背景遮罩
            if (stats?.renderMode === 'mask' && !this.isShortLabel(normalizedText)) {
                const baseAlpha = options.maskOpacity ?? (stats.isDark ? 0.36 : 0.24);
                const alpha = stats.isDark ? Math.min(0.7, baseAlpha + 0.12) : baseAlpha;
                const fillStyle = stats.isDark
                    ? `rgba(0,0,0,${alpha})`
                    : `rgba(255,255,255,${alpha})`;
                ctx.fillStyle = fillStyle;
                ctx.fillRect(renderBox.x0, renderBox.y0, width, height);
            }

            // 绘制文本
            ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const lineHeight = layout.fontSize * (singleLine ? 1.05 : 1.15);
            const totalHeight = layout.lines.length * lineHeight;
            const startY = renderBox.y0 + (height - totalHeight) / 2 + lineHeight / 2;
            const centerX = renderBox.x0 + width / 2;

            layout.lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight;

                let strokeWidth = Math.max(3, layout.fontSize * 0.15);
                if (stats?.renderMode === 'mask') {
                    strokeWidth = Math.max(4, layout.fontSize * 0.25);
                }
                if (this.isShortLabel(normalizedText)) {
                    strokeWidth = Math.max(3, layout.fontSize * 0.2);
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

        console.log(`[MangaFlow] ✅ 渲染完成 (group render)，共 ${groups.length} 个区域`);
    }

    private getBaseFontSize(group: RenderGroup, boxHeight: number): number {
        if (!group.blocks.length) {
            return Math.max(12, Math.min(boxHeight * 0.7, 56));
        }
        const avgHeight = group.blocks.reduce((sum, b) => sum + (b.bbox.y1 - b.bbox.y0), 0) / group.blocks.length;
        return Math.max(12, Math.min(avgHeight * 0.9, 56));
    }

    private layoutText(
        ctx: CanvasRenderingContext2D,
        text: string,
        maxWidth: number,
        maxHeight: number,
        fontFamily: string,
        baseSize: number,
        singleLine: boolean,
        minSize: number,
        maxSize: number
    ): { lines: string[]; fontSize: number } {
        let size = Math.min(baseSize, maxSize);

        for (; size >= minSize; size -= 2) {
            ctx.font = `bold ${size}px ${fontFamily}`;
            const lines = singleLine ? [text] : this.wrapText(ctx, text, maxWidth);
            const lineHeight = size * (singleLine ? 1.05 : 1.15);
            const totalHeight = lines.length * lineHeight;
            const fitsHeight = totalHeight <= maxHeight * 0.95;
            const fitsWidth = singleLine ? ctx.measureText(text).width <= maxWidth * 0.95 : true;
            if (fitsHeight && fitsWidth) {
                return { lines, fontSize: size };
            }
        }

        ctx.font = `bold ${minSize}px ${fontFamily}`;
        const fallbackLines = singleLine ? [text] : this.wrapText(ctx, text, maxWidth);
        return { lines: fallbackLines, fontSize: minSize };
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
}

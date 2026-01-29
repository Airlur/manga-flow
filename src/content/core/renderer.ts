// 漫译 MangaFlow - 渲染器模块
// 在 Canvas 上渲染翻译后的文字（描边样式）

import type { TextBlock } from '../../types';

interface RenderOptions {
    fontSize: number;
    fontColor: string;
    fontFamily: string;
}

export class Renderer {
    // 渲染译文
    render(
        canvas: HTMLCanvasElement,
        blocks: TextBlock[],
        translations: string[],
        options: RenderOptions
    ): void {
        const ctx = canvas.getContext('2d')!;

        blocks.forEach((block, index) => {
            const translation = translations[index];
            if (!translation) return;

            const { bbox } = block;
            const width = bbox.x1 - bbox.x0;
            const height = bbox.y1 - bbox.y0;

            // 计算合适的字体大小（填满原文区域）
            const fontSize = this.calculateFontSize(translation, width, height);

            // 设置字体样式
            ctx.font = `bold ${fontSize}px ${options.fontFamily}, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 处理多行文本
            const lines = this.wrapText(ctx, translation, width - 8);
            const lineHeight = fontSize * 1.2;
            const totalHeight = lines.length * lineHeight;

            // 计算起始 Y 坐标（垂直居中）
            const startY = bbox.y0 + (height - totalHeight) / 2 + lineHeight / 2;
            const centerX = bbox.x0 + width / 2;

            // 绘制每一行（描边样式）
            lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight;

                // 1. 绘制白色粗描边（背景）
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = Math.max(3, fontSize * 0.15);
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.strokeText(line, centerX, y);

                // 2. 绘制文字主体
                ctx.fillStyle = options.fontColor;
                ctx.fillText(line, centerX, y);
            });
        });
    }

    // 计算合适的字体大小（填满原文区域）
    private calculateFontSize(
        text: string,
        maxWidth: number,
        maxHeight: number
    ): number {
        // 估算行数
        const charsPerLine = Math.max(1, Math.floor(maxWidth / 16));
        const estimatedLines = Math.ceil(text.length / charsPerLine);
        const lineHeight = 1.2;

        // 字体大小 = 区域高度 / (行数 * 行高)
        let fontSize = maxHeight / (estimatedLines * lineHeight);

        // 确保字体不会太大导致溢出宽度
        const maxFontByWidth = maxWidth / Math.min(text.length, charsPerLine) * 1.5;
        fontSize = Math.min(fontSize, maxFontByWidth);

        // 限制在合理范围
        fontSize = Math.max(12, Math.min(fontSize, 48));

        return Math.round(fontSize);
    }

    // 文本换行
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

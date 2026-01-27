// 漫译 MangaFlow - 渲染器模块
// 在 Canvas 上渲染翻译后的文字

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

            // 计算合适的字体大小
            const fontSize = this.calculateFontSize(translation, width, height, options.fontSize);

            // 设置字体样式
            ctx.font = `${fontSize}px ${options.fontFamily}`;
            ctx.fillStyle = options.fontColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 处理多行文本
            const lines = this.wrapText(ctx, translation, width - 8);
            const lineHeight = fontSize * 1.3;
            const totalHeight = lines.length * lineHeight;

            // 计算起始 Y 坐标（垂直居中）
            const startY = bbox.y0 + (height - totalHeight) / 2 + lineHeight / 2;
            const centerX = bbox.x0 + width / 2;

            // 绘制每一行
            lines.forEach((line, lineIndex) => {
                const y = startY + lineIndex * lineHeight;

                // 添加文字阴影（提高可读性）
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                ctx.fillText(line, centerX, y);
            });

            // 重置阴影
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        });
    }

    // 计算合适的字体大小
    private calculateFontSize(
        text: string,
        maxWidth: number,
        maxHeight: number,
        baseFontSize: number
    ): number {
        // 根据区域大小和文本长度调整字体
        const areaFactor = Math.min(maxWidth, maxHeight) / 100;
        const lengthFactor = Math.max(1, 10 / text.length);

        let fontSize = baseFontSize * areaFactor * lengthFactor;

        // 限制范围
        fontSize = Math.max(10, Math.min(fontSize, baseFontSize * 1.5));

        // 确保不超过区域高度
        const maxLines = Math.floor(maxHeight / (fontSize * 1.3));
        if (maxLines < 1) {
            fontSize = maxHeight / 1.3;
        }

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

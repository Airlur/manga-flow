import type { ExportOptions, ExportResult } from '../../types';

export class ImageExporter {
    async exportImage(
        img: HTMLImageElement,
        options: ExportOptions = { format: 'png', quality: 0.9, includeOriginal: false, includeTranslation: true }
    ): Promise<ExportResult> {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return { success: false, error: '无法创建 Canvas 上下文' };
            }

            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = this.canvasToDataURL(canvas, options);
            const blob = this.dataURLToBlob(dataUrl);

            return {
                success: true,
                dataUrl,
                blob,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : '导出失败',
            };
        }
    }

    async exportImages(
        images: HTMLImageElement[],
        options: ExportOptions = { format: 'png', quality: 0.9, includeOriginal: false, includeTranslation: true }
    ): Promise<ExportResult[]> {
        const results: ExportResult[] = [];
        for (const img of images) {
            const result = await this.exportImage(img, options);
            results.push(result);
        }
        return results;
    }

    async downloadImage(
        img: HTMLImageElement,
        filename: string,
        options: ExportOptions = { format: 'png', quality: 0.9, includeOriginal: false, includeTranslation: true }
    ): Promise<boolean> {
        const result = await this.exportImage(img, options);
        if (!result.success || !result.dataUrl) {
            return false;
        }

        return this.downloadDataURL(result.dataUrl, filename, options.format);
    }

    async downloadImages(
        images: HTMLImageElement[],
        baseFilename: string,
        options: ExportOptions = { format: 'png', quality: 0.9, includeOriginal: false, includeTranslation: true }
    ): Promise<boolean[]> {
        const results: boolean[] = [];
        for (let i = 0; i < images.length; i++) {
            const filename = `${baseFilename}_${i + 1}.${options.format}`;
            const success = await this.downloadImage(images[i], filename, options);
            results.push(success);
        }
        return results;
    }

    private canvasToDataURL(canvas: HTMLCanvasElement, options: ExportOptions): string {
        switch (options.format) {
            case 'jpeg':
                return canvas.toDataURL('image/jpeg', options.quality);
            case 'webp':
                return canvas.toDataURL('image/webp', options.quality);
            case 'png':
            default:
                return canvas.toDataURL('image/png');
        }
    }

    private dataURLToBlob(dataUrl: string): Blob {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
        const binary = atob(parts[1]);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        return new Blob([new Uint8Array(array)], { type: mime });
    }

    private downloadDataURL(dataUrl: string, filename: string, format: string): boolean {
        try {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return true;
        } catch (error) {
            console.error('[MangaFlow] 下载失败:', error);
            return false;
        }
    }

    async exportWithChromeDownloads(
        img: HTMLImageElement,
        filename: string,
        options: ExportOptions = { format: 'png', quality: 0.9, includeOriginal: false, includeTranslation: true }
    ): Promise<boolean> {
        const result = await this.exportImage(img, options);
        if (!result.success || !result.dataUrl) {
            return false;
        }

        try {
            const blob = this.dataURLToBlob(result.dataUrl);
            const blobUrl = URL.createObjectURL(blob);

            if (chrome?.downloads) {
                await chrome.downloads.download({
                    url: blobUrl,
                    filename,
                    saveAs: true,
                });
                URL.revokeObjectURL(blobUrl);
                return true;
            } else {
                return this.downloadDataURL(result.dataUrl, filename, options.format);
            }
        } catch (error) {
            console.error('[MangaFlow] Chrome 下载 API 失败:', error);
            return this.downloadDataURL(result.dataUrl, filename, options.format);
        }
    }
}

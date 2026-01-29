// 漫译 MangaFlow - 图像处理模块
// 跨域图片代理处理（移除遮罩策略，改用描边文字渲染）

import type { TextBlock } from '../../types';

export class ImageProcessor {
    // 处理图片，返回可导出的 Canvas
    async processImage(
        img: HTMLImageElement,
        _blocks: TextBlock[]  // 不再用于背景修复
    ): Promise<HTMLCanvasElement> {
        let canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        let ctx = canvas.getContext('2d')!;

        // 先尝试直接绘制
        ctx.drawImage(img, 0, 0);

        // 检测是否跨域（尝试读取像素数据）
        let isTainted = false;
        try {
            ctx.getImageData(0, 0, 1, 1);
        } catch {
            isTainted = true;
        }

        // 如果被污染，重新创建干净的 Canvas
        if (isTainted) {
            console.log('[MangaFlow] 跨域图片，使用代理重绘:', img.src);
            const base64Image = await this.fetchImageViaProxy(img.src);
            const proxyImg = await this.loadImageFromBase64(base64Image);

            // 【关键修复】创建全新的 Canvas，避免污染状态
            canvas = document.createElement('canvas');
            canvas.width = proxyImg.naturalWidth;
            canvas.height = proxyImg.naturalHeight;
            ctx = canvas.getContext('2d')!;
            ctx.drawImage(proxyImg, 0, 0);
        }

        // 【重要】不做任何背景修复，直接返回原图 Canvas
        // 译文渲染改用描边文字，在 Renderer 中实现
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
}

// 漫译 MangaFlow - OCR 引擎模块
// 封装 Tesseract.js 进行文字识别

import Tesseract from 'tesseract.js';
import type { OCRResult, TextBlock } from '../../types';

export class OCREngine {
    private worker: Tesseract.Worker | null = null;
    private initialized = false;
    private currentLang = '';

    // 语言映射
    private langMap: Record<string, string> = {
        ko: 'kor', // 韩语
        ja: 'jpn+jpn_vert', // 日语（含竖排）
        en: 'eng', // 英语
        auto: 'kor+jpn+eng', // 自动检测
    };

    async init(lang: string = 'ko'): Promise<void> {
        const tessLang = this.langMap[lang] || 'kor+jpn+eng';

        // 如果已初始化且语言相同，跳过
        if (this.initialized && this.currentLang === tessLang) {
            return;
        }

        // 销毁旧 worker
        if (this.worker) {
            await this.worker.terminate();
        }

        console.log(`[MangaFlow] 初始化 OCR 引擎，语言: ${tessLang}`);

        this.worker = await Tesseract.createWorker(tessLang, 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`[MangaFlow] OCR 进度: ${Math.round(m.progress * 100)}%`);
                }
            },
        });

        this.currentLang = tessLang;
        this.initialized = true;
    }

    async recognize(image: HTMLImageElement | string): Promise<OCRResult> {
        if (!this.initialized || !this.worker) {
            await this.init();
        }

        const result = await this.worker!.recognize(image);

        // 转换为统一格式
        const blocks: TextBlock[] = [];

        result.data.blocks?.forEach((block) => {
            block.paragraphs?.forEach((para) => {
                para.lines?.forEach((line) => {
                    const text = line.text.trim();
                    if (text) {
                        blocks.push({
                            text,
                            bbox: {
                                x0: line.bbox.x0,
                                y0: line.bbox.y0,
                                x1: line.bbox.x1,
                                y1: line.bbox.y1,
                            },
                            confidence: line.confidence / 100,
                        });
                    }
                });
            });
        });

        return {
            text: result.data.text,
            confidence: result.data.confidence / 100,
            blocks,
        };
    }

    async destroy(): Promise<void> {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.initialized = false;
        }
    }
}

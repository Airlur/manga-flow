// 漫译 MangaFlow - 缓存管理模块
// 分离 OCR 缓存和翻译缓存

import localforage from 'localforage';
import type { OCRResult } from '../../types';

// OCR 缓存条目
interface OCRCacheEntry {
    imageHash: string;
    timestamp: number;
    ocrEngine: 'local' | 'cloud' | 'paddle_local';
    ocrResult: OCRResult;
}

// 翻译缓存条目
interface TranslationCacheEntry {
    imageHash: string;
    timestamp: number;
    translateEngine: string;
    translations: Array<{
        original: string;
        translated: string;
    }>;
}

export class CacheManager {
    private ocrStore: LocalForage;
    private translationStore: LocalForage;

    private readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 天
    private readonly MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

    constructor() {
        // OCR 缓存存储
        this.ocrStore = localforage.createInstance({
            name: 'manga-flow',
            storeName: 'ocr-cache',
        });

        // 翻译缓存存储
        this.translationStore = localforage.createInstance({
            name: 'manga-flow',
            storeName: 'translation-cache',
        });

        // 定期清理过期缓存
        this.cleanup();
    }

    // ===== OCR 缓存 =====

    /**
     * 获取 OCR 缓存
     * @param imageSrc 图片 URL
     * @param ocrEngine OCR 引擎类型
     */
    async getOCR(imageSrc: string, ocrEngine: 'local' | 'cloud' | 'paddle_local'): Promise<OCRResult | null> {
        try {
            const hash = await this.getImageHash(imageSrc);
            const key = `${hash}_${ocrEngine}`;
            const entry = await this.ocrStore.getItem<OCRCacheEntry>(key);

            if (!entry) return null;

            // 检查是否过期
            if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
                await this.ocrStore.removeItem(key);
                return null;
            }

            console.log(`[MangaFlow] 📦 OCR 缓存命中 (${ocrEngine})`);
            return entry.ocrResult;
        } catch (error) {
            console.warn('[MangaFlow] OCR 缓存读取失败:', error);
            return null;
        }
    }

    /**
     * 设置 OCR 缓存
     */
    async setOCR(imageSrc: string, ocrEngine: 'local' | 'cloud' | 'paddle_local', ocrResult: OCRResult): Promise<void> {
        try {
            const hash = await this.getImageHash(imageSrc);
            const key = `${hash}_${ocrEngine}`;
            const entry: OCRCacheEntry = {
                imageHash: hash,
                timestamp: Date.now(),
                ocrEngine,
                ocrResult,
            };
            await this.ocrStore.setItem(key, entry);
        } catch (error) {
            console.warn('[MangaFlow] OCR 缓存写入失败:', error);
        }
    }

    // ===== 翻译缓存 =====

    /**
     * 获取翻译缓存
     * @param imageSrc 图片 URL
     * @param translateEngine 翻译引擎
     */
    async getTranslation(
        imageSrc: string,
        translateEngine: string
    ): Promise<TranslationCacheEntry['translations'] | null> {
        try {
            const hash = await this.getImageHash(imageSrc);
            const key = `${hash}_${translateEngine}`;
            const entry = await this.translationStore.getItem<TranslationCacheEntry>(key);

            if (!entry) return null;

            // 检查是否过期
            if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
                await this.translationStore.removeItem(key);
                return null;
            }

            console.log(`[MangaFlow] 📦 翻译缓存命中 (${translateEngine})`);
            return entry.translations;
        } catch (error) {
            console.warn('[MangaFlow] 翻译缓存读取失败:', error);
            return null;
        }
    }

    /**
     * 设置翻译缓存
     */
    async setTranslation(
        imageSrc: string,
        translateEngine: string,
        translations: TranslationCacheEntry['translations']
    ): Promise<void> {
        try {
            const hash = await this.getImageHash(imageSrc);
            const key = `${hash}_${translateEngine}`;
            const entry: TranslationCacheEntry = {
                imageHash: hash,
                timestamp: Date.now(),
                translateEngine,
                translations,
            };
            await this.translationStore.setItem(key, entry);
        } catch (error) {
            console.warn('[MangaFlow] 翻译缓存写入失败:', error);
        }
    }

    // ===== 通用方法 =====

    /**
     * 计算图片哈希
     */
    async getImageHash(imageSrc: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(imageSrc);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8ClampedArray(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    /**
     * 清理过期缓存
     */
    async cleanup(): Promise<void> {
        try {
            const now = Date.now();
            let removedCount = 0;

            // 清理 OCR 缓存
            const ocrKeysToRemove: string[] = [];
            await this.ocrStore.iterate<OCRCacheEntry, void>((value, key) => {
                if (now - value.timestamp > this.CACHE_EXPIRY) {
                    ocrKeysToRemove.push(key);
                }
            });
            for (const key of ocrKeysToRemove) {
                await this.ocrStore.removeItem(key);
            }
            removedCount += ocrKeysToRemove.length;

            // 清理翻译缓存
            const transKeysToRemove: string[] = [];
            await this.translationStore.iterate<TranslationCacheEntry, void>((value, key) => {
                if (now - value.timestamp > this.CACHE_EXPIRY) {
                    transKeysToRemove.push(key);
                }
            });
            for (const key of transKeysToRemove) {
                await this.translationStore.removeItem(key);
            }
            removedCount += transKeysToRemove.length;

            if (removedCount > 0) {
                console.log(`[MangaFlow] 清理了 ${removedCount} 条过期缓存`);
            }
        } catch (error) {
            console.warn('[MangaFlow] 缓存清理失败:', error);
        }
    }

    /**
     * 清空所有缓存
     */
    async clear(): Promise<void> {
        await this.ocrStore.clear();
        await this.translationStore.clear();
        console.log('[MangaFlow] 缓存已清空');
    }

    /**
     * 获取缓存大小（估算）
     */
    async getSize(): Promise<{ ocr: number; translation: number; total: number }> {
        let ocrSize = 0;
        let transSize = 0;

        await this.ocrStore.iterate<OCRCacheEntry, void>((value) => {
            ocrSize += JSON.stringify(value).length;
        });

        await this.translationStore.iterate<TranslationCacheEntry, void>((value) => {
            transSize += JSON.stringify(value).length;
        });

        return {
            ocr: ocrSize,
            translation: transSize,
            total: ocrSize + transSize,
        };
    }
}

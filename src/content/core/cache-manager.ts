// 漫译 MangaFlow - 缓存管理模块
// 使用 LocalForage 管理翻译结果缓存

import localforage from 'localforage';
import type { CacheEntry } from '../../types';

export class CacheManager {
    private store: LocalForage;
    private readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 天
    private readonly MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB

    constructor() {
        this.store = localforage.createInstance({
            name: 'manga-flow',
            storeName: 'translations',
        });

        // 定期清理过期缓存
        this.cleanup();
    }

    // 获取缓存
    async get(imageSrc: string): Promise<CacheEntry | null> {
        try {
            const hash = await this.getImageHash(imageSrc);
            const entry = await this.store.getItem<CacheEntry>(hash);

            if (!entry) return null;

            // 检查是否过期
            if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
                await this.store.removeItem(hash);
                return null;
            }

            return entry;
        } catch (error) {
            console.warn('[MangaFlow] 缓存读取失败:', error);
            return null;
        }
    }

    // 设置缓存
    async set(imageSrc: string, entry: CacheEntry): Promise<void> {
        try {
            const hash = await this.getImageHash(imageSrc);
            await this.store.setItem(hash, entry);
        } catch (error) {
            console.warn('[MangaFlow] 缓存写入失败:', error);
        }
    }

    // 计算图片哈希
    async getImageHash(imageSrc: string): Promise<string> {
        // 简化实现：使用 URL 的 hash
        const encoder = new TextEncoder();
        const data = encoder.encode(imageSrc);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8ClampedArray(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    // 清理过期缓存
    async cleanup(): Promise<void> {
        try {
            const now = Date.now();
            const keysToRemove: string[] = [];

            await this.store.iterate<CacheEntry, void>((value, key) => {
                if (now - value.timestamp > this.CACHE_EXPIRY) {
                    keysToRemove.push(key);
                }
            });

            for (const key of keysToRemove) {
                await this.store.removeItem(key);
            }

            if (keysToRemove.length > 0) {
                console.log(`[MangaFlow] 清理了 ${keysToRemove.length} 条过期缓存`);
            }
        } catch (error) {
            console.warn('[MangaFlow] 缓存清理失败:', error);
        }
    }

    // 清空所有缓存
    async clear(): Promise<void> {
        await this.store.clear();
        console.log('[MangaFlow] 缓存已清空');
    }

    // 获取缓存大小
    async getSize(): Promise<number> {
        let totalSize = 0;

        await this.store.iterate<CacheEntry, void>((value) => {
            // 估算大小
            totalSize += JSON.stringify(value).length;
        });

        return totalSize;
    }
}

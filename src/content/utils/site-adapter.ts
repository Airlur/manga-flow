// 漫译 MangaFlow - 站点适配工具
// 根据当前站点返回对应配置

import type { SiteConfig } from '../../types';

// 站点适配配置
const siteConfigs: Record<string, SiteConfig> = {
    'comix.to': {
        name: 'Comix.to',
        // 精确匹配正文图片，排除封面区域
        imageSelector: '.reading-content img, #readerarea img, .chapter-content img, .chapter-images img',
        containerSelector: '.reading-content, #readerarea, .chapter-content',
        lazyLoadAttr: 'data-src',
        language: 'ko',
        features: {
            lazyLoad: true,
            infiniteScroll: true,
        },
    },
    'toongod.org': {
        name: 'ToonGod',
        imageSelector: '.wp-manga-chapter-img, img.ts-main-image, .reading-content img',
        containerSelector: '.reading-content',
        lazyLoadAttr: 'data-src',
        language: 'en',
        features: {
            lazyLoad: true,
            infiniteScroll: false,
        },
    },
    'omegascans.org': {
        name: 'OmegaScans',
        imageSelector: 'img[class*="chapter"], .container img, main img, .reader-area img',
        containerSelector: '.container, main, .reader-area',
        lazyLoadAttr: 'data-src',
        language: 'en',
        features: {
            lazyLoad: true,
            infiniteScroll: true,
        },
    },
    'manhwaread.com': {
        name: 'ManhwaRead',
        imageSelector: '.page-break img, .reading-content img, .chapter-content img',
        containerSelector: '.reading-content, .chapter-content',
        lazyLoadAttr: 'data-src',
        language: 'en',
        features: {
            lazyLoad: true,
            infiniteScroll: false,
        },
    },
    // 可扩展更多站点...
};

// 默认通用配置（适用于未适配的站点）
const defaultConfig: SiteConfig = {
    name: 'Default',
    // 通用选择器，尝试匹配常见的阅读容器
    imageSelector: '.reading-content img, .chapter-content img, .reader-area img, article img, main img, img',
    containerSelector: '.reading-content, .chapter-content, .reader-area, article, main',
    lazyLoadAttr: 'data-src',
    language: 'auto',
    features: {
        lazyLoad: true,
        infiniteScroll: false,
    },
};

// 根据 URL 获取站点配置
export function getSiteConfig(url: string): SiteConfig {
    try {
        const hostname = new URL(url).hostname;

        for (const [domain, config] of Object.entries(siteConfigs)) {
            if (hostname.includes(domain)) {
                console.log(`[MangaFlow] 站点适配: ${config.name}`);
                return config;
            }
        }
    } catch (error) {
        console.warn('[MangaFlow] URL 解析失败:', error);
    }

    console.log('[MangaFlow] 使用默认配置（通用模式）');
    return defaultConfig;
}

// 获取所有支持的站点
export function getSupportedSites(): string[] {
    return Object.keys(siteConfigs);
}

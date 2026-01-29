// 漫译 MangaFlow - 图片检测模块
// 检测页面中的漫画图片，支持懒加载

import { getSiteConfig } from '../utils/site-adapter';
import type { SiteConfig } from '../../types';

export class ImageDetector {
    private observer: MutationObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private processedImages: Set<string> = new Set();
    private siteConfig: SiteConfig;
    private onNewImage: ((img: HTMLImageElement) => void) | null = null;

    // 排除关键词（封面、缩略图、头像等）
    private static readonly EXCLUDE_KEYWORDS = [
        'cover', 'thumbnail', 'avatar', 'logo', 'banner', 'poster', 'icon',
        'button', 'badge', 'emoji', 'sticker', 'ad', 'sponsor', 'favicon'
    ];

    // 常见的懒加载属性
    private static readonly LAZY_ATTRS = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'lazysrc'];

    constructor() {
        this.siteConfig = getSiteConfig(window.location.href);
        this.init();
    }

    private init(): void {
        this.setupMutationObserver();
        this.setupIntersectionObserver();
    }

    // 获取图片的真实 URL（处理懒加载）
    private getImageRealSrc(img: HTMLImageElement): string {
        // 优先检查懒加载属性
        for (const attr of ImageDetector.LAZY_ATTRS) {
            const lazySrc = img.getAttribute(attr);
            if (lazySrc && this.isValidImageUrl(lazySrc)) {
                return lazySrc;
            }
        }
        // 其次使用站点配置的懒加载属性
        if (this.siteConfig.lazyLoadAttr) {
            const lazySrc = img.getAttribute(this.siteConfig.lazyLoadAttr);
            if (lazySrc && this.isValidImageUrl(lazySrc)) {
                return lazySrc;
            }
        }
        // 最后使用 src
        return img.src || '';
    }

    // 检查是否为有效的图片 URL
    private isValidImageUrl(url: string): boolean {
        if (!url) return false;
        // 排除占位图
        const placeholders = ['placeholder', 'loading', 'blank', 'data:image/gif', 'data:image/png;base64,iVBOR'];
        return !placeholders.some(p => url.toLowerCase().includes(p));
    }

    // 设置 DOM 变化监听器（懒加载图片检测）
    private setupMutationObserver(): void {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        if (node.tagName === 'IMG') {
                            this.checkImage(node as HTMLImageElement);
                        }
                        node.querySelectorAll?.('img')?.forEach((img) => {
                            this.checkImage(img as HTMLImageElement);
                        });
                    }
                });

                // 检查属性变化（懒加载 src 变化）
                if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
                    this.checkImage(mutation.target);
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', ...ImageDetector.LAZY_ATTRS, this.siteConfig.lazyLoadAttr].filter(Boolean) as string[],
        });
    }

    // 设置视口交叉监听器
    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
                        const src = this.getImageRealSrc(entry.target);
                        if (src && !this.processedImages.has(src)) {
                            console.log('[MangaFlow] 图片进入视口:', src.substring(src.lastIndexOf('/') + 1));
                            if (this.onNewImage) {
                                this.onNewImage(entry.target);
                            }
                        }
                    }
                });
            },
            { rootMargin: '500px' }  // 提前 500px 开始检测
        );
    }

    // 检查单个图片是否为漫画图片
    private checkImage(img: HTMLImageElement): void {
        const src = this.getImageRealSrc(img);
        if (!src || this.processedImages.has(src)) return;

        // 等待图片加载完成（针对已有 src 的图片）
        if (img.src && !img.complete) {
            img.addEventListener('load', () => this.checkImage(img), { once: true });
            return;
        }

        if (this.isComicImage(img)) {
            console.log('[MangaFlow] ✓ 识别为漫画图片:', src.substring(src.lastIndexOf('/') + 1));
            this.processedImages.add(src);
            this.intersectionObserver?.observe(img);
        }
    }

    // 判断是否为漫画图片
    isComicImage(img: HTMLImageElement): boolean {
        const src = this.getImageRealSrc(img);
        if (!src) return false;

        const srcLower = src.toLowerCase();
        const className = (img.className || '').toLowerCase();
        const id = (img.id || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        const combined = srcLower + className + id + alt;

        // 1. 排除封面/缩略图/广告等
        if (ImageDetector.EXCLUDE_KEYWORDS.some(kw => combined.includes(kw))) {
            return false;
        }

        // 2. 检查是否是漫画图片 URL 模式（序号命名）
        const isSequentialImage = /\/\d{1,3}\.(webp|jpg|jpeg|png|gif)$/i.test(src) ||  // 06.webp
            /\/[a-z]+_\d{2,3}\.(jpg|jpeg|png|webp|gif)$/i.test(src) ||                  // mr_004.jpg
            /\/\d+\/\d+\/[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(src);                   // /chapter/page/file.jpg

        // 3. 尺寸检查（使用 naturalWidth 或显示尺寸）
        const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '0');
        const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '0');

        // 如果尺寸已知，进行检查
        if (width > 0 && height > 0) {
            if (width < 200 || height < 200) return false;
        }

        // 4. 检查是否在正文容器内
        if (this.siteConfig.containerSelector) {
            const container = document.querySelector(this.siteConfig.containerSelector);
            if (container && !container.contains(img)) {
                return false;
            }
        }

        // 5. 检查是否匹配站点配置的选择器
        if (this.siteConfig.imageSelector) {
            const selectors = this.siteConfig.imageSelector.split(',').map(s => s.trim());
            const matchesSelector = selectors.some(selector => {
                try {
                    return img.matches(selector);
                } catch {
                    return false;
                }
            });
            if (matchesSelector) return true;
        }

        // 6. 序号命名的图片优先通过
        if (isSequentialImage) return true;

        // 7. 一般大图通过
        if (width >= 400 && height >= 400) return true;

        return false;
    }

    // 获取当前页面所有漫画图片（用于初始翻译）
    getComicImages(): HTMLImageElement[] {
        const images: HTMLImageElement[] = [];
        const allImages = document.querySelectorAll<HTMLImageElement>('img');

        console.log('[MangaFlow] 扫描页面图片，共', allImages.length, '张');

        allImages.forEach((img) => {
            const src = this.getImageRealSrc(img);
            // 注意：这里不检查 processedImages，因为这是用于初始获取
            // processedImages 只用于懒加载时避免重复处理
            if (src && this.isComicImage(img)) {
                console.log('[MangaFlow] + 添加图片:', src.substring(src.lastIndexOf('/') + 1));
                images.push(img);
                // 标记为已处理，避免懒加载时重复
                this.processedImages.add(src);
            }
        });

        console.log('[MangaFlow] 最终筛选出', images.length, '张漫画图片');
        return images;
    }

    // 设置新图片回调
    setOnNewImage(callback: (img: HTMLImageElement) => void): void {
        this.onNewImage = callback;
    }

    // 销毁
    destroy(): void {
        this.observer?.disconnect();
        this.intersectionObserver?.disconnect();
        this.processedImages.clear();
    }
}

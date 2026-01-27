// 漫译 MangaFlow - 图片检测模块
// 检测页面中的漫画图片，监听懒加载

import { getSiteConfig } from '../utils/site-adapter';
import type { SiteConfig } from '../../types';

export class ImageDetector {
    private observer: MutationObserver | null = null;
    private intersectionObserver: IntersectionObserver | null = null;
    private processedImages: Set<string> = new Set();
    private siteConfig: SiteConfig;
    private onNewImage: ((img: HTMLImageElement) => void) | null = null;

    constructor() {
        this.siteConfig = getSiteConfig(window.location.href);
        this.init();
    }

    private init(): void {
        this.setupMutationObserver();
        this.setupIntersectionObserver();
    }

    // 设置 DOM 变化监听器（懒加载图片检测）
    private setupMutationObserver(): void {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        // 检查新添加的图片
                        if (node.tagName === 'IMG') {
                            this.checkImage(node as HTMLImageElement);
                        }
                        // 检查新添加的元素内部的图片
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
            attributeFilter: ['src', this.siteConfig.lazyLoadAttr],
        });
    }

    // 设置视口交叉监听器
    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
                        // 图片进入视口，可以处理
                        if (this.onNewImage) {
                            this.onNewImage(entry.target);
                        }
                    }
                });
            },
            { rootMargin: '200px' } // 提前 200px 开始检测
        );
    }

    // 检查单个图片是否为漫画图片
    private checkImage(img: HTMLImageElement): void {
        const src = img.src || img.getAttribute(this.siteConfig.lazyLoadAttr) || '';
        if (!src || this.processedImages.has(src)) return;

        // 等待图片加载完成
        if (!img.complete) {
            img.addEventListener('load', () => this.checkImage(img), { once: true });
            return;
        }

        if (this.isComicImage(img)) {
            this.processedImages.add(src);
            this.intersectionObserver?.observe(img);
        }
    }

    // 判断是否为漫画图片
    isComicImage(img: HTMLImageElement): boolean {
        // 最小尺寸要求
        const minWidth = 300;
        const minHeight = 300;

        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (width < minWidth || height < minHeight) return false;

        // 检查是否匹配站点配置的选择器
        if (this.siteConfig.imageSelector) {
            const selectors = this.siteConfig.imageSelector.split(',').map((s) => s.trim());
            const matchesSelector = selectors.some((selector) => {
                try {
                    return img.matches(selector);
                } catch {
                    return false;
                }
            });
            if (matchesSelector) return true;
        }

        // 通用判断：宽高比和尺寸
        const aspectRatio = width / height;
        // 漫画图片通常比较长（竖向）或接近正方形
        if (aspectRatio < 0.3 || aspectRatio > 3) return false;

        // 尺寸合理
        if (width >= minWidth && height >= minHeight) return true;

        return false;
    }

    // 获取当前页面所有漫画图片
    getComicImages(): HTMLImageElement[] {
        const images: HTMLImageElement[] = [];
        const selector = this.siteConfig.imageSelector || 'img';

        document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
            if (this.isComicImage(img)) {
                images.push(img);
            }
        });

        // 如果配置选择器没匹配到，尝试通用选择
        if (images.length === 0) {
            document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
                if (this.isComicImage(img)) {
                    images.push(img);
                }
            });
        }

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

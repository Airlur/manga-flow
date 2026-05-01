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
    private onComicImageDetected: ((img: HTMLImageElement) => void) | null = null;
    private debugMode: boolean = true;

    // 排除关键词（封面、缩略图、头像等）
    private static readonly EXCLUDE_KEYWORDS = [
        'cover', 'thumbnail', 'avatar', 'logo', 'banner', 'poster', 'icon',
        'button', 'badge', 'emoji', 'sticker', 'ad', 'sponsor', 'favicon',
        'avatar', 'thumb', 'small', 'icon'
    ];

    // 常见的懒加载属性
    private static readonly LAZY_ATTRS = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'lazysrc', 'data-url', 'data-source', 'data-image'];

    constructor() {
        this.siteConfig = getSiteConfig(window.location.href);
        this.logInfo('初始化 ImageDetector');
        this.logDebug('站点配置:', JSON.stringify(this.siteConfig, null, 2));
        this.init();
    }

    private logInfo(message: string, ...args: unknown[]): void {
        if (this.debugMode) {
            console.log(`[MangaFlow][Info] ${message}`, ...args);
        }
    }

    private logDebug(message: string, ...args: unknown[]): void {
        if (this.debugMode) {
            console.debug(`[MangaFlow][Debug] ${message}`, ...args);
        }
    }

    private logWarn(message: string, ...args: unknown[]): void {
        console.warn(`[MangaFlow][Warn] ${message}`, ...args);
    }

    private logError(message: string, ...args: unknown[]): void {
        console.error(`[MangaFlow][Error] ${message}`, ...args);
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
            if (lazySrc) {
                const resolvedUrl = this.resolveUrl(lazySrc);
                if (this.isValidImageUrl(resolvedUrl)) {
                    this.logDebug(`使用懒加载属性 ${attr}: ${resolvedUrl}`);
                    return resolvedUrl;
                }
            }
        }
        // 其次使用站点配置的懒加载属性
        if (this.siteConfig.lazyLoadAttr) {
            const lazySrc = img.getAttribute(this.siteConfig.lazyLoadAttr);
            if (lazySrc) {
                const resolvedUrl = this.resolveUrl(lazySrc);
                if (this.isValidImageUrl(resolvedUrl)) {
                    this.logDebug(`使用站点配置懒加载属性 ${this.siteConfig.lazyLoadAttr}: ${resolvedUrl}`);
                    return resolvedUrl;
                }
            }
        }
        // 最后使用 src
        if (img.src) {
            const resolvedUrl = this.resolveUrl(img.src);
            if (this.isValidImageUrl(resolvedUrl)) {
                return resolvedUrl;
            }
        }
        return '';
    }

    // 解析 URL（处理相对路径）
    private resolveUrl(url: string): string {
        if (!url) return '';
        
        // 如果已经是完整 URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
            return url;
        }
        
        // 处理以 // 开头的 URL（协议相对 URL）
        if (url.startsWith('//')) {
            return window.location.protocol + url;
        }
        
        // 处理相对路径
        try {
            return new URL(url, window.location.origin).href;
        } catch {
            // 如果解析失败，尝试用当前页面的完整 URL 作为 base
            try {
                return new URL(url, window.location.href).href;
            } catch {
                return url;
            }
        }
    }

    // 检查是否为有效的图片 URL
    private isValidImageUrl(url: string): boolean {
        if (!url) {
            this.logDebug('URL 为空');
            return false;
        }
        
        // 排除占位图
        const placeholders = [
            'placeholder', 'loading', 'blank', 
            'data:image/gif', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
            'about:blank', 'javascript:'
        ];
        
        const urlLower = url.toLowerCase();
        for (const p of placeholders) {
            if (urlLower.includes(p)) {
                this.logDebug(`URL 包含占位关键词: ${p}`);
                return false;
            }
        }
        
        // 检查是否是图片 URL
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const hasValidExt = validExtensions.some(ext => urlLower.includes(ext));
        
        // 或者是 data URL
        const isDataUrl = urlLower.startsWith('data:image/');
        
        if (!hasValidExt && !isDataUrl) {
            this.logDebug(`URL 不是有效的图片格式: ${url}`);
            return false;
        }
        
        return true;
    }

    // 设置 DOM 变化监听器（懒加载图片检测）
    private setupMutationObserver(): void {
        this.logDebug('设置 MutationObserver');
        this.observer = new MutationObserver((mutations) => {
            let newImagesCount = 0;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        if (node.tagName === 'IMG') {
                            this.checkImage(node as HTMLImageElement);
                            newImagesCount++;
                        }
                        node.querySelectorAll?.('img')?.forEach((img) => {
                            this.checkImage(img as HTMLImageElement);
                            newImagesCount++;
                        });
                    }
                });

                // 检查属性变化（懒加载 src 变化）
                if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
                    this.logDebug(`图片属性变化: ${mutation.attributeName}`);
                    this.checkImage(mutation.target);
                }
            });
            if (newImagesCount > 0) {
                this.logDebug(`MutationObserver 检测到 ${newImagesCount} 个新图片节点`);
            }
        });

        const attrFilter = ['src', ...ImageDetector.LAZY_ATTRS, this.siteConfig.lazyLoadAttr].filter(Boolean) as string[];
        this.logDebug(`监听属性变化: ${attrFilter.join(', ')}`);

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: attrFilter,
        });
    }

    // 设置视口交叉监听器
    private setupIntersectionObserver(): void {
        this.logDebug('设置 IntersectionObserver (rootMargin: 500px)');
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
                        const src = this.getImageRealSrc(entry.target);
                        if (src && !this.processedImages.has(src)) {
                            this.logInfo('图片进入视口:', src.substring(src.lastIndexOf('/') + 1));
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
            this.logDebug(`图片未加载完成，等待 load 事件: ${src.substring(src.lastIndexOf('/') + 1)}`);
            img.addEventListener('load', () => {
                this.logDebug(`图片加载完成，重新检查: ${src.substring(src.lastIndexOf('/') + 1)}`);
                this.checkImage(img);
            }, { once: true });
            return;
        }

        if (this.isComicImage(img)) {
            this.logInfo('✓ 识别为漫画图片:', src.substring(src.lastIndexOf('/') + 1));
            this.processedImages.add(src);
            this.onComicImageDetected?.(img);
            this.intersectionObserver?.observe(img);
        }
    }

    // 判断是否为漫画图片 - 带详细日志
    isComicImage(img: HTMLImageElement): boolean {
        const src = this.getImageRealSrc(img);
        if (!src) {
            this.logDebug('❌ isComicImage: 无有效 URL');
            return false;
        }

        const srcLower = src.toLowerCase();
        const className = (img.className || '').toLowerCase();
        const id = (img.id || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        const combined = srcLower + className + id + alt;

        const filename = src.substring(src.lastIndexOf('/') + 1);
        this.logDebug(`\n========== 检查图片: ${filename} ==========`);
        this.logDebug(`src: ${src}`);
        this.logDebug(`className: ${className}`);
        this.logDebug(`id: ${id}`);
        this.logDebug(`alt: ${alt}`);

        // 1. 排除封面/缩略图/广告等
        const matchedExcludeKeyword = ImageDetector.EXCLUDE_KEYWORDS.find(kw => combined.includes(kw));
        if (matchedExcludeKeyword) {
            this.logDebug(`❌ 1. 排除检查: 匹配关键词 "${matchedExcludeKeyword}"，不识别为漫画图片`);
            return false;
        }
        this.logDebug('✓ 1. 排除检查: 通过');

        // 2. 检查是否是漫画图片 URL 模式（序号命名）
        const isSequentialImage = /\/\d{1,3}\.(webp|jpg|jpeg|png|gif)$/i.test(src) ||  // 06.webp
            /\/[a-z]+_\d{2,3}\.(jpg|jpeg|png|webp|gif)$/i.test(src) ||                  // mr_004.jpg
            /\/\d+\/\d+\/[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(src);                   // /chapter/page/file.jpg

        if (isSequentialImage) {
            this.logDebug('✓ 2. URL 模式检查: 匹配序号命名模式');
        } else {
            this.logDebug('⚠ 2. URL 模式检查: 不匹配序号命名模式，继续检查其他条件');
        }

        // 3. 尺寸检查（使用 naturalWidth 或显示尺寸）
        const naturalWidth = img.naturalWidth || 0;
        const naturalHeight = img.naturalHeight || 0;
        const displayWidth = img.width || parseInt(img.getAttribute('width') || '0');
        const displayHeight = img.height || parseInt(img.getAttribute('height') || '0');

        const width = naturalWidth > 0 ? naturalWidth : displayWidth;
        const height = naturalHeight > 0 ? naturalHeight : displayHeight;

        this.logDebug(`\n3. 尺寸检查:`);
        this.logDebug(`   naturalWidth: ${naturalWidth}, naturalHeight: ${naturalHeight}`);
        this.logDebug(`   displayWidth: ${displayWidth}, displayHeight: ${displayHeight}`);
        this.logDebug(`   使用尺寸: width=${width}, height=${height}`);

        // 如果尺寸已知，进行检查
        let sizePass = true;
        if (width > 0 && height > 0) {
            if (width < 200 || height < 200) {
                this.logDebug(`❌ 尺寸检查失败: width=${width} < 200 或 height=${height} < 200`);
                sizePass = false;
            } else {
                this.logDebug('✓ 尺寸检查: 通过 (>= 200x200)');
            }
        } else {
            this.logWarn('⚠ 尺寸未知 (图片可能未加载)，跳过尺寸检查');
        }

        // 4. 检查是否在正文容器内
        let containerCheck = true;
        if (this.siteConfig.containerSelector) {
            const container = document.querySelector(this.siteConfig.containerSelector);
            this.logDebug(`\n4. 容器检查:`);
            this.logDebug(`   容器选择器: ${this.siteConfig.containerSelector}`);
            this.logDebug(`   找到容器: ${container ? '是' : '否'}`);
            
            if (container && !container.contains(img)) {
                this.logDebug('❌ 容器检查: 图片不在指定容器内');
                containerCheck = false;
            } else if (container) {
                this.logDebug('✓ 容器检查: 图片在指定容器内');
            } else {
                this.logDebug('⚠ 容器检查: 未找到容器，跳过检查');
            }
        } else {
            this.logDebug('\n4. 容器检查: 无容器选择器，跳过');
        }

        // 5. 检查是否匹配站点配置的选择器
        let selectorMatch = false;
        if (this.siteConfig.imageSelector) {
            this.logDebug(`\n5. 选择器匹配检查:`);
            this.logDebug(`   图片选择器: ${this.siteConfig.imageSelector}`);
            
            const selectors = this.siteConfig.imageSelector.split(',').map(s => s.trim());
            for (const selector of selectors) {
                try {
                    if (img.matches(selector)) {
                        this.logDebug(`✓ 选择器匹配: ${selector}`);
                        selectorMatch = true;
                        break;
                    }
                } catch (e) {
                    this.logDebug(`⚠ 选择器语法错误: ${selector}, 错误: ${(e as Error).message}`);
                }
            }
            if (!selectorMatch) {
                this.logDebug('⚠ 选择器匹配: 不匹配任何选择器');
            }
        } else {
            this.logDebug('\n5. 选择器匹配检查: 无图片选择器');
        }

        // 6. 综合判断
        this.logDebug(`\n========== 综合判断 ==========`);
        this.logDebug(`isSequentialImage: ${isSequentialImage}`);
        this.logDebug(`sizePass: ${sizePass}`);
        this.logDebug(`containerCheck: ${containerCheck}`);
        this.logDebug(`selectorMatch: ${selectorMatch}`);

        // 如果选择器匹配，直接通过
        if (selectorMatch) {
            this.logDebug('✓ 最终结果: 选择器匹配，识别为漫画图片');
            return true;
        }

        // 序号命名的图片，且通过尺寸和容器检查
        if (isSequentialImage && containerCheck && (width === 0 || height === 0 || sizePass)) {
            this.logDebug('✓ 最终结果: 序号命名 + 容器检查通过，识别为漫画图片');
            return true;
        }

        // 大图（>= 400x400）且在容器内
        if (width >= 400 && height >= 400 && containerCheck) {
            this.logDebug('✓ 最终结果: 大图 (>=400x400) + 容器检查通过，识别为漫画图片');
            return true;
        }

        // 如果图片未加载完成，我们暂时无法确定，但可以基于其他条件判断
        if ((width === 0 || height === 0) && (isSequentialImage || containerCheck)) {
            this.logDebug('⚠ 最终结果: 图片未加载，但 URL/容器匹配，暂时识别为漫画图片（可能后续需要重新检查）');
            return true;
        }

        this.logDebug('❌ 最终结果: 不满足任何条件，不识别为漫画图片');
        this.logDebug('=============================================\n');
        return false;
    }

    // 获取当前页面所有漫画图片（用于初始翻译）- 带详细日志
    getComicImages(): HTMLImageElement[] {
        const images: HTMLImageElement[] = [];
        const allImages = document.querySelectorAll<HTMLImageElement>('img');

        this.logInfo('\n========== 开始扫描页面图片 ==========');
        this.logInfo(`页面共有 ${allImages.length} 张 <img> 标签`);

        // 打印页面结构信息
        this.logDebug(`\n页面基本信息:`);
        this.logDebug(`  URL: ${window.location.href}`);
        this.logDebug(`  标题: ${document.title}`);
        this.logDebug(`  站点配置: ${this.siteConfig.name}`);

        // 检查站点配置的选择器
        if (this.siteConfig.imageSelector) {
            const selectorImages = document.querySelectorAll(this.siteConfig.imageSelector);
            this.logDebug(`\n站点配置选择器 "${this.siteConfig.imageSelector}" 匹配到 ${selectorImages.length} 个元素`);
        }

        allImages.forEach((img, index) => {
            const src = this.getImageRealSrc(img);
            this.logInfo(`\n--- 图片 ${index + 1}/${allImages.length} ---`);
            
            if (!src) {
                this.logInfo('❌ 跳过: 无有效 URL');
                return;
            }

            // 注意：这里不检查 processedImages，因为这是用于初始获取
            // processedImages 只用于懒加载时避免重复处理
            if (this.isComicImage(img)) {
                const filename = src.substring(src.lastIndexOf('/') + 1);
                this.logInfo(`✓ 添加: ${filename}`);
                images.push(img);
                // 标记为已处理，避免懒加载时重复
                this.processedImages.add(src);
            }
        });

        this.logInfo(`\n========== 扫描完成 ==========`);
        this.logInfo(`最终筛选出 ${images.length} 张漫画图片`);
        
        if (images.length === 0) {
            this.logWarn(`\n⚠️  警告: 未识别到任何漫画图片！`);
            this.logWarn(`可能的原因:`);
            this.logWarn(`  1. 图片使用了特殊的懒加载属性 (当前检查: ${ImageDetector.LAZY_ATTRS.join(', ')})`);
            this.logWarn(`  2. 图片未加载完成 (naturalWidth/naturalHeight 为 0)`);
            this.logWarn(`  3. 站点配置的选择器不匹配 (当前: ${this.siteConfig.imageSelector || '无'})`);
            this.logWarn(`  4. 图片尺寸太小 (< 200x200)`);
            this.logWarn(`  5. 图片 URL 包含排除关键词 (当前: ${ImageDetector.EXCLUDE_KEYWORDS.join(', ')})`);
            this.logWarn(`\n请查看浏览器控制台的详细日志 (过滤 "[MangaFlow]")`);
        }

        return images;
    }

    // 设置新图片回调
    setOnNewImage(callback: (img: HTMLImageElement) => void): void {
        this.onNewImage = callback;
    }

    // 设置漫画图片检测回调（用于悬浮球显示策略）
    setOnComicImageDetected(callback: (img: HTMLImageElement) => void): void {
        this.onComicImageDetected = callback;
    }

    // 手动触发重新检测（用于用户点击翻译按钮时）
    forceRescan(): void {
        this.logInfo('手动触发重新扫描，清空 processedImages');
        this.processedImages.clear();
    }

    // 设置调试模式
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    // 销毁
    destroy(): void {
        this.observer?.disconnect();
        this.intersectionObserver?.disconnect();
        this.processedImages.clear();
    }
}

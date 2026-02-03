// 漫译 MangaFlow - 文本过滤器
// 过滤不需要翻译的文本（拟声词、装饰文字、水印等）

import type { BBox } from '../../types';

export class TextFilter {
    // 水印/广告关键词（强特征）
    private readonly watermarkStrongKeywords = [
        'NEWTOKI',
        'NEW TOKI',
        'NEWTOKI469',
        '뉴토끼',
        '웹툰왕국',
        '웹툰 왕국',
    ];

    // 水印/广告关键词（弱特征）
    private readonly watermarkWeakKeywords = [
        '웹툰',
        '만화',
        '무료',
        '빠른',
        '사이트',
        '제공',
    ];

    private readonly urlPattern = /https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.io\b|\.gg\b|\.me\b|\.to\b|\.kr\b|\.jp\b|\.cn\b/i;

    // 拟声词模式
    private readonly onomatopoeiaPatterns = [
        // 韩文拟声词（重复形态）
        /^([가-힣])\1{1,3}$/,
        /^([가-힣]{2})\1{1,2}$/,
        /^([가-힣]{3})\1$/,
        /^(쿵쿵|두근두근|부릉|쾅쾅|쾅|팍|퍽|퍽퍽)+$/i,
        // 日文拟声词
        /^[ァ-ヴー]{1,6}$/,
        /^(ドキドキ|バキバキ|ゴゴゴゴ|ズキズキ|ガタンゴトン|ドン)+$/,
        // 英文拟声词
        /^(haha|hehe|lol|wow|boom|bang|crash|splash)+$/i,
    ];

    // 装饰文字模式
    private readonly decorativePatterns = [
        /^[!?？！…。，、；：]+$/,
        /^[★☆◆◇■□●○△▽]+$/,
        /^[~—-]+$/,
        /^\.{2,}$/,
    ];

    // 判断是否需要翻译
    shouldTranslate(text: string, bbox: BBox): boolean {
        return this.classify(text, bbox).keep;
    }

    // 过滤分类（用于组内保护策略）
    classify(text: string, bbox: BBox): { keep: boolean; reason: string; hardDrop: boolean } {
        const trimmedText = text.trim();
        const area = (bbox.x1 - bbox.x0) * (bbox.y1 - bbox.y0);
        const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(trimmedText);

        if (!trimmedText) return { keep: false, reason: 'empty', hardDrop: false };
        if (/^\s+$/.test(trimmedText)) return { keep: false, reason: 'blank', hardDrop: false };
        if (/^\d+$/.test(trimmedText)) return { keep: false, reason: 'digits', hardDrop: false };

        if (this.isWatermark(trimmedText)) return { keep: false, reason: 'watermark', hardDrop: true };
        if (this.isOnomatopoeia(trimmedText)) return { keep: false, reason: 'onomatopoeia', hardDrop: true };
        if (this.isDecorative(trimmedText)) return { keep: false, reason: 'decorative', hardDrop: false };

        if (!isCjk && trimmedText.length <= 1) {
            return { keep: false, reason: 'short', hardDrop: false };
        }
        if (!isCjk && area < 300) {
            return { keep: false, reason: 'small', hardDrop: false };
        }
        if (isCjk && trimmedText.length <= 2 && area < 120) {
            return { keep: false, reason: 'small', hardDrop: false };
        }

        return { keep: true, reason: 'ok', hardDrop: false };
    }

    // 水印/广告检测
    private isWatermark(text: string): boolean {
        if (this.urlPattern.test(text)) return true;
        const upper = text.toUpperCase();
        if (this.watermarkStrongKeywords.some((keyword) => upper.includes(keyword.toUpperCase()))) return true;
        const weakHitCount = this.watermarkWeakKeywords.filter((keyword) => upper.includes(keyword.toUpperCase())).length;
        const hasDigits = /\d{2,}/.test(text);
        return weakHitCount >= 2 && hasDigits;
    }

    // 检测是否为拟声词
    private isOnomatopoeia(text: string): boolean {
        return this.onomatopoeiaPatterns.some((pattern) => pattern.test(text));
    }

    // 检测是否为装饰文字
    private isDecorative(text: string): boolean {
        return this.decorativePatterns.some((pattern) => pattern.test(text));
    }
}

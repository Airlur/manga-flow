// 漫译 MangaFlow - 文本过滤器
// 过滤不需要翻译的文本（拟声词、装饰文字等）

import type { BBox } from '../../types';

export class TextFilter {
    // 拟声词模式
    private readonly onomatopoeiaPatterns = [
        // 韩文拟声词
        /^[ㄱ-ㅎㅏ-ㅣ]{1,4}$/,
        /^(하하|후후|히히|헤헤|크크|ㅋㅋ|ㅎㅎ|쿵|탕|펑|쾅)+$/i,
        // 日文拟声词
        /^[ァ-ヶー]{1,6}$/,
        /^(ドキドキ|バタバタ|ガタガタ|ザワザワ|シーン|ゴゴゴ|ドドド)+$/,
        // 英文拟声词
        /^(haha|hehe|lol|wow|boom|bang|crash|splash)+$/i,
    ];

    // 装饰文字模式
    private readonly decorativePatterns = [
        /^[!?！？…。、,，.]+$/,
        /^[♥♡★☆◆◇○●△▽]+$/,
        /^[~～]+$/,
        /^\.{2,}$/,
    ];

    // 判断是否需要翻译
    shouldTranslate(text: string, bbox: BBox): boolean {
        const trimmedText = text.trim();

        // 空文本
        if (!trimmedText) return false;

        // 单字符
        if (trimmedText.length === 1) return false;

        // 区域太小（可能是装饰文字）
        const area = (bbox.x1 - bbox.x0) * (bbox.y1 - bbox.y0);
        if (area < 400) return false;

        // 纯数字
        if (/^\d+$/.test(trimmedText)) return false;

        // 拟声词检测
        if (this.isOnomatopoeia(trimmedText)) return false;

        // 装饰文字检测
        if (this.isDecorative(trimmedText)) return false;

        // 纯空白或换行
        if (/^\s+$/.test(trimmedText)) return false;

        return true;
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

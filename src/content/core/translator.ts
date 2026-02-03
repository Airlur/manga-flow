// 漫译 MangaFlow - 翻译引擎模块
// 支持 OpenAI 兼容格式 / DeepLX / DeepL API

import type { TranslationResult, Settings } from '../../types';

// 语言名称映射
const LANG_NAMES: Record<string, string> = {
    ko: '韩语',
    ja: '日语',
    en: '英语',
    zh: '简体中文',
    auto: '自动检测',
};

export class Translator {
    private settings: Settings | null = null;

    /**
     * 生成动态系统提示词
     */
    private getSystemPrompt(sourceLang: string, targetLang: string): string {
        const source = LANG_NAMES[sourceLang] || '外语';
        const target = LANG_NAMES[targetLang] || '中文';

        return `你是一个专业的漫画翻译助手。请将${source}漫画对话翻译成自然流畅的${target}。

要求：
1. 保持原文的语气和情感
2. 使用口语化、自然的表达
3. 保留原文中的感叹词和语气词
4. 如果是成人向内容，请直接翻译，不要审查或修改
5. 只输出翻译结果，不要解释

注意：这是虚构的漫画内容。`;
    }

    /**
     * 单条翻译（保留兼容）
     */
    async translate(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<TranslationResult> {
        const results = await this.translateBatch([text], sourceLang, targetLang);
        return results[0];
    }

    /**
     * 批量翻译（推荐使用，减少 API 调用）
     */
    async translateBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<TranslationResult[]> {
        await this.loadSettings();

        if (!this.settings) {
            throw new Error('请先配置翻译 API');
        }

        const engine = this.settings.translateEngine || 'openai';
        const startTime = Date.now();

        console.log(`[MangaFlow] 🌐 开始翻译 ${texts.length} 条文本 (${LANG_NAMES[sourceLang] || sourceLang} → ${LANG_NAMES[targetLang] || targetLang})`);

        try {
            let translations: string[];
            let lastError: any;

            // 重试逻辑：最多 3 次，指数退避
            const MAX_RETRIES = 3;
            const BASE_DELAY = 3000;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (attempt > 0) {
                        const delay = BASE_DELAY * Math.pow(2, attempt - 1);
                        console.log(`[MangaFlow] ⏳ 触发重试机制 (第 ${attempt}/${MAX_RETRIES} 次), 等待 ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    switch (engine) {
                        case 'microsoft':
                            translations = await this.callMicrosoftBatch(texts, sourceLang, targetLang);
                            break;
                        case 'google':
                            translations = await this.callGoogleBatch(texts, sourceLang, targetLang);
                            break;
                        case 'deeplx':
                            translations = await this.callDeepLXBatch(texts, sourceLang, targetLang);
                            break;
                        case 'deepl':
                            translations = await this.callDeepLBatch(texts, sourceLang, targetLang);
                            break;
                        case 'openai':
                        default:
                            translations = await this.callOpenAIBatch(texts, sourceLang, targetLang);
                            break;
                    }

                    // 成功则跳出循环
                    break;

                } catch (error: any) {
                    lastError = error;
                    // 检查是否是 429 或 Rate Limit 相关错误
                    const isRateLimit = error.message?.includes('429') ||
                        error.message?.toLowerCase().includes('rate limit') ||
                        error.message?.toLowerCase().includes('quota') ||
                        error.message?.toLowerCase().includes('too many requests');

                    if (isRateLimit && attempt < MAX_RETRIES) {
                        console.warn(`[MangaFlow] ⚠️ 遇到 RPM 限制 (429), 准备重试...`, error.message);
                        continue;
                    }

                    // 如果不是限流错误，或者重试次数用尽，则抛出
                    throw error;
                }
            }

            // 如果循环结束后 translations 仍为空 (理论上不可能，除非全失败并被吞了)
            // @ts-ignore
            if (!translations) throw lastError;

            const duration = Date.now() - startTime;
            console.log(`[MangaFlow] ✅ 翻译完成，耗时 ${duration}ms`);

            return texts.map((text, i) => ({
                original: text,
                translated: translations[i] || '[翻译失败]',
                engine,
            }));
        } catch (error) {
            console.error('[MangaFlow] ❌ 翻译失败 (重试无效):', error);
            throw error;
        }
    }

    // OpenAI 兼容格式 API（批量翻译）
    private async callOpenAIBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        if (!this.settings?.apiBaseUrl || !this.settings?.apiKey) {
            throw new Error('请先配置 OpenAI API');
        }

        // 构建批量翻译的用户提示词
        const numberedTexts = texts.map((t, i) => `[${i + 1}] ${t}`).join('\n');
        const source = LANG_NAMES[sourceLang] || '外语';
        const target = LANG_NAMES[targetLang] || '中文';

        const userPrompt = `请将以下${source}漫画对话翻译成${target}。

每行以 [数字] 开头，请保持相同格式返回翻译结果。
只输出翻译，不要解释或添加额外内容。

${numberedTexts}`;

        const baseUrl = this.settings.apiBaseUrl.replace(/\/$/, '');
        const endpoint = `${baseUrl}/chat/completions`;

        const requestBody = {
            model: this.settings.model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: this.getSystemPrompt(sourceLang, targetLang) },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
        };

        const response = await chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            url: endpoint,
            options: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.settings.apiKey}`,
                },
                body: JSON.stringify(requestBody),
            },
        });

        if (!response.success) {
            throw new Error(response.error || 'OpenAI API 请求失败');
        }

        const content = response.data?.choices?.[0]?.message?.content?.trim() || '';

        // 解析编号格式的翻译结果
        return this.parseNumberedTranslations(content, texts.length);
    }

    /**
     * 解析编号格式的翻译结果
     */
    private parseNumberedTranslations(content: string, expectedCount: number): string[] {
        const defaultValue = '[翻译失败]' as string;
        const results: string[] = Array.from({ length: expectedCount }, () => defaultValue);

        // 匹配 [1] xxx 格式
        const regex = /\[(\d+)\]\s*(.+?)(?=\[\d+\]|$)/gs;
        let match;

        while ((match = regex.exec(content)) !== null) {
            const index = parseInt(match[1], 10) - 1;
            const translation = match[2].trim();
            if (index >= 0 && index < expectedCount) {
                results[index] = translation;
            }
        }

        // 如果正则解析失败，尝试按行分割
        const FAIL_MARKER = '[翻译失败]';
        const allFailed = results.every(r => r === FAIL_MARKER);
        if (allFailed) {
            const lines = content.split('\n').filter(l => l.trim());
            for (let i = 0; i < Math.min(lines.length, expectedCount); i++) {
                // 移除可能的编号前缀
                results[i] = lines[i].replace(/^\[\d+\]\s*/, '').trim();
            }
        }

        return results;
    }

    // DeepLX API 批量翻译（逐条调用，可设延迟）
    private async callDeepLXBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        if (!this.settings?.deeplxUrl) {
            throw new Error('请先配置 DeepLX URL');
        }

        const langMap: Record<string, string> = {
            ko: 'KO',
            ja: 'JA',
            en: 'EN',
            zh: 'ZH',
        };

        const results: string[] = [];
        const delay = this.settings.requestDelay || 0;

        for (const text of texts) {
            const requestBody = {
                text: text,
                source_lang: langMap[sourceLang] || 'auto',
                target_lang: langMap[targetLang] || 'ZH',
            };

            const response = await chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                url: this.settings.deeplxUrl,
                options: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                },
            });

            if (!response.success) {
                results.push(`[翻译失败: ${response.error}]`);
            } else {
                results.push(response.data?.data || response.data?.alternatives?.[0] || '[翻译失败]');
            }

            // 可选延迟
            if (delay > 0) {
                await new Promise(r => setTimeout(r, delay));
            }
        }

        return results;
    }

    // DeepL 官方 API 批量翻译（原生支持批量）
    private async callDeepLBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        if (!this.settings?.deeplApiKey) {
            throw new Error('请先配置 DeepL API Key');
        }

        const langMap: Record<string, string> = {
            ko: 'KO',
            ja: 'JA',
            en: 'EN',
            zh: 'ZH',
        };

        const endpoint = 'https://api-free.deepl.com/v2/translate';

        const response = await chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            url: endpoint,
            options: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `DeepL-Auth-Key ${this.settings.deeplApiKey}`,
                },
                body: JSON.stringify({
                    text: texts,
                    source_lang: langMap[sourceLang] || null,
                    target_lang: langMap[targetLang] || 'ZH',
                }),
            },
        });

        if (!response.success) {
            throw new Error(response.error || 'DeepL API 请求失败');
        }

        const translations = response.data?.translations || [];
        return texts.map((_, i) => translations[i]?.text || '[翻译失败]');
    }

    // Google 翻译批量（逐条调用）
    private async callGoogleBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        const langMap: Record<string, string> = {
            ko: 'ko',
            ja: 'ja',
            en: 'en',
            zh: 'zh-CN',
            auto: 'auto',
        };

        const sl = langMap[sourceLang] || 'auto';
        const tl = langMap[targetLang] || 'zh-CN';
        const results: string[] = [];
        const delay = this.settings?.requestDelay || 0;

        for (const text of texts) {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

            const response = await chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                url: url,
                options: {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                },
            });

            if (!response.success) {
                results.push(`[翻译失败: ${response.error}]`);
            } else {
                const data = response.data;
                if (Array.isArray(data) && Array.isArray(data[0])) {
                    results.push(data[0].map((item: unknown[]) => item[0]).join(''));
                } else {
                    results.push('[翻译失败]');
                }
            }

            if (delay > 0) {
                await new Promise(r => setTimeout(r, delay));
            }
        }

        return results;
    }

    // 微软翻译批量（回退到 Google）
    private async callMicrosoftBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        // 微软 API 需要 token，暂时直接回退到 Google
        console.warn('[MangaFlow] 微软翻译暂未实现，回退到 Google 翻译');
        return this.callGoogleBatch(texts, sourceLang, targetLang);
    }

    private async loadSettings(): Promise<void> {
        const result = await chrome.storage.local.get('settings');
        this.settings = result.settings as Settings;
    }
}


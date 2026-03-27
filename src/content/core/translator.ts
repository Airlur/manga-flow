import { getEnabledOpenAIProviders, normalizeSettings } from '../../config/default-settings';
import type { OpenAIProvider, Settings, TranslationResult } from '../../types';

const LANG_NAMES: Record<string, string> = {
    ko: '韩语',
    ja: '日语',
    en: '英语',
    zh: '简体中文',
    auto: '自动检测',
};

export class Translator {
    private settings: Settings | null = null;

    private getSystemPrompt(sourceLang: string, targetLang: string): string {
        const source = LANG_NAMES[sourceLang] || '外语';
        const target = LANG_NAMES[targetLang] || '中文';

        return `你是一个专业的漫画翻译助手。请将${source}漫画对白翻译成自然流畅的${target}。
要求：
1. 保持原文语气和情绪
2. 使用口语化、自然的表达
3. 保留感叹词和语气词
4. 如果涉及成人向内容，直接翻译，不要审查或改写
5. 只输出翻译结果，不要解释

注意：这是虚构的漫画内容。`;
    }

    async translate(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<TranslationResult> {
        const results = await this.translateBatch([text], sourceLang, targetLang);
        return results[0];
    }

    async translateBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<TranslationResult[]> {
        await this.loadSettings();

        if (!this.settings) {
            throw new Error('请先配置翻译服务');
        }

        const engine = this.settings.translateEngine || 'openai';
        const startTime = Date.now();

        console.log(
            `[MangaFlow] 开始翻译 ${texts.length} 条文本（${LANG_NAMES[sourceLang] || sourceLang} -> ${LANG_NAMES[targetLang] || targetLang}）`
        );

        try {
            let translations: string[] | undefined;
            let lastError: unknown;

            const maxRetries = 3;
            const baseDelay = 3000;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        const delay = baseDelay * Math.pow(2, attempt - 1);
                        console.log(`[MangaFlow] 触发重试（第 ${attempt}/${maxRetries} 次，等待 ${delay}ms）`);
                        await new Promise((resolve) => setTimeout(resolve, delay));
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

                    break;
                } catch (error: any) {
                    lastError = error;
                    const isRateLimit = error.message?.includes('429')
                        || error.message?.toLowerCase().includes('rate limit')
                        || error.message?.toLowerCase().includes('quota')
                        || error.message?.toLowerCase().includes('too many requests');

                    if (isRateLimit && attempt < maxRetries) {
                        console.warn('[MangaFlow] 遇到 RPM / 配额限制，准备重试：', error.message);
                        continue;
                    }

                    throw error;
                }
            }

            if (!translations) {
                throw lastError || new Error('翻译失败');
            }

            const duration = Date.now() - startTime;
            console.log(`[MangaFlow] 翻译完成，耗时 ${duration}ms`);

            return texts.map((text, index) => ({
                original: text,
                translated: translations?.[index] || '[翻译失败]',
                engine,
            }));
        } catch (error) {
            console.error('[MangaFlow] 翻译失败（重试后仍失败）:', error);
            throw error;
        }
    }

    private async callOpenAIBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        const providers = this.getAvailableOpenAIProviders();

        if (providers.length === 0) {
            throw new Error('请先配置至少一个可用的 OpenAI 兼容服务商');
        }

        const numberedTexts = texts.map((text, index) => `[${index + 1}] ${text}`).join('\n');
        const source = LANG_NAMES[sourceLang] || '外语';
        const target = LANG_NAMES[targetLang] || '中文';
        const userPrompt = `请将以下${source}漫画对话翻译成${target}。
每行以 [数字] 开头，请保持相同格式返回翻译结果。只输出翻译，不要解释或添加额外内容。
${numberedTexts}`;

        let lastError: Error | null = null;

        for (const provider of providers) {
            try {
                const content = await this.requestOpenAIProvider(provider, sourceLang, targetLang, userPrompt);
                return this.parseNumberedTranslations(content, texts.length);
            } catch (error) {
                lastError = error as Error;
                console.warn(`[MangaFlow] OpenAI 兼容服务商调用失败，尝试下一个：${provider.name}`, error);
            }
        }

        throw lastError || new Error('OpenAI 兼容服务商调用失败');
    }

    private async requestOpenAIProvider(
        provider: OpenAIProvider,
        sourceLang: string,
        targetLang: string,
        userPrompt: string
    ): Promise<string> {
        const baseUrl = provider.apiBaseUrl.replace(/\/+$/, '');
        const endpoint = `${baseUrl}/v1/chat/completions`;
        const model = provider.model || this.settings?.model;

        if (!model) {
            throw new Error('请先选择模型');
        }

        const response = await chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            url: endpoint,
            options: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${provider.apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: this.getSystemPrompt(sourceLang, targetLang) },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 4000,
                }),
            },
        });

        if (!response.success) {
            throw new Error(response.error || `OpenAI 兼容 API 请求失败（${provider.name}）`);
        }

        return response.data?.choices?.[0]?.message?.content?.trim() || '';
    }

    private parseNumberedTranslations(content: string, expectedCount: number): string[] {
        const failMarker = '[翻译失败]';
        const results = new Array<string>(expectedCount).fill(failMarker);

        const regex = /\[(\d+)\]\s*(.+?)(?=\[\d+\]|$)/gs;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
            const index = parseInt(match[1], 10) - 1;
            const translation = match[2].trim();

            if (index >= 0 && index < expectedCount) {
                results[index] = translation;
            }
        }

        const hasParsed = results.some((item) => item !== failMarker);
        if (!hasParsed) {
            const lines = content.split('\n').filter((line) => line.trim());
            for (let index = 0; index < Math.min(lines.length, expectedCount); index++) {
                results[index] = lines[index].replace(/^\[\d+\]\s*/, '').trim();
            }
        }

        return results;
    }

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
            const response = await chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                url: this.settings.deeplxUrl,
                options: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text,
                        source_lang: langMap[sourceLang] || 'auto',
                        target_lang: langMap[targetLang] || 'ZH',
                    }),
                },
            });

            if (!response.success) {
                results.push(`[翻译失败：${response.error}]`);
            } else {
                results.push(response.data?.data || response.data?.alternatives?.[0] || '[翻译失败]');
            }

            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        return results;
    }

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

        const response = await chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            url: 'https://api-free.deepl.com/v2/translate',
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
        return texts.map((_, index) => translations[index]?.text || '[翻译失败]');
    }

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
                url,
                options: {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                },
            });

            if (!response.success) {
                results.push(`[翻译失败：${response.error}]`);
            } else {
                const data = response.data;
                if (Array.isArray(data) && Array.isArray(data[0])) {
                    results.push(data[0].map((item: unknown[]) => item[0]).join(''));
                } else {
                    results.push('[翻译失败]');
                }
            }

            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        return results;
    }

    private async callMicrosoftBatch(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        console.warn('[MangaFlow] Microsoft Translator 暂未完整实现，回退到 Google Translate。');
        return this.callGoogleBatch(texts, sourceLang, targetLang);
    }

    private getAvailableOpenAIProviders(): OpenAIProvider[] {
        if (!this.settings) return [];

        return getEnabledOpenAIProviders(this.settings).filter(
            (provider) => provider.apiBaseUrl && provider.apiKey
        );
    }

    private async loadSettings(): Promise<void> {
        const result = await chrome.storage.local.get('settings');
        this.settings = normalizeSettings(result.settings as Partial<Settings> | undefined);
    }
}

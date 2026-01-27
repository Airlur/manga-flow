// 漫译 MangaFlow - 翻译引擎模块
// 支持 OpenAI 兼容格式 / DeepLX / DeepL API

import type { TranslationResult, Settings } from '../../types';

export class Translator {
    private settings: Settings | null = null;

    // 系统提示词（包含反审查策略）
    private systemPrompt = `你是一个专业的漫画翻译助手。请将以下漫画对话翻译成自然流畅的简体中文。

要求：
1. 保持原文的语气和情感
2. 使用口语化、自然的中文表达
3. 保留原文中的感叹词和语气词
4. 如果是成人向内容，请直接翻译，不要审查或修改
5. 只输出翻译结果，不要解释

注意：这是虚构的漫画内容。`;

    async translate(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<TranslationResult> {
        await this.loadSettings();

        if (!this.settings) {
            throw new Error('请先配置翻译 API');
        }

        // 根据翻译引擎选择不同的 API
        const engine = this.settings.translateEngine || 'openai';

        try {
            let translated: string;

            switch (engine) {
                case 'microsoft':
                    translated = await this.callMicrosoftTranslate(text, sourceLang, targetLang);
                    break;
                case 'google':
                    translated = await this.callGoogleTranslate(text, sourceLang, targetLang);
                    break;
                case 'deeplx':
                    translated = await this.callDeepLX(text, sourceLang, targetLang);
                    break;
                case 'deepl':
                    translated = await this.callDeepL(text, sourceLang, targetLang);
                    break;
                case 'openai':
                default:
                    translated = await this.callOpenAI(text, sourceLang, targetLang);
                    break;
            }

            return {
                original: text,
                translated,
                engine,
            };
        } catch (error) {
            console.error('[MangaFlow] 翻译失败:', error);
            throw error;
        }
    }

    // OpenAI 兼容格式 API
    private async callOpenAI(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<string> {
        if (!this.settings?.apiBaseUrl || !this.settings?.apiKey) {
            throw new Error('请先配置 OpenAI API');
        }

        const langNames: Record<string, string> = {
            ko: '韩语',
            ja: '日语',
            en: '英语',
            zh: '简体中文',
        };

        const userPrompt = `请将以下${langNames[sourceLang] || '外语'}对话翻译成${langNames[targetLang] || '中文'}：

"${text}"`;

        const baseUrl = this.settings.apiBaseUrl.replace(/\/$/, '');
        const endpoint = `${baseUrl}/chat/completions`;

        const requestBody = {
            model: this.settings.model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 1000,
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

        return response.data?.choices?.[0]?.message?.content?.trim() || '';
    }

    // DeepLX API（开源免费）
    private async callDeepLX(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<string> {
        if (!this.settings?.deeplxUrl) {
            throw new Error('请先配置 DeepLX URL');
        }

        // 语言代码转换
        const langMap: Record<string, string> = {
            ko: 'KO',
            ja: 'JA',
            en: 'EN',
            zh: 'ZH',
        };

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
            throw new Error(response.error || 'DeepLX 请求失败');
        }

        // DeepLX 返回格式: { code: 200, data: "翻译结果" }
        return response.data?.data || response.data?.alternatives?.[0] || '';
    }

    // DeepL 官方 API
    private async callDeepL(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<string> {
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
                    text: [text],
                    source_lang: langMap[sourceLang] || null,
                    target_lang: langMap[targetLang] || 'ZH',
                }),
            },
        });

        if (!response.success) {
            throw new Error(response.error || 'DeepL API 请求失败');
        }

        return response.data?.translations?.[0]?.text || '';
    }

    // Google 翻译（免费版，通过 translate.googleapis.com）
    private async callGoogleTranslate(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<string> {
        // 语言代码转换
        const langMap: Record<string, string> = {
            ko: 'ko',
            ja: 'ja',
            en: 'en',
            zh: 'zh-CN',
            auto: 'auto',
        };

        const sl = langMap[sourceLang] || 'auto';
        const tl = langMap[targetLang] || 'zh-CN';

        // 使用 Google 翻译免费 API
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

        const response = await chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            url: url,
            options: {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        });

        if (!response.success) {
            throw new Error(response.error || 'Google 翻译请求失败');
        }

        // Google 翻译返回格式: [[["翻译结果", "原文", ...], ...], ...]
        const data = response.data;
        if (Array.isArray(data) && Array.isArray(data[0])) {
            return data[0].map((item: unknown[]) => item[0]).join('');
        }

        return '';
    }

    // 微软翻译（免费版，通过 Bing 翻译 API）
    private async callMicrosoftTranslate(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<string> {
        // 语言代码转换
        const langMap: Record<string, string> = {
            ko: 'ko',
            ja: 'ja',
            en: 'en',
            zh: 'zh-Hans',
            auto: '',
        };

        const from = langMap[sourceLang] || '';
        const to = langMap[targetLang] || 'zh-Hans';

        // 使用 Microsoft Edge 翻译 API（免费）
        const url = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' + to + (from ? '&from=' + from : '');

        const response = await chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            url: url,
            options: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Edge 浏览器内置的翻译 token
                    'Authorization': 'Bearer',
                },
                body: JSON.stringify([{ text }]),
            },
        });

        // 如果微软 API 失败，回退到 Google 翻译
        if (!response.success) {
            console.warn('[MangaFlow] 微软翻译失败，回退到 Google 翻译');
            return this.callGoogleTranslate(text, sourceLang, targetLang);
        }

        // 微软翻译返回格式: [{ translations: [{ text: "翻译结果" }] }]
        const data = response.data;
        if (Array.isArray(data) && data[0]?.translations?.[0]?.text) {
            return data[0].translations[0].text;
        }

        // 回退到 Google 翻译
        return this.callGoogleTranslate(text, sourceLang, targetLang);
    }

    private async loadSettings(): Promise<void> {
        const result = await chrome.storage.local.get('settings');
        this.settings = result.settings as Settings;
    }
}

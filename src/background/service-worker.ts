import { DEFAULT_SETTINGS, getPrimaryOpenAIProvider, normalizeSettings } from '../config/default-settings';
import type { OpenAIProvider, Settings } from '../types';

interface APIRequest {
    type: 'API_REQUEST' | 'TEST_TRANSLATION' | 'FETCH_IMAGE';
    url?: string;
    options?: RequestInit;
    timeoutMs?: number;
    engine?: string;
    text?: string;
    imageUrl?: string;
    settings?: Partial<Settings>;
}

interface APIResponse {
    success: boolean;
    data?: unknown;
    translated?: string;
    imageData?: string;
    error?: string;
}

chrome.runtime.onMessage.addListener(
    (request: APIRequest, _sender, sendResponse: (response: APIResponse) => void) => {
        if (request.type === 'API_REQUEST') {
            handleAPIRequest(request.url!, request.options!, request.timeoutMs)
                .then((data) => sendResponse({ success: true, data }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        if (request.type === 'TEST_TRANSLATION') {
            handleTestTranslation(request.engine!, request.text!, request.settings)
                .then((translated) => sendResponse({ success: true, translated }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        if (request.type === 'FETCH_IMAGE') {
            fetchImageAsBase64(request.imageUrl!)
                .then((imageData) => sendResponse({ success: true, imageData }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        return false;
    }
);

async function handleAPIRequest(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`API 请求失败：${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }

        return response.text();
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error('请求超时');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    console.log(`[MangaFlow][Service Worker] 尝试获取图片: ${imageUrl}`);
    
    // 尝试最多 3 次
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(imageUrl, {
                credentials: 'include', // 包含 cookie（用于需要登录的站点）
                cache: 'force-cache',    // 优先使用缓存
            });

            if (!response.ok) {
                console.warn(`[MangaFlow][Service Worker] 图片获取失败 (尝试 ${attempt}/${maxRetries}): ${response.status} ${response.statusText}`);
                
                // 如果是 404，可能需要检查 URL 格式
                if (response.status === 404) {
                    console.warn(`[MangaFlow][Service Worker] URL 可能有问题: ${imageUrl}`);
                    console.warn(`[MangaFlow][Service Worker] 建议检查: 1. URL 是否正确 2. 是否需要登录 3. 图片是否存在`);
                }
                
                lastError = new Error(`图片获取失败：${response.status} ${response.statusText}`);
                
                // 如果不是最后一次尝试，等待后重试
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 500 * attempt));
                    continue;
                }
                
                throw lastError;
            }

            console.log(`[MangaFlow][Service Worker] 图片获取成功 (尝试 ${attempt}/${maxRetries})`);
            
            const blob = await response.blob();
            
            console.log(`[MangaFlow][Service Worker] 图片大小: ${blob.size} 字节, 类型: ${blob.type}`);

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        console.log(`[MangaFlow][Service Worker] 图片转换为 Base64 成功`);
                        resolve(reader.result);
                    } else {
                        reject(new Error('读取图片失败'));
                    }
                };
                reader.onerror = () => reject(new Error('读取图片失败'));
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error(`[MangaFlow][Service Worker] 获取图片异常 (尝试 ${attempt}/${maxRetries}):`, error);
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500 * attempt));
                continue;
            }
            
            throw lastError;
        }
    }
    
    // 理论上不会执行到这里，因为 for 循环里已经处理了
    throw lastError || new Error('获取图片失败');
}

async function handleTestTranslation(
    engine: string,
    text: string,
    settings?: Partial<Settings>
): Promise<string> {
    const normalizedSettings = normalizeSettings(settings);
    const sourceLang = normalizedSettings.sourceLang || 'auto';
    const targetLang = normalizedSettings.targetLang || 'zh';

    switch (engine) {
        case 'microsoft':
            return testMicrosoftTranslate(text, sourceLang, targetLang);
        case 'google':
            return testGoogleTranslate(text, sourceLang, targetLang);
        case 'openai':
            return testOpenAITranslate(text, normalizedSettings, sourceLang, targetLang);
        case 'deeplx':
            return testDeepLXTranslate(text, normalizedSettings);
        case 'deepl':
            return testDeepLTranslate(text, normalizedSettings);
        default:
            throw new Error('未知的翻译引擎');
    }
}

async function testMicrosoftTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${mapToMicrosoftLang(targetLang) || 'zh-Hans'}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([{ text }]),
        });

        if (!response.ok) {
            console.warn('[MangaFlow] Microsoft Translator 当前未配置认证，回退到 Google Translate。');
            return testGoogleTranslate(text, sourceLang, targetLang);
        }

        const data = await response.json();
        return data[0]?.translations?.[0]?.text || '';
    } catch {
        return testGoogleTranslate(text, sourceLang, targetLang);
    }
}

async function testGoogleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${mapToGoogleLang(sourceLang) || 'auto'}&tl=${mapToGoogleLang(targetLang) || 'zh-CN'}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Google Translate 请求失败');
    }

    const data = await response.json();

    if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((item: unknown[]) => item[0]).join('');
    }

    throw new Error('Google Translate 返回格式错误');
}

async function testOpenAITranslate(
    text: string,
    settings: Settings,
    sourceLang: string,
    targetLang: string
): Promise<string> {
    const providers = getTestableOpenAIProviders(settings);

    if (providers.length === 0) {
        throw new Error('请先配置至少一个可用的 OpenAI 兼容服务商');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
        try {
            const baseUrl = provider.apiBaseUrl.replace(/\/+$/, '');
            const model = provider.model || settings.model;
            if (!model) {
                throw new Error('请先选择模型');
            }
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${provider.apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个翻译助手。请将用户输入的${getLanguageLabel(sourceLang)}文本翻译成${getLanguageLabel(targetLang)}。只输出翻译结果，不要解释。`,
                        },
                        {
                            role: 'user',
                            content: text,
                        },
                    ],
                    max_tokens: 100,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 请求失败：${response.status}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            lastError = error as Error;
            console.warn(`[MangaFlow] OpenAI 兼容服务商测试失败，尝试下一个：${provider.name}`, error);
        }
    }

    throw lastError || new Error('OpenAI 兼容服务商测试失败');
}

async function testDeepLXTranslate(text: string, settings: Settings): Promise<string> {
    if (!settings.deeplxUrl) {
        throw new Error('请先配置 DeepLX 服务地址');
    }

    const response = await fetch(settings.deeplxUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text,
            source_lang: settings.sourceLang || 'auto',
            target_lang: mapToDeepLang(settings.targetLang) || 'ZH',
        }),
    });

    if (!response.ok) {
        throw new Error(`DeepLX 请求失败：${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 200 && data.code !== undefined) {
        throw new Error(data.message || 'DeepLX 翻译失败');
    }

    return data.data || data.alternatives?.[0] || '';
}

async function testDeepLTranslate(text: string, settings: Settings): Promise<string> {
    if (!settings.deeplApiKey) {
        throw new Error('请先配置 DeepL API Key');
    }

    const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `DeepL-Auth-Key ${settings.deeplApiKey}`,
        },
        body: JSON.stringify({
            text: [text],
            source_lang: mapToDeepLang(settings.sourceLang),
            target_lang: mapToDeepLang(settings.targetLang) || 'ZH',
        }),
    });

    if (!response.ok) {
        throw new Error(`DeepL API 请求失败：${response.status}`);
    }

    const data = await response.json();
    return data.translations?.[0]?.text || '';
}

function getTestableOpenAIProviders(settings: Settings): OpenAIProvider[] {
    const normalized = normalizeSettings(settings);
    const enabledProviders = normalized.openaiProviders?.filter(
        (provider) => provider.enabled && provider.apiBaseUrl && provider.apiKey
    ) ?? [];

    if (enabledProviders.length > 0) {
        return enabledProviders;
    }

    const legacyProvider = getPrimaryOpenAIProvider(normalized);
    if (legacyProvider && legacyProvider.apiBaseUrl && legacyProvider.apiKey) {
        return [legacyProvider];
    }

    return [];
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('漫画翻译 MangaFlow 已安装');
        chrome.storage.local.set({
            settings: DEFAULT_SETTINGS,
        });
    }
});

console.log('漫画翻译 MangaFlow Service Worker 已启动');

function mapToDeepLang(lang?: string): string | null {
    const langMap: Record<string, string> = {
        ko: 'KO',
        ja: 'JA',
        en: 'EN',
        zh: 'ZH',
    };

    if (!lang || lang === 'auto') return null;
    return langMap[lang] || null;
}

function mapToGoogleLang(lang?: string): string | null {
    const langMap: Record<string, string> = {
        auto: 'auto',
        ko: 'ko',
        ja: 'ja',
        en: 'en',
        zh: 'zh-CN',
    };

    if (!lang) return null;
    return langMap[lang] || null;
}

function mapToMicrosoftLang(lang?: string): string | null {
    const langMap: Record<string, string> = {
        ko: 'ko',
        ja: 'ja',
        en: 'en',
        zh: 'zh-Hans',
    };

    if (!lang || lang === 'auto') return null;
    return langMap[lang] || null;
}

function getLanguageLabel(lang?: string): string {
    const langMap: Record<string, string> = {
        auto: '原文',
        ko: '韩语',
        ja: '日语',
        en: '英语',
        zh: '简体中文',
    };

    return langMap[lang || ''] || '目标语言';
}

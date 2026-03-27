// 漫译 MangaFlow - Service Worker
// 处理 API 代理请求，绕过 CORS 限制

interface APIRequest {
    type: 'API_REQUEST' | 'TEST_TRANSLATION' | 'FETCH_IMAGE';
    url?: string;
    options?: RequestInit;
    engine?: string;
    text?: string;
    imageUrl?: string;
    settings?: {
        sourceLang?: string;
        targetLang?: string;
        apiBaseUrl?: string;
        apiKey?: string;
        model?: string;
        deeplxUrl?: string;
        deeplApiKey?: string;
    };
}

interface APIResponse {
    success: boolean;
    data?: unknown;
    translated?: string;
    imageData?: string;
    error?: string;
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener(
    (request: APIRequest, _sender, sendResponse: (response: APIResponse) => void) => {
        if (request.type === 'API_REQUEST') {
            handleAPIRequest(request.url!, request.options!)
                .then((data) => sendResponse({ success: true, data }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        if (request.type === 'TEST_TRANSLATION') {
            handleTestTranslation(request.engine!, request.text!, request.settings!)
                .then((translated) => sendResponse({ success: true, translated }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }

        // 图片代理：绕过 CORS 限制获取图片
        if (request.type === 'FETCH_IMAGE') {
            fetchImageAsBase64(request.imageUrl!)
                .then((imageData) => sendResponse({ success: true, imageData }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true;
        }
    }
);

// 处理 API 请求
async function handleAPIRequest(url: string, options: RequestInit): Promise<unknown> {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// 获取图片并转换为 Base64（绕过 CORS）
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error(`图片获取失败: ${response.status}`);
    }

    const blob = await response.blob();

    // 将 Blob 转换为 Base64
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('读取图片失败'));
            }
        };
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(blob);
    });
}

// 处理测试翻译请求
async function handleTestTranslation(
    engine: string,
    text: string,
    settings: APIRequest['settings']
): Promise<string> {
    const sourceLang = settings?.sourceLang || 'auto';
    const targetLang = settings?.targetLang || 'zh';

    switch (engine) {
        case 'microsoft':
            return testMicrosoftTranslate(text, sourceLang, targetLang);
        case 'google':
            return testGoogleTranslate(text, sourceLang, targetLang);
        case 'openai':
            return testOpenAITranslate(text, settings!, sourceLang, targetLang);
        case 'deeplx':
            return testDeepLXTranslate(text, settings!);
        case 'deepl':
            return testDeepLTranslate(text, settings!);
        default:
            throw new Error('未知的翻译引擎');
    }
}

// 测试微软翻译
async function testMicrosoftTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    // 微软翻译免费 API（通过 Edge 翻译服务）
    // 注意：这是一个公共 API，可能有频率限制
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
            // 微软 API 需要 token，回退到 Google
            console.warn('[MangaFlow] 微软翻译需要认证，回退到 Google 翻译');
            return testGoogleTranslate(text, sourceLang, targetLang);
        }

        const data = await response.json();
        return data[0]?.translations?.[0]?.text || '';
    } catch {
        // 回退到 Google 翻译
        return testGoogleTranslate(text, sourceLang, targetLang);
    }
}

// 测试 Google 翻译
async function testGoogleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${mapToGoogleLang(sourceLang) || 'auto'}&tl=${mapToGoogleLang(targetLang) || 'zh-CN'}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Google 翻译请求失败');
    }

    const data = await response.json();

    if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0].map((item: unknown[]) => item[0]).join('');
    }

    throw new Error('Google 翻译返回格式错误');
}

// 测试 OpenAI 兼容 API
async function testOpenAITranslate(
    text: string,
    settings: APIRequest['settings'],
    sourceLang: string,
    targetLang: string
): Promise<string> {
    if (!settings?.apiBaseUrl || !settings?.apiKey) {
        throw new Error('请先配置 API 地址和 Key');
    }

    const url = `${settings.apiBaseUrl}/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model || 'gpt-4o-mini',
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
        throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// 测试 DeepLX
async function testDeepLXTranslate(
    text: string,
    settings: APIRequest['settings']
): Promise<string> {
    if (!settings?.deeplxUrl) {
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
        throw new Error(`DeepLX 请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 200 && data.code !== undefined) {
        throw new Error(data.message || 'DeepLX 翻译失败');
    }

    return data.data || data.alternatives?.[0] || '';
}

// 测试 DeepL 官方 API
async function testDeepLTranslate(
    text: string,
    settings: APIRequest['settings']
): Promise<string> {
    if (!settings?.deeplApiKey) {
        throw new Error('请先配置 DeepL API Key');
    }

    const url = 'https://api-free.deepl.com/v2/translate';

    const response = await fetch(url, {
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
        throw new Error(`DeepL API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.translations?.[0]?.text || '';
}

// 扩展安装/更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('漫译 MangaFlow 已安装');
        // 初始化默认设置
        chrome.storage.local.set({
            settings: {
                sourceLang: 'ko',
                targetLang: 'zh',
                translateEngine: 'google',
                apiBaseUrl: '',
                apiKey: '',
                model: 'gpt-4o-mini',
                deeplxUrl: '',
                deeplApiKey: '',
                fontSize: 14,
                fontScale: 1.0,
                fontColor: '#000000',
                maskOpacity: 0.24,
                ocrEngine: 'local',
                cloudOcrKey: '',
                devMode: true,
                devPhase: 'roi',
                showOcrBoxes: true,
                showRoiBoxes: true,
                showMaskBoxes: false,
            },
        });
    }
});

console.log('漫译 MangaFlow Service Worker 已启动');

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

// 漫译 MangaFlow - Popup 页面逻辑

interface Settings {
    sourceLang?: string;
    targetLang?: string;
    translateEngine?: string;
    apiBaseUrl?: string;
    apiKey?: string;
    model?: string;
    deeplxUrl?: string;
    deeplApiKey?: string;
    fontSize?: number;
    fontColor?: string;
    ocrEngine?: string;
    cloudOcrKey?: string;
}

// 翻译服务显示名称
const engineNames: Record<string, string> = {
    microsoft: '微软翻译（免费）',
    google: 'Google 翻译（免费）',
    openai: 'OpenAI 兼容 API',
    deeplx: 'DeepLX',
    deepl: 'DeepL',
};

document.addEventListener('DOMContentLoaded', async () => {
    const sourceLangSelect = document.getElementById('source-lang') as HTMLSelectElement;
    const targetLangSelect = document.getElementById('target-lang') as HTMLSelectElement;
    const engineSelect = document.getElementById('translate-engine') as HTMLSelectElement;
    const translateBtn = document.getElementById('translate-btn');
    const settingsLink = document.getElementById('settings-link');
    const tip = document.getElementById('tip');
    const status = document.getElementById('status');

    // 加载设置
    const result = await chrome.storage.local.get('settings');
    let settings = (result.settings || {}) as Settings;

    console.log('[MangaFlow Popup] 加载设置:', settings);

    // 如果没有设置，使用默认值
    if (!settings.translateEngine) {
        settings = {
            sourceLang: 'ko',
            targetLang: 'zh',
            translateEngine: 'google',
            fontSize: 14,
            fontColor: '#000000',
            ocrEngine: 'local',
        };
        await chrome.storage.local.set({ settings });
    }

    // 填充设置值
    if (sourceLangSelect && settings.sourceLang) {
        sourceLangSelect.value = settings.sourceLang;
    }
    if (targetLangSelect && settings.targetLang) {
        targetLangSelect.value = settings.targetLang;
    }
    if (engineSelect && settings.translateEngine) {
        engineSelect.value = settings.translateEngine;
    }

    // 语言变化保存（保留其他设置）
    sourceLangSelect?.addEventListener('change', async () => {
        const currentResult = await chrome.storage.local.get('settings');
        const currentSettings = (currentResult.settings || {}) as Settings;
        currentSettings.sourceLang = sourceLangSelect.value;
        await chrome.storage.local.set({ settings: currentSettings });
        console.log('[MangaFlow Popup] 保存原文语言:', sourceLangSelect.value);
    });

    targetLangSelect?.addEventListener('change', async () => {
        const currentResult = await chrome.storage.local.get('settings');
        const currentSettings = (currentResult.settings || {}) as Settings;
        currentSettings.targetLang = targetLangSelect.value;
        await chrome.storage.local.set({ settings: currentSettings });
        console.log('[MangaFlow Popup] 保存目标语言:', targetLangSelect.value);
    });

    // 翻译引擎变化保存
    engineSelect?.addEventListener('change', async () => {
        const currentResult = await chrome.storage.local.get('settings');
        const currentSettings = (currentResult.settings || {}) as Settings;
        currentSettings.translateEngine = engineSelect.value;
        await chrome.storage.local.set({ settings: currentSettings });
        console.log('[MangaFlow Popup] 保存翻译引擎:', engineSelect.value);
    });

    // 开始翻译按钮
    translateBtn?.addEventListener('click', async () => {
        console.log('[MangaFlow Popup] 点击开始翻译');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            console.log('[MangaFlow Popup] 当前标签页:', tab?.url);

            // 检查是否是有效页面
            if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                showTip('请先打开漫画网站再使用');
                return;
            }

            showStatus('正在启动翻译...');

            // 发送消息到内容脚本
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_TRANSLATION' });
            console.log('[MangaFlow Popup] 收到响应:', response);

            if (response?.success) {
                window.close();
            }
        } catch (error) {
            console.error('[MangaFlow Popup] 发送消息失败:', error);
            showTip('请先刷新页面后再使用');
        }
    });

    // 更多设置
    settingsLink?.addEventListener('click', async () => {
        console.log('[MangaFlow Popup] 点击更多设置');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // 检查是否是有效页面
            if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                showTip('请先打开漫画网站再使用');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SETTINGS' });
            console.log('[MangaFlow Popup] 设置响应:', response);

            if (response?.success) {
                window.close();
            }
        } catch (error) {
            console.error('[MangaFlow Popup] 发送消息失败:', error);
            showTip('请先刷新页面后再使用');
        }
    });

    // 清除缓存按钮（清除 OCR + 翻译缓存，不影响设置和 API Key）
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    clearCacheBtn?.addEventListener('click', async () => {
        if (!confirm('确定要清除所有 OCR/翻译缓存吗？（不会影响您的设置和 API Key）')) return;

        try {
            showStatus('正在清除缓存...');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
                showTip('请先打开漫画页面再清除缓存');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CACHE' });
            if (!response?.success) {
                throw new Error(response?.error || '清除失败');
            }

            showStatus('✅ OCR/翻译缓存已清除！');
            setTimeout(() => window.close(), 1500);
        } catch (error) {
            console.error('[MangaFlow] 清除缓存失败:', error);
            showTip('清除失败');
        }
    });

    function showTip(message: string) {
        if (tip) {
            tip.textContent = '⚠️ ' + message;
            tip.classList.add('show');
        }
        if (status) {
            status.classList.remove('show');
        }
    }

    function showStatus(message: string) {
        if (status) {
            status.textContent = message;
            status.classList.add('show');
            status.classList.remove('error');
        }
        if (tip) {
            tip.classList.remove('show');
        }
    }
});

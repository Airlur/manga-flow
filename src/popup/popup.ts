// 漫译 MangaFlow - Popup 页面逻辑

import type { Settings } from '../types';
import { normalizeSettings } from '../config/default-settings';

document.addEventListener('DOMContentLoaded', async () => {
    const sourceLangSelect = document.getElementById('source-lang') as HTMLSelectElement | null;
    const targetLangSelect = document.getElementById('target-lang') as HTMLSelectElement | null;
    const engineSelect = document.getElementById('translate-engine') as HTMLSelectElement | null;
    const translateBtn = document.getElementById('translate-btn') as HTMLButtonElement | null;
    const restoreBallBtn = document.getElementById('restore-ball-btn') as HTMLButtonElement | null;
    const settingsLink = document.getElementById('settings-link') as HTMLButtonElement | null;
    const clearCacheBtn = document.getElementById('clear-cache-btn') as HTMLButtonElement | null;
    const tip = document.getElementById('tip');
    const status = document.getElementById('status');

    const result = await chrome.storage.local.get('settings');
    let settings = normalizeSettings(result.settings as Partial<Settings> | undefined);

    if (!result.settings) {
        await chrome.storage.local.set({ settings });
    }

    if (sourceLangSelect) sourceLangSelect.value = settings.sourceLang;
    if (targetLangSelect) targetLangSelect.value = settings.targetLang;
    if (engineSelect) engineSelect.value = settings.translateEngine;

    sourceLangSelect?.addEventListener('change', async () => {
        settings = await savePartialSettings({ sourceLang: sourceLangSelect.value as Settings['sourceLang'] });
    });

    targetLangSelect?.addEventListener('change', async () => {
        settings = await savePartialSettings({ targetLang: targetLangSelect.value as Settings['targetLang'] });
    });

    engineSelect?.addEventListener('change', async () => {
        settings = await savePartialSettings({ translateEngine: engineSelect.value as Settings['translateEngine'] });
    });

    translateBtn?.addEventListener('click', async () => {
        try {
            const tab = await getActiveTab();
            if (!tab?.id) {
                showTip('请先打开漫画网站再使用');
                return;
            }

            showStatus('正在启动翻译...');
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_TRANSLATION' });

            if (response?.success) {
                window.close();
                return;
            }

            showTip(response?.error || '启动翻译失败');
        } catch (error) {
            console.error('[MangaFlow Popup] 启动翻译失败:', error);
            showTip('请先刷新页面后再使用');
        }
    });

    restoreBallBtn?.addEventListener('click', async () => {
        try {
            const tab = await getActiveTab();
            if (!tab?.id) {
                showTip('请先打开漫画网站再使用');
                return;
            }

            showStatus('正在恢复悬浮球...');
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_FLOATING_BALL' });

            if (response?.success) {
                window.close();
                return;
            }

            if (response?.qualified === false) {
                showTip('当前页面未识别为漫画页，暂不显示悬浮球');
                return;
            }

            showTip('恢复悬浮球失败，请先刷新页面');
        } catch (error) {
            console.error('[MangaFlow Popup] 恢复悬浮球失败:', error);
            showTip('请先刷新页面后再使用');
        }
    });

    settingsLink?.addEventListener('click', async () => {
        try {
            const tab = await getActiveTab();
            if (!tab?.id) {
                showTip('请先打开漫画网站再使用');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SETTINGS' });
            if (response?.success) {
                window.close();
                return;
            }

            showTip('打开设置失败');
        } catch (error) {
            console.error('[MangaFlow Popup] 打开设置失败:', error);
            showTip('请先刷新页面后再使用');
        }
    });

    clearCacheBtn?.addEventListener('click', async () => {
        if (!confirm('确定要清除所有 OCR/翻译缓存吗？（不会影响当前设置）')) return;

        try {
            const tab = await getActiveTab();
            if (!tab?.id) {
                showTip('请先打开漫画页面再清除缓存');
                return;
            }

            showStatus('正在清除缓存...');
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CACHE' });

            if (!response?.success) {
                throw new Error(response?.error || '清除失败');
            }

            showStatus('OCR / 翻译缓存已清除');
            setTimeout(() => window.close(), 1200);
        } catch (error) {
            console.error('[MangaFlow Popup] 清除缓存失败:', error);
            showTip('清除缓存失败');
        }
    });

    async function savePartialSettings(partial: Partial<Settings>): Promise<Settings> {
        const currentResult = await chrome.storage.local.get('settings');
        const merged = normalizeSettings({
            ...(currentResult.settings as Partial<Settings> | undefined),
            ...partial,
        });
        await chrome.storage.local.set({ settings: merged });
        return merged;
    }

    async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return undefined;

        const invalidUrl = tab.url.startsWith('chrome://')
            || tab.url.startsWith('edge://')
            || tab.url.startsWith('about:');

        return invalidUrl ? undefined : tab;
    }

    function showTip(message: string): void {
        if (tip) {
            tip.textContent = message;
            tip.classList.add('show');
        }
        if (status) {
            status.classList.remove('show');
        }
    }

    function showStatus(message: string): void {
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

import {
    AlertCircle,
    ArrowRightLeft,
    LoaderCircle,
    Play,
    RotateCcw,
    Settings2,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { normalizeSettings } from '../config/default-settings';
import { DropdownSelect } from '../shared/ui/dropdown-select';
import {
    POPUP_OCR_ENGINE_OPTIONS,
    POPUP_SOURCE_LANGUAGE_OPTIONS,
    POPUP_TARGET_LANGUAGE_OPTIONS,
    POPUP_TRANSLATION_ENGINE_OPTIONS,
} from '../shared/ui-options';
import type { Settings } from '../types';
import { PopupProviderLogo } from './provider-logo';

type BannerTone = 'info' | 'warning' | 'error' | 'success';
type BusyAction = 'translate' | 'restore' | 'settings' | 'clearCache' | null;

interface BannerState {
    tone: BannerTone;
    message: string;
}

const POPUP_VERSION = chrome.runtime.getManifest().version;

function normalizePopupSettings(settings?: Partial<Settings>): Settings {
    const normalized = normalizeSettings(settings);

    if (normalized.sourceLang === 'auto') {
        return {
            ...normalized,
            sourceLang: 'ko',
        };
    }

    return normalized;
}

function PopupApp() {
    const [settings, setSettings] = useState<Settings>(() => normalizePopupSettings());
    const [banner, setBanner] = useState<BannerState | null>(null);
    const [busyAction, setBusyAction] = useState<BusyAction>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;

        void (async () => {
            try {
                const result = await chrome.storage.local.get('settings');
                const storedSettings = normalizeSettings(result.settings as Partial<Settings> | undefined);
                const nextSettings = normalizePopupSettings(result.settings as Partial<Settings> | undefined);
                const shouldPersist = !result.settings || storedSettings.sourceLang !== nextSettings.sourceLang;

                if (shouldPersist) {
                    await chrome.storage.local.set({ settings: nextSettings });
                }

                if (active) {
                    setSettings(nextSettings);
                    setReady(true);
                }
            } catch (error) {
                console.error('[MangaFlow Popup] 读取设置失败:', error);
                if (active) {
                    setBanner({ tone: 'error', message: '读取设置失败，请稍后重试。' });
                    setReady(true);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const persistPartialSettings = async (partial: Partial<Settings>) => {
        const result = await chrome.storage.local.get('settings');
        const merged = normalizePopupSettings({
            ...(result.settings as Partial<Settings> | undefined),
            ...partial,
        });

        await chrome.storage.local.set({ settings: merged });
        setSettings(merged);
    };

    const withBusyAction = async (action: BusyAction, runner: () => Promise<void>) => {
        setBusyAction(action);
        try {
            await runner();
        } finally {
            setBusyAction(null);
        }
    };

    const handleSwapLanguages = async () => {
        const nextTargetLang = settings.sourceLang === 'auto' ? 'ko' : settings.sourceLang;

        await persistPartialSettings({
            sourceLang: settings.targetLang,
            targetLang: nextTargetLang,
        });
    };

    const handleStartTranslation = async () => {
        await withBusyAction('translate', async () => {
            try {
                const tab = await getActiveTab();
                if (!tab?.id) {
                    setBanner({ tone: 'warning', message: '请先打开可翻译的网页，再开始翻译。' });
                    return;
                }

                setBanner({ tone: 'info', message: '正在向当前页面发送翻译指令…' });
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_TRANSLATION' });

                if (response?.success) {
                    window.close();
                    return;
                }

                setBanner({ tone: 'error', message: response?.error || '启动翻译失败。' });
            } catch (error) {
                console.error('[MangaFlow Popup] 启动翻译失败:', error);
                setBanner({ tone: 'error', message: '请先刷新页面后再试。' });
            }
        });
    };

    const handleRestoreFloatingBall = async () => {
        await withBusyAction('restore', async () => {
            try {
                const tab = await getActiveTab();
                if (!tab?.id) {
                    setBanner({ tone: 'warning', message: '请先打开网页，再恢复悬浮球。' });
                    return;
                }

                setBanner({ tone: 'info', message: '正在恢复当前页面的悬浮球…' });
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_FLOATING_BALL' });

                if (response?.success) {
                    window.close();
                    return;
                }

                if (response?.qualified === false) {
                    setBanner({ tone: 'warning', message: '当前页面未通过漫画图片预检，暂不显示悬浮球。' });
                    return;
                }

                setBanner({ tone: 'error', message: '恢复悬浮球失败，请刷新页面后重试。' });
            } catch (error) {
                console.error('[MangaFlow Popup] 恢复悬浮球失败:', error);
                setBanner({ tone: 'error', message: '请先刷新页面后再试。' });
            }
        });
    };

    const handleOpenSettings = async () => {
        await withBusyAction('settings', async () => {
            try {
                const tab = await getActiveTab();
                if (!tab?.id) {
                    setBanner({ tone: 'warning', message: '请先打开网页，再进入设置。' });
                    return;
                }

                const response = await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_SETTINGS' });
                if (response?.success) {
                    window.close();
                    return;
                }

                setBanner({ tone: 'error', message: '打开设置失败。' });
            } catch (error) {
                console.error('[MangaFlow Popup] 打开设置失败:', error);
                setBanner({ tone: 'error', message: '请先刷新页面后再试。' });
            }
        });
    };

    const handleClearCache = async () => {
        const confirmed = window.confirm('确定要清除当前页 OCR / 翻译缓存吗？设置不会被清除。');
        if (!confirmed) return;

        await withBusyAction('clearCache', async () => {
            try {
                const tab = await getActiveTab();
                if (!tab?.id) {
                    setBanner({ tone: 'warning', message: '请先打开网页，再清除缓存。' });
                    return;
                }

                setBanner({ tone: 'info', message: '正在清除 OCR / 翻译缓存…' });
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_CACHE' });

                if (!response?.success) {
                    throw new Error(response?.error || '清除缓存失败');
                }

                setBanner({ tone: 'success', message: 'OCR / 翻译缓存已清除。' });
                window.setTimeout(() => window.close(), 900);
            } catch (error) {
                console.error('[MangaFlow Popup] 清除缓存失败:', error);
                setBanner({ tone: 'error', message: '清除缓存失败，请稍后重试。' });
            }
        });
    };

    return (
        <main className="mf-popup-shell">
            <header className="mf-popup-shell__header">
                <div className="mf-popup-brand">
                    <img
                        className="mf-popup-brand__logo"
                        src="../../icons/icon32.png"
                        alt="MangaFlow"
                        width={28}
                        height={28}
                    />
                    <span className="mf-popup-brand__name">MANGAFLOW</span>
                </div>
                <div className="mf-popup-version">v{POPUP_VERSION}</div>
            </header>

            {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}

            <section className="mf-popup-language-row" aria-label="语言设置">
                <div className="mf-popup-field mf-popup-field--language">
                    <label className="mf-popup-field__label">原文语言</label>
                    <DropdownSelect
                        value={settings.sourceLang}
                        options={POPUP_SOURCE_LANGUAGE_OPTIONS}
                        ariaLabel="原文语言"
                        onChange={(nextValue) => void persistPartialSettings({ sourceLang: nextValue })}
                        renderSelected={(option) => <span className="mf-popup-select-label">{option.label}</span>}
                        size="compact"
                    />
                </div>

                <button
                    type="button"
                    className="mf-popup-language-arrow"
                    aria-label="交换原文语言和目标语言"
                    onClick={() => void handleSwapLanguages()}
                    disabled={!ready || busyAction !== null}
                    title="交换语言"
                >
                    <ArrowRightLeft size={15} strokeWidth={1.9} />
                </button>

                <div className="mf-popup-field mf-popup-field--language">
                    <label className="mf-popup-field__label">目标语言</label>
                    <DropdownSelect
                        value={settings.targetLang}
                        options={POPUP_TARGET_LANGUAGE_OPTIONS}
                        ariaLabel="目标语言"
                        onChange={(nextValue) => void persistPartialSettings({ targetLang: nextValue })}
                        renderSelected={(option) => <span className="mf-popup-select-label">{option.label}</span>}
                        size="compact"
                    />
                </div>
            </section>

            <section className="mf-popup-control-list">
                <div className="mf-popup-control-row">
                    <label className="mf-popup-inline-label">OCR</label>
                    <div className="mf-popup-inline-field">
                        <DropdownSelect
                            value={settings.ocrEngine}
                            options={POPUP_OCR_ENGINE_OPTIONS}
                            ariaLabel="OCR 引擎"
                            onChange={(nextValue) => void persistPartialSettings({ ocrEngine: nextValue })}
                            renderSelected={(option) => <span className="mf-popup-select-label">{option.label}</span>}
                            size="compact"
                        />
                    </div>
                </div>

                <div className="mf-popup-control-row">
                    <label className="mf-popup-inline-label">翻译服务</label>
                    <div className="mf-popup-inline-field">
                        <DropdownSelect
                            value={settings.translateEngine}
                            options={POPUP_TRANSLATION_ENGINE_OPTIONS}
                            ariaLabel="翻译服务"
                            onChange={(nextValue) => void persistPartialSettings({ translateEngine: nextValue })}
                            renderSelected={(option) => (
                                <div className="mf-popup-provider-copy">
                                    <PopupProviderLogo provider={option.value} />
                                    <span className="mf-popup-provider-label">{option.label}</span>
                                </div>
                            )}
                            renderOptionLeading={(option) => <PopupProviderLogo provider={option.value} />}
                            size="compact"
                        />
                    </div>
                </div>
            </section>

            <section className="mf-popup-actions">
                <button
                    type="button"
                    className="mf-button mf-button--primary mf-button--large"
                    onClick={() => void handleStartTranslation()}
                    disabled={!ready || busyAction !== null}
                >
                    {busyAction === 'translate' ? (
                        <LoaderCircle className="mf-button__spinner" size={16} />
                    ) : (
                        <Play size={16} strokeWidth={2} />
                    )}
                    <span>开始翻译</span>
                </button>

                <div className="mf-popup-actions__row">
                    <button
                        type="button"
                        className="mf-button mf-button--secondary"
                        onClick={() => void handleRestoreFloatingBall()}
                        disabled={!ready || busyAction !== null}
                    >
                        {busyAction === 'restore' ? (
                            <LoaderCircle className="mf-button__spinner" size={15} />
                        ) : (
                            <RotateCcw size={15} strokeWidth={1.85} />
                        )}
                        <span>悬浮球</span>
                    </button>

                    <button
                        type="button"
                        className="mf-button mf-button--ghost"
                        onClick={() => void handleOpenSettings()}
                        disabled={!ready || busyAction !== null}
                    >
                        {busyAction === 'settings' ? (
                            <LoaderCircle className="mf-button__spinner" size={15} />
                        ) : (
                            <Settings2 size={15} strokeWidth={1.85} />
                        )}
                        <span>设置</span>
                    </button>

                    <button
                        type="button"
                        className="mf-button mf-button--ghost"
                        onClick={() => void handleClearCache()}
                        disabled={!ready || busyAction !== null}
                    >
                        {busyAction === 'clearCache' ? (
                            <LoaderCircle className="mf-button__spinner" size={15} />
                        ) : (
                            <Trash2 size={15} strokeWidth={1.8} />
                        )}
                        <span>清除缓存</span>
                    </button>
                </div>
            </section>
        </main>
    );
}

function StatusBanner({ tone, message }: BannerState) {
    return (
        <div className={`mf-banner mf-banner--${tone}`}>
            <AlertCircle size={15} strokeWidth={1.9} />
            <span>{message}</span>
        </div>
    );
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return undefined;

    const invalidUrl = tab.url.startsWith('chrome://')
        || tab.url.startsWith('edge://')
        || tab.url.startsWith('about:');

    return invalidUrl ? undefined : tab;
}

const rootElement = document.getElementById('root');

if (rootElement) {
    createRoot(rootElement).render(<PopupApp />);
}

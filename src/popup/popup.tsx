import {
    ArrowRightLeft,
    LoaderCircle,
    Play,
    Settings2,
    User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { normalizeSettings } from '../config/default-settings';
import { DropdownSelect } from '../shared/ui/dropdown-select';
import { OcrEngineLogo } from '../shared/ui/ocr-engine-logo';
import {
    POPUP_OCR_ENGINE_OPTIONS,
    POPUP_SOURCE_LANGUAGE_OPTIONS,
    POPUP_TARGET_LANGUAGE_OPTIONS,
    POPUP_TRANSLATION_ENGINE_OPTIONS,
} from '../shared/ui-options';
import type { Settings } from '../types';
import { PopupProviderLogo } from './provider-logo';

type BannerTone = 'info' | 'warning' | 'error' | 'success';
type BusyAction = 'translate' | 'settings' | 'siteToggle' | null;

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
    const [, setBanner] = useState<BannerState | null>(null);
    const [busyAction, setBusyAction] = useState<BusyAction>(null);
    const [ready, setReady] = useState(false);
    const [currentHost, setCurrentHost] = useState('');
    const [siteDisabled, setSiteDisabled] = useState(false);

    useEffect(() => {
        let active = true;

        void (async () => {
            try {
                const result = await chrome.storage.local.get('settings');
                const storedSettings = normalizeSettings(result.settings as Partial<Settings> | undefined);
                const nextSettings = normalizePopupSettings(result.settings as Partial<Settings> | undefined);
                const shouldPersist = !result.settings || storedSettings.sourceLang !== nextSettings.sourceLang;
                const tab = await getActiveTab();
                const host = getTabHost(tab?.url);
                const floatingBallResult = await chrome.storage.local.get('floatingBallPrefs');
                const disabledSites = Array.isArray(floatingBallResult.floatingBallPrefs?.disabledSites)
                    ? floatingBallResult.floatingBallPrefs.disabledSites as string[]
                    : [];
                const nextSiteDisabled = host
                    ? disabledSites.some((item) => isSameHost(item, host))
                    : false;

                if (shouldPersist) {
                    await chrome.storage.local.set({ settings: nextSettings });
                }

                if (active) {
                    setSettings(nextSettings);
                    setCurrentHost(host);
                    setSiteDisabled(nextSiteDisabled);
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
    const handleToggleSiteDisabled = async () => {
        await withBusyAction('siteToggle', async () => {
            try {
                const tab = await getActiveTab();
                if (!tab?.id || !currentHost) {
                    setBanner({ tone: 'warning', message: '请先打开普通网页，再调整当前站点设置。' });
                    return;
                }

                if (siteDisabled) {
                    const response = await chrome.tabs.sendMessage(tab.id, { type: 'ENABLE_CURRENT_SITE_FLOATING_BALL' });
                    if (!response?.success) {
                        throw new Error(response?.error || '恢复当前站点悬浮球失败');
                    }
                    setSiteDisabled(false);
                    if (response?.qualified === false) {
                        setBanner({ tone: 'info', message: '当前站点已恢复，但本页未通过漫画预检。' });
                    } else {
                        setBanner({ tone: 'success', message: '当前站点已恢复悬浮球。' });
                    }
                    return;
                }

                const response = await chrome.tabs.sendMessage(tab.id, { type: 'DISABLE_CURRENT_SITE_FLOATING_BALL' });
                if (!response?.success) {
                    throw new Error(response?.error || '禁用当前站点悬浮球失败');
                }
                setSiteDisabled(true);
                setBanner({ tone: 'info', message: `已禁用当前站点悬浮球：${currentHost}` });
            } catch (error) {
                console.error('[MangaFlow Popup] 切换当前站点悬浮球失败:', error);
                setBanner({ tone: 'error', message: '切换当前站点悬浮球失败，请稍后重试。' });
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
                            preferredDirection="down"
                            disableMaxHeight
                            renderSelected={(option) => (
                                <div className="mf-popup-provider-copy">
                                    <OcrEngineLogo engine={option.value} />
                                    <span className="mf-popup-select-label">{option.label}</span>
                                </div>
                            )}
                            renderOptionLeading={(option) => <OcrEngineLogo engine={option.value} />}
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
                            preferredDirection="down"
                            disableMaxHeight
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
                <div className="mf-popup-site-toggle">
                    <div className="mf-popup-site-toggle__copy">
                        <span className="mf-popup-site-toggle__title">在此网站禁用悬浮球</span>
                        <span className="mf-popup-site-toggle__subtitle">
                            {currentHost || '当前页面不可用'}
                        </span>
                    </div>
                    <button
                        type="button"
                        className={`mf-switch ${siteDisabled ? 'is-checked' : ''}`.trim()}
                        aria-label="在此网站禁用悬浮球"
                        aria-pressed={siteDisabled}
                        onClick={() => void handleToggleSiteDisabled()}
                        disabled={!ready || busyAction !== null || !currentHost}
                    >
                        <span className="mf-switch__thumb" />
                    </button>
                </div>
            </section>

            <footer className="mf-popup-footer">
                <div className="mf-popup-footer__account">
                    <span className="mf-popup-footer__avatar" aria-hidden="true">
                        <User size={15} strokeWidth={2} />
                    </span>
                    <span className="mf-popup-footer__guest">游客</span>
                    <button type="button" className="mf-popup-footer__login">
                        登录
                    </button>
                </div>

                <button
                    type="button"
                    className="mf-popup-footer__settings"
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
            </footer>
        </main>
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

function getTabHost(url?: string): string {
    if (!url) return '';

    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

function isSameHost(savedHost: string, currentHost: string): boolean {
    const normalizedSaved = savedHost.trim().toLowerCase();
    const normalizedCurrent = currentHost.trim().toLowerCase();
    return !!normalizedSaved && (normalizedSaved === normalizedCurrent || normalizedCurrent.endsWith(`.${normalizedSaved}`));
}

const rootElement = document.getElementById('root');

if (rootElement) {
    createRoot(rootElement).render(<PopupApp />);
}

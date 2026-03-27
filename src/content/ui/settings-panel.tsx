import {
    Bot,
    Bug,
    Check,
    Cloud,
    Eye,
    EyeOff,
    Globe2,
    KeyRound,
    Languages,
    Link2,
    LoaderCircle,
    Palette,
    RefreshCw,
    Save,
    ShieldCheck,
    Sparkles,
    X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { DEV_MODE } from '../../config/app-config';
import { normalizeSettings } from '../../config/default-settings';
import type { Settings } from '../../types';
import { showToast } from '@/content/ui/toast';
import { DropdownSelect } from '../../shared/ui/dropdown-select';
import { ProviderGlyph } from '../../shared/ui/provider-glyph';
import {
    DEV_PHASE_OPTIONS,
    OCR_ENGINE_OPTIONS,
    SITE_POLICY_OPTIONS,
    SOURCE_LANGUAGE_OPTIONS,
    TARGET_LANGUAGE_OPTIONS,
    TRANSLATION_ENGINE_OPTIONS,
} from '../../shared/ui-options';

interface SettingsPanelOptions {
    onSave: (settings: Settings) => void;
    onClose: () => void;
}

interface InlineState {
    tone: 'info' | 'success' | 'error';
    message: string;
}

interface SettingsPanelViewProps {
    visible: boolean;
    initialSettings: Settings;
    renderKey: number;
    showDevTools: boolean;
    onClose: () => void;
    onSave: (settings: Settings) => void;
}

export class SettingsPanel {
    private readonly options: SettingsPanelOptions;
    private element: HTMLElement | null = null;
    private root: Root | null = null;
    private isVisible = false;
    private renderKey = 0;
    private currentSettings = normalizeSettings();

    constructor(options: SettingsPanelOptions) {
        this.options = options;
        this.createElement();
        this.render();
    }

    show(): void {
        void this.open();
    }

    hide(): void {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.render();
        this.options.onClose();
    }

    private async open(): Promise<void> {
        const nextSettings = await this.loadSettings();
        if (!nextSettings) return;

        this.currentSettings = nextSettings;
        this.isVisible = true;
        this.renderKey += 1;
        this.render();
    }

    private createElement(): void {
        const element = document.createElement('div');
        element.id = 'manga-flow-settings-root';
        element.className = 'manga-flow-settings-root';
        document.body.appendChild(element);

        this.element = element;
        this.root = createRoot(element);
    }

    private render(): void {
        if (!this.root) return;

        this.root.render(
            <SettingsPanelView
                visible={this.isVisible}
                initialSettings={this.currentSettings}
                renderKey={this.renderKey}
                showDevTools={DEV_MODE}
                onClose={() => this.hide()}
                onSave={(settings) => {
                    this.options.onSave(settings);
                    this.hide();
                }}
            />
        );
    }

    private async loadSettings(): Promise<Settings | null> {
        if (!chrome?.runtime?.id) {
            console.warn('[MangaFlow] 扩展上下文已失效，无法读取设置');
            showToast('扩展上下文已失效，请刷新页面后重试', 'warning');
            return null;
        }

        try {
            const result = await chrome.storage.local.get('settings');
            return normalizeSettings(result.settings as Partial<Settings> | undefined);
        } catch (error) {
            console.error('[MangaFlow] 读取设置失败:', error);
            showToast('读取设置失败，请稍后再试', 'error');
            return null;
        }
    }
}

function SettingsPanelView({
    visible,
    initialSettings,
    renderKey,
    showDevTools,
    onClose,
    onSave,
}: SettingsPanelViewProps) {
    const [form, setForm] = useState<Settings>(initialSettings);
    const [whitelistText, setWhitelistText] = useState(() => formatWhitelist(initialSettings.siteWhitelist));
    const [testState, setTestState] = useState<InlineState | null>(null);
    const [modelState, setModelState] = useState<InlineState | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [modelOptions, setModelOptions] = useState<string[]>(() => getInitialModelOptions(initialSettings.model));
    const [showApiKey, setShowApiKey] = useState(false);
    const [showDeepLKey, setShowDeepLKey] = useState(false);
    const [showCloudOcrKey, setShowCloudOcrKey] = useState(false);

    useEffect(() => {
        setForm(initialSettings);
        setWhitelistText(formatWhitelist(initialSettings.siteWhitelist));
        setTestState(null);
        setModelState(null);
        setModelOptions(getInitialModelOptions(initialSettings.model));
        setShowApiKey(false);
        setShowDeepLKey(false);
        setShowCloudOcrKey(false);
    }, [initialSettings, renderKey]);

    useEffect(() => {
        if (!visible) return;

        const handleEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose, visible]);

    const apiPreview = useMemo(
        () => buildChatCompletionsPreview(form.apiBaseUrl),
        [form.apiBaseUrl]
    );

    if (!visible) return null;

    const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setForm((currentForm) => ({
            ...currentForm,
            [key]: value,
        }));

        if (key === 'translateEngine') {
            setTestState(null);
            setModelState(null);
        }
    };

    const handleTestService = async () => {
        setIsTesting(true);
        setTestState({ tone: 'info', message: '正在测试当前翻译服务…' });

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'TEST_TRANSLATION',
                engine: form.translateEngine,
                text: 'Hello',
                settings: {
                    sourceLang: form.sourceLang,
                    targetLang: form.targetLang,
                    apiBaseUrl: form.apiBaseUrl,
                    apiKey: form.apiKey,
                    model: form.model,
                    deeplxUrl: form.deeplxUrl,
                    deeplApiKey: form.deeplApiKey,
                },
            });

            if (response?.success) {
                setTestState({
                    tone: 'success',
                    message: `测试成功：${response.translated}`,
                });
                return;
            }

            setTestState({
                tone: 'error',
                message: `测试失败：${response?.error || '未知错误'}`,
            });
        } catch (error) {
            setTestState({
                tone: 'error',
                message: `测试失败：${(error as Error).message}`,
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleFetchModels = async () => {
        if (!form.apiBaseUrl || !form.apiKey) {
            setModelState({ tone: 'error', message: '请先填写 API 地址和 API Key。' });
            return;
        }

        setIsFetchingModels(true);
        setModelState({ tone: 'info', message: '正在获取模型列表…' });

        try {
            const baseUrl = form.apiBaseUrl.replace(/\/$/, '');
            const response = await chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                url: `${baseUrl}/models`,
                options: {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${form.apiKey}`,
                    },
                },
            });

            if (!response?.success) {
                throw new Error(response?.error || '获取模型列表失败');
            }

            const fetchedModels = (response.data?.data || [])
                .map((item: { id?: string }) => item?.id)
                .filter((value: string | undefined): value is string => Boolean(value))
                .sort((left: string, right: string) => left.localeCompare(right));

            const nextModelOptions = mergeModelOptions(fetchedModels, form.model);
            setModelOptions(nextModelOptions);
            setModelState({
                tone: 'success',
                message: fetchedModels.length > 0
                    ? `已获取 ${fetchedModels.length} 个模型，可直接点选。`
                    : '接口可用，但未返回可选模型。',
            });
        } catch (error) {
            console.error('[MangaFlow] 获取模型列表失败:', error);
            setModelState({ tone: 'error', message: `获取失败：${(error as Error).message}` });
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleSave = () => {
        const fontScale = clampNumber(form.fontScale ?? 1, 0.85, 1.2);
        const maskOpacity = clampNumber(form.maskOpacity ?? 0.24, 0.15, 0.55);
        const requestDelay = Math.max(0, Number(form.requestDelay) || 0);

        const nextSettings = normalizeSettings({
            ...form,
            fontScale,
            fontSize: Math.round(fontScale * 14),
            maskOpacity,
            requestDelay,
            siteWhitelist: parseWhitelist(whitelistText),
            model: form.model.trim(),
            apiBaseUrl: form.apiBaseUrl.trim(),
            apiKey: form.apiKey.trim(),
            deeplxUrl: form.deeplxUrl.trim(),
            deeplApiKey: form.deeplApiKey.trim(),
            cloudOcrKey: form.cloudOcrKey.trim(),
        });

        onSave(nextSettings);
    };

    return (
        <div className="manga-flow-settings manga-flow-settings--visible" aria-hidden={false}>
            <div className="manga-flow-settings__overlay" onClick={onClose} />

            <div
                className="manga-flow-settings__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="manga-flow-settings-title"
            >
                <header className="manga-flow-settings__header">
                    <div className="manga-flow-settings__header-copy">
                        <span className="manga-flow-settings__eyebrow">MangaFlow Settings</span>
                        <h2 id="manga-flow-settings-title">设置面板</h2>
                        <p>先完成 Popup 主控，再在这里维护翻译 / OCR / 显示细节。</p>
                    </div>

                    <button
                        type="button"
                        className="manga-flow-settings__icon-btn"
                        aria-label="关闭设置面板"
                        onClick={onClose}
                    >
                        <X size={18} strokeWidth={1.9} />
                    </button>
                </header>

                <div className="manga-flow-settings__content">
                    <SettingsSection
                        icon={<Languages size={18} strokeWidth={1.9} />}
                        title="语言设置"
                        description="保持与 Popup 一致，保存后立即影响当前运行逻辑。"
                    >
                        <div className="manga-flow-settings__grid manga-flow-settings__grid--two">
                            <Field label="原文语言">
                                <DropdownSelect
                                    value={form.sourceLang}
                                    options={SOURCE_LANGUAGE_OPTIONS}
                                    ariaLabel="原文语言"
                                    onChange={(value) => updateField('sourceLang', value)}
                                    renderSelected={(option) => (
                                        <SelectSummary
                                            title={option.label}
                                            description={option.description}
                                            badge={option.shortLabel}
                                        />
                                    )}
                                    renderOptionLeading={(option) => (
                                        <span className="manga-flow-settings__mini-badge">{option.shortLabel}</span>
                                    )}
                                />
                            </Field>

                            <Field label="目标语言">
                                <DropdownSelect
                                    value={form.targetLang}
                                    options={TARGET_LANGUAGE_OPTIONS}
                                    ariaLabel="目标语言"
                                    onChange={(value) => updateField('targetLang', value)}
                                    renderSelected={(option) => (
                                        <SelectSummary
                                            title={option.label}
                                            description={option.description}
                                            badge={option.shortLabel}
                                        />
                                    )}
                                    renderOptionLeading={(option) => (
                                        <span className="manga-flow-settings__mini-badge">{option.shortLabel}</span>
                                    )}
                                />
                            </Field>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        icon={<Sparkles size={18} strokeWidth={1.9} />}
                        title="翻译服务"
                        description="这里集中处理引擎切换、接口测试、模型列表与 RPM 节流。"
                    >
                        <div className="manga-flow-settings__stack">
                            <Field label="翻译引擎">
                                <DropdownSelect
                                    value={form.translateEngine}
                                    options={TRANSLATION_ENGINE_OPTIONS}
                                    ariaLabel="翻译引擎"
                                    onChange={(value) => updateField('translateEngine', value)}
                                    renderSelected={(option) => (
                                        <div className="manga-flow-settings__provider-select">
                                            <ProviderGlyph provider={option.value} />
                                            <div className="manga-flow-settings__select-copy">
                                                <span>{option.label}</span>
                                                <small>{option.description}</small>
                                            </div>
                                        </div>
                                    )}
                                    renderOptionLeading={(option) => <ProviderGlyph provider={option.value} />}
                                />
                            </Field>

                            <div className="manga-flow-settings__grid manga-flow-settings__grid--action">
                                <Field
                                    label="请求间隔（毫秒）"
                                    helper="用于有 RPM 限制的服务，0 表示不额外延迟。"
                                >
                                    <input
                                        className="manga-flow-settings__input"
                                        type="number"
                                        min={0}
                                        step={100}
                                        value={form.requestDelay ?? 0}
                                        onChange={(event) => updateField('requestDelay', Number(event.target.value) || 0)}
                                    />
                                </Field>

                                <Field label="服务连通性">
                                    <div className="manga-flow-settings__inline-actions">
                                        <button
                                            type="button"
                                            className="mf-button mf-button--secondary"
                                            onClick={() => void handleTestService()}
                                            disabled={isTesting}
                                        >
                                            {isTesting ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                            <span>测试服务</span>
                                        </button>

                                        {testState ? <InlineStatus state={testState} /> : null}
                                    </div>
                                </Field>
                            </div>

                            {form.translateEngine === 'openai' ? (
                                <div className="manga-flow-settings__subcard">
                                    <div className="manga-flow-settings__subcard-head">
                                        <div>
                                            <h4>OpenAI 兼容 API</h4>
                                            <p>适配 GPT / DeepSeek / Qwen 等兼容 chat/completions 的接口。</p>
                                        </div>
                                        <Bot size={18} strokeWidth={1.9} />
                                    </div>

                                    <div className="manga-flow-settings__stack">
                                        <Field
                                            label="API 地址"
                                            helper={`预览：${apiPreview}`}
                                        >
                                            <input
                                                className="manga-flow-settings__input"
                                                type="text"
                                                placeholder="例如：https://example.com/v1"
                                                value={form.apiBaseUrl}
                                                onChange={(event) => updateField('apiBaseUrl', event.target.value)}
                                            />
                                        </Field>

                                        <Field label="API Key">
                                            <PasswordField
                                                value={form.apiKey}
                                                visible={showApiKey}
                                                placeholder="例如：sk-..."
                                                onToggleVisibility={() => setShowApiKey((currentValue) => !currentValue)}
                                                onChange={(value) => updateField('apiKey', value)}
                                            />
                                        </Field>

                                        <div className="manga-flow-settings__grid manga-flow-settings__grid--action">
                                            <Field
                                                label="模型名称"
                                                helper="可手动输入，也可点击获取模型列表后直接点选。"
                                            >
                                                <input
                                                    className="manga-flow-settings__input"
                                                    type="text"
                                                    placeholder="例如：gpt-4o-mini / deepseek-chat"
                                                    value={form.model}
                                                    onChange={(event) => updateField('model', event.target.value)}
                                                />
                                            </Field>

                                            <Field label="模型列表">
                                                <div className="manga-flow-settings__inline-actions">
                                                    <button
                                                        type="button"
                                                        className="mf-button mf-button--ghost"
                                                        onClick={() => void handleFetchModels()}
                                                        disabled={isFetchingModels}
                                                    >
                                                        {isFetchingModels ? <LoaderCircle className="mf-button__spinner" size={15} /> : <KeyRound size={15} strokeWidth={1.8} />}
                                                        <span>获取模型</span>
                                                    </button>
                                                    {modelState ? <InlineStatus state={modelState} /> : null}
                                                </div>
                                            </Field>
                                        </div>

                                        {modelOptions.length > 0 ? (
                                            <Field label="快速选择">
                                                <div className="manga-flow-settings__chips">
                                                    {modelOptions.map((option) => (
                                                        <button
                                                            key={option}
                                                            type="button"
                                                            className={`manga-flow-settings__chip ${option === form.model ? 'is-active' : ''}`.trim()}
                                                            onClick={() => updateField('model', option)}
                                                        >
                                                            {option}
                                                        </button>
                                                    ))}
                                                </div>
                                            </Field>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}

                            {form.translateEngine === 'deeplx' ? (
                                <div className="manga-flow-settings__subcard">
                                    <div className="manga-flow-settings__subcard-head">
                                        <div>
                                            <h4>DeepLX 配置</h4>
                                            <p>填写完整的服务地址，例如带上访问密钥后的 translate 路径。</p>
                                        </div>
                                        <Link2 size={18} strokeWidth={1.9} />
                                    </div>

                                    <Field
                                        label="DeepLX 服务地址"
                                        helper="示例：https://api.deeplx.org/YOUR_KEY/translate"
                                    >
                                        <input
                                            className="manga-flow-settings__input"
                                            type="text"
                                            placeholder="请输入完整 DeepLX URL"
                                            value={form.deeplxUrl}
                                            onChange={(event) => updateField('deeplxUrl', event.target.value)}
                                        />
                                    </Field>
                                </div>
                            ) : null}

                            {form.translateEngine === 'deepl' ? (
                                <div className="manga-flow-settings__subcard">
                                    <div className="manga-flow-settings__subcard-head">
                                        <div>
                                            <h4>DeepL 官方 API</h4>
                                            <p>填写官方 Key，默认使用免费端点 `api-free.deepl.com`。</p>
                                        </div>
                                        <Globe2 size={18} strokeWidth={1.9} />
                                    </div>

                                    <Field label="DeepL API Key">
                                        <PasswordField
                                            value={form.deeplApiKey}
                                            visible={showDeepLKey}
                                            placeholder="例如：xxxxxxx:fx"
                                            onToggleVisibility={() => setShowDeepLKey((currentValue) => !currentValue)}
                                            onChange={(value) => updateField('deeplApiKey', value)}
                                        />
                                    </Field>
                                </div>
                            ) : null}
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        icon={<Cloud size={18} strokeWidth={1.9} />}
                        title="OCR 配置"
                        description="当前先保留本地 / Google Cloud Vision 两条链路，后续再接本地服务。"
                    >
                        <div className="manga-flow-settings__stack">
                            <Field label="OCR 引擎">
                                <DropdownSelect
                                    value={form.ocrEngine}
                                    options={OCR_ENGINE_OPTIONS}
                                    ariaLabel="OCR 引擎"
                                    onChange={(value) => updateField('ocrEngine', value)}
                                    renderSelected={(option) => (
                                        <div className="manga-flow-settings__select-copy">
                                            <span>{option.label}</span>
                                            <small>{option.description}</small>
                                        </div>
                                    )}
                                />
                            </Field>

                            {form.ocrEngine === 'cloud' ? (
                                <div className="manga-flow-settings__subcard">
                                    <div className="manga-flow-settings__subcard-head">
                                        <div>
                                            <h4>Google Cloud Vision</h4>
                                            <p>填写 API Key 后即可走云端 OCR。注意额度和风控限制。</p>
                                        </div>
                                        <Cloud size={18} strokeWidth={1.9} />
                                    </div>

                                    <Field
                                        label="Cloud Vision API Key"
                                        helper="可在 Google Cloud Console 中创建凭据并启用 Vision API。"
                                    >
                                        <PasswordField
                                            value={form.cloudOcrKey}
                                            visible={showCloudOcrKey}
                                            placeholder="请输入 Google Cloud Vision API Key"
                                            onToggleVisibility={() => setShowCloudOcrKey((currentValue) => !currentValue)}
                                            onChange={(value) => updateField('cloudOcrKey', value)}
                                        />
                                    </Field>
                                </div>
                            ) : null}
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        icon={<Palette size={18} strokeWidth={1.9} />}
                        title="显示设置"
                        description="先收敛成一套统一字体 / 滑杆 / 颜色输入样式，后续再继续优化渲染策略。"
                    >
                        <div className="manga-flow-settings__stack">
                            <SliderField
                                label="译文字体倍率"
                                valueLabel={`${Math.round((form.fontScale ?? 1) * 100)}%`}
                                helper="用于控制最终译文显示字号，保存后会换算回 fontSize。"
                            >
                                <input
                                    className="manga-flow-settings__range"
                                    type="range"
                                    min={85}
                                    max={120}
                                    step={1}
                                    value={Math.round((form.fontScale ?? 1) * 100)}
                                    onChange={(event) => updateField('fontScale', Number(event.target.value) / 100)}
                                />
                            </SliderField>

                            <div className="manga-flow-settings__grid manga-flow-settings__grid--action">
                                <Field label="译文字体颜色">
                                    <div className="manga-flow-settings__color-row">
                                        <input
                                            className="manga-flow-settings__color-picker"
                                            type="color"
                                            value={form.fontColor}
                                            onChange={(event) => updateField('fontColor', event.target.value)}
                                        />
                                        <input
                                            className="manga-flow-settings__input"
                                            type="text"
                                            value={form.fontColor}
                                            onChange={(event) => updateField('fontColor', event.target.value)}
                                        />
                                    </div>
                                </Field>

                                <SliderField
                                    label="遮罩透明度"
                                    valueLabel={(form.maskOpacity ?? 0.24).toFixed(2)}
                                    helper="当前仍会影响本地擦除层透明度。"
                                >
                                    <input
                                        className="manga-flow-settings__range"
                                        type="range"
                                        min={0.15}
                                        max={0.55}
                                        step={0.01}
                                        value={form.maskOpacity ?? 0.24}
                                        onChange={(event) => updateField('maskOpacity', Number(event.target.value))}
                                    />
                                </SliderField>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        icon={<ShieldCheck size={18} strokeWidth={1.9} />}
                        title="站点策略"
                        description="配合 v0.7.1 贴边悬浮球策略，控制何时在页面上显示入口。"
                    >
                        <div className="manga-flow-settings__stack">
                            <Field label="悬浮球显示策略">
                                <DropdownSelect
                                    value={form.sitePolicy ?? 'auto_detect'}
                                    options={SITE_POLICY_OPTIONS}
                                    ariaLabel="悬浮球显示策略"
                                    onChange={(value) => updateField('sitePolicy', value)}
                                    renderSelected={(option) => (
                                        <div className="manga-flow-settings__select-copy">
                                            <span>{option.label}</span>
                                            <small>{option.description}</small>
                                        </div>
                                    )}
                                />
                            </Field>

                            <Field
                                label="白名单域名"
                                helper="每行一个域名，例如：example.com。仅在“仅白名单站点”模式下生效。"
                            >
                                <textarea
                                    className="manga-flow-settings__textarea"
                                    rows={5}
                                    value={whitelistText}
                                    disabled={(form.sitePolicy ?? 'auto_detect') !== 'whitelist_only'}
                                    onChange={(event) => setWhitelistText(event.target.value)}
                                    placeholder={'mangadex.org\nexample.com'}
                                />
                            </Field>
                        </div>
                    </SettingsSection>

                    {showDevTools ? (
                        <SettingsSection
                            icon={<Bug size={18} strokeWidth={1.9} />}
                            title="开发模式"
                            description="仅调试用，便于逐阶段观察 ROI / OCR / 渲染状态。"
                        >
                            <div className="manga-flow-settings__stack">
                                <SwitchField
                                    label="启用开发模式"
                                    description="关闭后将禁用阶段选择与调试覆盖层配置。"
                                    checked={form.devMode ?? true}
                                    onChange={(value) => updateField('devMode', value)}
                                />

                                <Field label="执行阶段">
                                    <DropdownSelect
                                        value={form.devPhase ?? 'roi'}
                                        options={DEV_PHASE_OPTIONS}
                                        ariaLabel="执行阶段"
                                        onChange={(value) => updateField('devPhase', value)}
                                        disabled={!(form.devMode ?? true)}
                                        renderSelected={(option) => (
                                            <div className="manga-flow-settings__select-copy">
                                                <span>{option.label}</span>
                                                <small>{option.description}</small>
                                            </div>
                                        )}
                                    />
                                </Field>

                                <div className="manga-flow-settings__checks">
                                    <CheckboxField
                                        label="显示 OCR 红框"
                                        checked={form.showOcrBoxes ?? true}
                                        onChange={(value) => updateField('showOcrBoxes', value)}
                                    />
                                    <CheckboxField
                                        label="显示 ROI 橙框"
                                        checked={form.showRoiBoxes ?? true}
                                        onChange={(value) => updateField('showRoiBoxes', value)}
                                    />
                                    <CheckboxField
                                        label="显示遮罩绿框"
                                        checked={form.showMaskBoxes ?? false}
                                        onChange={(value) => updateField('showMaskBoxes', value)}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                    ) : null}
                </div>

                <footer className="manga-flow-settings__footer">
                    <button type="button" className="mf-button mf-button--secondary" onClick={onClose}>
                        取消
                    </button>
                    <button type="button" className="mf-button mf-button--primary" onClick={handleSave}>
                        <Save size={15} strokeWidth={1.9} />
                        <span>保存设置</span>
                    </button>
                </footer>
            </div>
        </div>
    );
}

function SettingsSection({
    icon,
    title,
    description,
    children,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section className="manga-flow-settings__section">
            <div className="manga-flow-settings__section-head">
                <div className="manga-flow-settings__section-icon">{icon}</div>
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function Field({
    label,
    helper,
    children,
}: {
    label: string;
    helper?: string;
    children: ReactNode;
}) {
    return (
        <div className="manga-flow-settings__field">
            <label className="manga-flow-settings__label">{label}</label>
            {children}
            {helper ? <p className="manga-flow-settings__helper">{helper}</p> : null}
        </div>
    );
}

function SelectSummary({
    title,
    description,
    badge,
}: {
    title: string;
    description?: string;
    badge?: string;
}) {
    return (
        <div className="manga-flow-settings__select-copy manga-flow-settings__select-copy--with-badge">
            {badge ? <span className="manga-flow-settings__mini-badge">{badge}</span> : null}
            <div className="manga-flow-settings__select-copy">
                <span>{title}</span>
                {description ? <small>{description}</small> : null}
            </div>
        </div>
    );
}

function PasswordField({
    value,
    visible,
    placeholder,
    onToggleVisibility,
    onChange,
}: {
    value: string;
    visible: boolean;
    placeholder: string;
    onToggleVisibility: () => void;
    onChange: (value: string) => void;
}) {
    return (
        <div className="manga-flow-settings__password">
            <input
                className="manga-flow-settings__input"
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            <button
                type="button"
                className="manga-flow-settings__password-toggle"
                aria-label={visible ? '隐藏密钥' : '显示密钥'}
                onClick={onToggleVisibility}
            >
                {visible ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
            </button>
        </div>
    );
}

function SliderField({
    label,
    valueLabel,
    helper,
    children,
}: {
    label: string;
    valueLabel: string;
    helper?: string;
    children: ReactNode;
}) {
    return (
        <div className="manga-flow-settings__field">
            <div className="manga-flow-settings__label-row">
                <label className="manga-flow-settings__label">{label}</label>
                <span className="manga-flow-settings__value-pill">{valueLabel}</span>
            </div>
            {children}
            {helper ? <p className="manga-flow-settings__helper">{helper}</p> : null}
        </div>
    );
}

function SwitchField({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="manga-flow-settings__switch-row">
            <div className="manga-flow-settings__switch-copy">
                <span>{label}</span>
                <small>{description}</small>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={checked}
                className={`manga-flow-settings__switch ${checked ? 'is-checked' : ''}`.trim()}
                onClick={() => onChange(!checked)}
            >
                <span className="manga-flow-settings__switch-thumb" />
            </button>
        </div>
    );
}

function CheckboxField({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <label className="manga-flow-settings__checkbox">
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span className="manga-flow-settings__checkbox-box">
                <Check size={12} strokeWidth={2.4} />
            </span>
            <span>{label}</span>
        </label>
    );
}

function InlineStatus({ state }: { state: InlineState }) {
    return (
        <div className={`manga-flow-settings__inline-status manga-flow-settings__inline-status--${state.tone}`.trim()}>
            <span>{state.message}</span>
        </div>
    );
}

function formatWhitelist(whitelist?: string[]): string {
    return Array.isArray(whitelist) ? whitelist.join('\n') : '';
}

function parseWhitelist(rawValue: string): string[] {
    return rawValue
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function getInitialModelOptions(savedModel: string): string[] {
    return savedModel ? [savedModel] : [];
}

function mergeModelOptions(fetchedModels: string[], selectedModel: string): string[] {
    return Array.from(new Set([selectedModel, ...fetchedModels].filter(Boolean)));
}

function buildChatCompletionsPreview(baseUrl: string): string {
    const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
    return normalizedBase ? `${normalizedBase}/chat/completions` : '/chat/completions';
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

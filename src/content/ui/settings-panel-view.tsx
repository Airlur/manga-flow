import {
    AlertCircle,
    Bug,
    CircleCheck,
    Cloud,
    Download,
    LayoutGrid,
    LoaderCircle,
    Palette,
    RefreshCw,
    RotateCcw,
    ScanText,
    Save,
    ShieldCheck,
    Sparkles,
    Trash2,
    Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { createOpenAIProvider, DEFAULT_PADDLE_OCR_SERVER_URL, normalizeSettings } from '../../config/default-settings';
import { normalizeWebDAVConfig } from '../../config/webdav-defaults';
import type { OpenAIProvider, Settings, SyncSnapshot, WebDAVBackupItem, WebDAVConfig } from '../../types';
import { DropdownSelect } from '../../shared/ui/dropdown-select';
import { OcrEngineLogo } from '../../shared/ui/ocr-engine-logo';
import {
    DEV_PHASE_OPTIONS,
    OCR_ENGINE_OPTIONS,
    SITE_POLICY_OPTIONS,
    SOURCE_LANGUAGE_OPTIONS,
    TARGET_LANGUAGE_OPTIONS,
    TRANSLATION_ENGINE_OPTIONS,
} from '../../shared/ui-options';
import { PopupProviderLogo } from '../../popup/provider-logo';
import { showToast } from './toast';
import { OpenAIProviderManager, type ProviderFeedbackState } from './openai-provider-manager';
import {
    CheckboxField,
    Field,
    InfoBlock,
    InlineStatus,
    type InlineState,
    PaneSection,
    PasswordField,
    SliderField,
    SwitchField,
    TabIntro,
} from './settings-panel-controls';

type SettingsTabId = 'general' | 'ocr' | 'translate' | 'display' | 'site' | 'sync' | 'dev';

interface SettingsPanelViewProps {
    visible: boolean;
    initialSettings: Settings;
    initialWebDAVConfig: WebDAVConfig;
    renderKey: number;
    showDevTools: boolean;
    onClose: () => void;
    onClearOCRCache: () => Promise<void>;
    onClearTranslationCache: () => Promise<void>;
    onSaveWebDAVConfig: (config: WebDAVConfig) => Promise<void>;
    onTestWebDAV: (config: WebDAVConfig) => Promise<void>;
    onPushWebDAV: (config: WebDAVConfig, settings: Settings) => Promise<{ fileName: string }>;
    onPullWebDAV: (config: WebDAVConfig) => Promise<SyncSnapshot>;
    onListWebDAVBackups: (config: WebDAVConfig) => Promise<WebDAVBackupItem[]>;
    onRestoreWebDAVBackup: (config: WebDAVConfig, fileName: string) => Promise<SyncSnapshot>;
    onDeleteWebDAVBackup: (config: WebDAVConfig, fileName: string) => Promise<void>;
    onSave: (settings: Settings) => void | Promise<void>;
}

interface SettingsTabItem {
    id: SettingsTabId;
    label: string;
    icon: ReactNode;
}

export function SettingsPanelView({
    visible,
    initialSettings,
    initialWebDAVConfig,
    renderKey,
    showDevTools,
    onClose,
    onClearOCRCache,
    onClearTranslationCache,
    onSaveWebDAVConfig,
    onTestWebDAV,
    onPushWebDAV,
    onPullWebDAV,
    onListWebDAVBackups,
    onRestoreWebDAVBackup,
    onDeleteWebDAVBackup,
    onSave,
}: SettingsPanelViewProps) {
    const [activeTab, setActiveTab] = useState<SettingsTabId>('general');
    const [form, setForm] = useState<Settings>(initialSettings);
    const [whitelistText, setWhitelistText] = useState(() => formatWhitelist(initialSettings.siteWhitelist));
    const [serviceTestState, setServiceTestState] = useState<InlineState | null>(null);
    const [providerFeedback, setProviderFeedback] = useState<Record<string, ProviderFeedbackState>>({});
    const [isTestingService, setIsTestingService] = useState(false);
    const [loadingProviderModels, setLoadingProviderModels] = useState<Record<string, boolean>>({});
    const [testingProviders, setTestingProviders] = useState<Record<string, boolean>>({});
    const [selectedProviderId, setSelectedProviderId] = useState<string>(initialSettings.openaiProviders?.[0]?.id || '');
    const [manualModelName, setManualModelName] = useState('');
    const [modelQuery, setModelQuery] = useState('');
    const [showDeepLKey, setShowDeepLKey] = useState(false);
    const [showCloudOcrKey, setShowCloudOcrKey] = useState(false);
    const [autoFetchSignatures, setAutoFetchSignatures] = useState<Record<string, string>>({});
    const [paddleServiceState, setPaddleServiceState] = useState<InlineState | null>(null);
    const [isCheckingPaddleService, setIsCheckingPaddleService] = useState(false);
    const [autoCheckPaddleSignature, setAutoCheckPaddleSignature] = useState('');
    const [isClearingOcrCache, setIsClearingOcrCache] = useState(false);
    const [isClearingTranslationCache, setIsClearingTranslationCache] = useState(false);
    const [webdavForm, setWebdavForm] = useState<WebDAVConfig>(initialWebDAVConfig);
    const [webdavView, setWebdavView] = useState<'config' | 'history'>('config');
    const [showWebDAVPassword, setShowWebDAVPassword] = useState(false);
    const [isTestingWebDAV, setIsTestingWebDAV] = useState(false);
    const [isPushingWebDAV, setIsPushingWebDAV] = useState(false);
    const [isPullingWebDAV, setIsPullingWebDAV] = useState(false);
    const [isLoadingWebDAVHistory, setIsLoadingWebDAVHistory] = useState(false);
    const [webdavHistory, setWebdavHistory] = useState<WebDAVBackupItem[]>([]);
    const [webdavStatus, setWebdavStatus] = useState<InlineState | null>(null);
    const [activeWebDAVBackupFile, setActiveWebDAVBackupFile] = useState('');

    useEffect(() => {
        const nextSettings = normalizeSettings(initialSettings);
        setActiveTab('general');
        setForm(nextSettings);
        setWebdavForm(normalizeWebDAVConfig(initialWebDAVConfig));
        setWebdavView('config');
        setWhitelistText(formatWhitelist(nextSettings.siteWhitelist));
        setServiceTestState(null);
        setProviderFeedback({});
        setLoadingProviderModels({});
        setTestingProviders({});
        setSelectedProviderId(nextSettings.openaiProviders?.[0]?.id || '');
        setManualModelName('');
        setModelQuery('');
        setShowDeepLKey(false);
        setShowCloudOcrKey(false);
        setAutoFetchSignatures({});
        setPaddleServiceState(null);
        setIsCheckingPaddleService(false);
        setAutoCheckPaddleSignature('');
        setIsClearingOcrCache(false);
        setIsClearingTranslationCache(false);
        setShowWebDAVPassword(false);
        setIsTestingWebDAV(false);
        setIsPushingWebDAV(false);
        setIsPullingWebDAV(false);
        setIsLoadingWebDAVHistory(false);
        setWebdavHistory([]);
        setWebdavStatus(null);
        setActiveWebDAVBackupFile('');
    }, [initialSettings, initialWebDAVConfig, renderKey]);

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

    useEffect(() => {
        if (!showDevTools && activeTab === 'dev') {
            setActiveTab('general');
        }
    }, [activeTab, showDevTools]);

    const tabs = useMemo<SettingsTabItem[]>(() => {
        const baseTabs: SettingsTabItem[] = [
            { id: 'general', label: '常规', icon: <LayoutGrid size={16} strokeWidth={1.9} /> },
            { id: 'ocr', label: 'OCR', icon: <ScanText size={16} strokeWidth={1.9} /> },
            { id: 'translate', label: '翻译', icon: <Sparkles size={16} strokeWidth={1.9} /> },
            { id: 'display', label: '显示', icon: <Palette size={16} strokeWidth={1.9} /> },
            { id: 'site', label: '站点', icon: <ShieldCheck size={16} strokeWidth={1.9} /> },
            { id: 'sync', label: '同步', icon: <Cloud size={16} strokeWidth={1.9} /> },
        ];

        if (showDevTools) {
            baseTabs.push({ id: 'dev', label: '开发', icon: <Bug size={16} strokeWidth={1.9} /> });
        }

        return baseTabs;
    }, [showDevTools]);

    const currentProvider = useMemo(
        () => form.openaiProviders?.find((provider) => provider.id === selectedProviderId) ?? form.openaiProviders?.[0] ?? null,
        [form.openaiProviders, selectedProviderId]
    );

    useEffect(() => {
        if (currentProvider && selectedProviderId !== currentProvider.id) {
            setSelectedProviderId(currentProvider.id);
        }
    }, [currentProvider, selectedProviderId]);

    const currentProviderPreview = useMemo(
        () => buildChatCompletionsPreview(currentProvider?.apiBaseUrl || ''),
        [currentProvider?.apiBaseUrl]
    );

    useEffect(() => {
        if (form.translateEngine !== 'openai' || !currentProvider) return;

        const baseUrl = currentProvider.apiBaseUrl.trim();
        const apiKey = currentProvider.apiKey.trim();
        if (!baseUrl || !apiKey) return;

        const signature = `${baseUrl.replace(/\/+$/, '')}::${apiKey}`;
        if (autoFetchSignatures[currentProvider.id] === signature) return;

        const timer = window.setTimeout(() => {
            void fetchProviderModels(currentProvider.id, 'auto', signature);
        }, 650);

        return () => window.clearTimeout(timer);
    }, [
        form.translateEngine,
        currentProvider?.id,
        currentProvider?.apiBaseUrl,
        currentProvider?.apiKey,
        autoFetchSignatures,
    ]);

    useEffect(() => {
        if (!visible || form.ocrEngine !== 'paddle_local') return;

        const normalizedUrl = normalizePaddleServerUrl(form.paddleOcrServerUrl);
        if (!normalizedUrl || autoCheckPaddleSignature === normalizedUrl) return;

        const timer = window.setTimeout(() => {
            void checkPaddleService('auto', normalizedUrl);
        }, 280);

        return () => window.clearTimeout(timer);
    }, [visible, form.ocrEngine, form.paddleOcrServerUrl, autoCheckPaddleSignature]);

    useEffect(() => {
        if (!visible || activeTab !== 'sync' || webdavView !== 'history') return;
        void refreshWebDAVHistory(false);
    }, [visible, activeTab, webdavView]);

    if (!visible) return null;

    const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setForm((currentForm) => normalizeSettings({
            ...currentForm,
            [key]: value,
        }));

        if (key === 'translateEngine') {
            setServiceTestState(null);
        }

        if (key === 'ocrEngine' && value !== 'paddle_local') {
            setPaddleServiceState(null);
        }
    };

    const updateProvider = (
        providerId: string,
        patch: Partial<OpenAIProvider> | ((provider: OpenAIProvider) => OpenAIProvider)
    ) => {
        setForm((currentForm) => {
            const nextProviders = (currentForm.openaiProviders || []).map((provider, index) => {
                if (provider.id !== providerId) return provider;
                const nextProvider = typeof patch === 'function' ? patch(provider) : { ...provider, ...patch };
                return createOpenAIProvider(nextProvider, index);
            });

            return normalizeSettings({
                ...currentForm,
                openaiProviders: nextProviders,
            });
        });
    };

    const setProviderState = (providerId: string, key: keyof ProviderFeedbackState, value: InlineState | null) => {
        setProviderFeedback((current) => ({
            ...current,
            [providerId]: {
                ...current[providerId],
                [key]: value,
            },
        }));
    };

    const addProvider = () => {
        const index = form.openaiProviders?.length || 0;
        const nextProvider = createOpenAIProvider({
            id: `openai-provider-${Date.now()}-${index + 1}`,
            name: `服务商 ${index + 1}`,
        }, index);

        setSelectedProviderId(nextProvider.id);
        setForm((currentForm) => normalizeSettings({
            ...currentForm,
            openaiProviders: [...(currentForm.openaiProviders || []), nextProvider],
        }));
    };

    const moveProvider = (providerId: string, direction: -1 | 1) => {
        setForm((currentForm) => {
            const providers = [...(currentForm.openaiProviders || [])];
            const currentIndex = providers.findIndex((provider) => provider.id === providerId);
            const nextIndex = currentIndex + direction;

            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= providers.length) {
                return currentForm;
            }

            [providers[currentIndex], providers[nextIndex]] = [providers[nextIndex], providers[currentIndex]];
            return normalizeSettings({
                ...currentForm,
                openaiProviders: providers.map((provider, index) => createOpenAIProvider(provider, index)),
            });
        });
    };

    const reorderProvider = (providerId: string, targetProviderId: string, position: 'before' | 'after') => {
        setForm((currentForm) => {
            const providers = [...(currentForm.openaiProviders || [])];
            const sourceIndex = providers.findIndex((provider) => provider.id === providerId);
            const targetIndex = providers.findIndex((provider) => provider.id === targetProviderId);

            if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
                return currentForm;
            }

            const [movedProvider] = providers.splice(sourceIndex, 1);
            let insertIndex = targetIndex;

            if (sourceIndex < targetIndex) {
                insertIndex -= 1;
            }

            if (position === 'after') {
                insertIndex += 1;
            }

            insertIndex = Math.max(0, Math.min(insertIndex, providers.length));
            if (insertIndex === sourceIndex) {
                return currentForm;
            }
            providers.splice(insertIndex, 0, movedProvider);

            return normalizeSettings({
                ...currentForm,
                openaiProviders: providers.map((provider, index) => createOpenAIProvider(provider, index)),
            });
        });
    };

    const removeProvider = (providerId: string) => {
        const providers = form.openaiProviders || [];
        if (providers.length <= 1) {
            showToast('至少保留一个服务商配置', 'warning');
            return;
        }

        const targetProvider = providers.find((provider) => provider.id === providerId);
        if (!targetProvider) return;
        if (!window.confirm(`确定删除服务商“${targetProvider.name}”吗？`)) return;

        const currentIndex = providers.findIndex((provider) => provider.id === providerId);
        const nextProviders = providers
            .filter((provider) => provider.id !== providerId)
            .map((provider, index) => createOpenAIProvider(provider, index));

        const nextSelectedId = selectedProviderId === providerId
            ? nextProviders[Math.min(currentIndex, nextProviders.length - 1)]?.id || ''
            : selectedProviderId;

        setSelectedProviderId(nextSelectedId);
        setForm((currentForm) => normalizeSettings({
            ...currentForm,
            openaiProviders: nextProviders,
        }));
    };

    async function fetchProviderModels(providerId: string, trigger: 'auto' | 'manual', signature?: string) {
        const provider = form.openaiProviders?.find((item) => item.id === providerId);
        if (!provider) return;

        if (!provider.apiBaseUrl.trim() || !provider.apiKey.trim()) {
            if (trigger === 'manual') {
                setProviderState(providerId, 'models', { tone: 'error', message: '请先填写 Base URL 与 API Key。' });
            }
            return;
        }

        setLoadingProviderModels((current) => ({ ...current, [providerId]: true }));
        if (trigger === 'manual') {
            setProviderState(providerId, 'models', { tone: 'info', message: '正在拉取模型列表…' });
        }

        const snapshotBaseUrl = provider.apiBaseUrl.trim().replace(/\/+$/, '');
        const snapshotApiKey = provider.apiKey.trim();
        const currentSignature = signature ?? `${snapshotBaseUrl}::${snapshotApiKey}`;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                url: `${snapshotBaseUrl}/v1/models`,
                options: {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${snapshotApiKey}`,
                    },
                },
            });

            if (!response?.success) {
                throw new Error(response?.error || '获取模型列表失败');
            }

            const fetchedModels = ((response.data?.data || []) as Array<{ id?: string }>)
                .map((item) => item?.id?.trim())
                .filter((value): value is string => Boolean(value));

            const sortedFetchedModels = sortModelNames(fetchedModels);

            setForm((currentForm) => {
                const currentProviderValue = currentForm.openaiProviders?.find((item) => item.id === providerId);
                if (!currentProviderValue) return currentForm;
                if (
                    currentProviderValue.apiBaseUrl.trim().replace(/\/+$/, '') !== snapshotBaseUrl
                    || currentProviderValue.apiKey.trim() !== snapshotApiKey
                ) {
                    return currentForm;
                }

                const nextProviders = (currentForm.openaiProviders || []).map((item, index) => (
                    item.id === providerId
                        ? createOpenAIProvider({
                            ...item,
                            model: resolveNextProviderModel(item.model, sortedFetchedModels),
                            models: mergeModelOptions(sortedFetchedModels, item.model, item.models),
                        }, index)
                        : item
                ));

                return normalizeSettings({
                    ...currentForm,
                    openaiProviders: nextProviders,
                });
            });

            setProviderState(providerId, 'models', fetchedModels.length > 0
                ? {
                    tone: 'success',
                    message: trigger === 'auto' ? `已自动更新 ${fetchedModels.length} 个模型。` : `已拉取 ${fetchedModels.length} 个模型。`,
                }
                : {
                    tone: 'warning',
                    message: '未返回模型列表',
                });
        } catch (error) {
            setProviderState(providerId, 'models', {
                tone: 'error',
                message: getShortRequestErrorMessage(error, 'models'),
            });
        } finally {
            setLoadingProviderModels((current) => ({ ...current, [providerId]: false }));
            if (trigger === 'auto') {
                setAutoFetchSignatures((current) => ({ ...current, [providerId]: currentSignature }));
            }
        }
    }

    const handleProviderTest = async (providerId: string) => {
        const provider = form.openaiProviders?.find((item) => item.id === providerId);
        if (!provider) return;

        if (!provider.apiBaseUrl.trim() || !provider.apiKey.trim()) {
            setProviderState(providerId, 'test', { tone: 'error', message: '请先填写 Base URL 与 API Key。' });
            return;
        }

        setTestingProviders((current) => ({ ...current, [providerId]: true }));
        setProviderState(providerId, 'test', { tone: 'info', message: '正在测试当前服务商…' });

        try {
            if (!provider.model.trim()) {
                throw new Error('MODEL_REQUIRED');
            }

            const response = await chrome.runtime.sendMessage({
                type: 'TEST_TRANSLATION',
                engine: 'openai',
                text: 'Hello',
                settings: buildServiceTestSettings(form, provider),
            });

            if (response?.success) {
                setProviderState(providerId, 'test', { tone: 'success', message: '测试成功' });
            } else {
                setProviderState(providerId, 'test', { tone: 'error', message: getShortRequestErrorMessage(response?.error, 'test') });
            }
        } catch (error) {
            setProviderState(providerId, 'test', { tone: 'error', message: getShortRequestErrorMessage(error, 'test') });
        } finally {
            setTestingProviders((current) => ({ ...current, [providerId]: false }));
        }
    };

    const handleManualAddModel = () => {
        if (!currentProvider) return;
        const modelName = manualModelName.trim();
        if (!modelName) return;

        updateProvider(currentProvider.id, (provider) => ({
            ...provider,
            model: provider.model || modelName,
            models: mergeModelOptions([modelName], provider.model, provider.models),
        }));
        setManualModelName('');
        setProviderState(currentProvider.id, 'models', { tone: 'success', message: `已添加模型：${modelName}` });
    };

    const handleServiceTest = async () => {
        if (form.translateEngine === 'openai' && (!currentProvider || !currentProvider.apiBaseUrl.trim() || !currentProvider.apiKey.trim())) {
            setServiceTestState({ tone: 'error', message: '请先为当前 AI 服务商填写 Base URL 与 API Key。' });
            return;
        }

        setIsTestingService(true);
        setServiceTestState({ tone: 'info', message: '正在测试当前翻译服务…' });

        try {
            if (form.translateEngine === 'openai' && !currentProvider?.model.trim()) {
                throw new Error('MODEL_REQUIRED');
            }

            const response = await chrome.runtime.sendMessage({
                type: 'TEST_TRANSLATION',
                engine: form.translateEngine,
                text: 'Hello',
                settings: buildServiceTestSettings(form, currentProvider),
            });

            if (response?.success) {
                setServiceTestState({ tone: 'success', message: '测试成功' });
            } else {
                setServiceTestState({ tone: 'error', message: getShortRequestErrorMessage(response?.error, 'test') });
            }
        } catch (error) {
            setServiceTestState({ tone: 'error', message: getShortRequestErrorMessage(error, 'test') });
        } finally {
            setIsTestingService(false);
        }
    };

    const handleClearOcrCache = async () => {
        const confirmed = window.confirm('确定要清除 OCR 缓存吗？');
        if (!confirmed) return;

        setIsClearingOcrCache(true);
        try {
            await onClearOCRCache();
            showToast('OCR 缓存已清除', 'success');
        } catch (error) {
            console.error('[MangaFlow] 清除 OCR 缓存失败:', error);
            showToast('清除 OCR 缓存失败，请稍后重试', 'error');
        } finally {
            setIsClearingOcrCache(false);
        }
    };

    const handleClearTranslationCache = async () => {
        const confirmed = window.confirm('确定要清除翻译缓存吗？');
        if (!confirmed) return;

        setIsClearingTranslationCache(true);
        try {
            await onClearTranslationCache();
            showToast('翻译缓存已清除', 'success');
        } catch (error) {
            console.error('[MangaFlow] 清除翻译缓存失败:', error);
            showToast('清除翻译缓存失败，请稍后重试', 'error');
        } finally {
            setIsClearingTranslationCache(false);
        }
    };

    const updateWebDAVField = <K extends keyof WebDAVConfig>(key: K, value: WebDAVConfig[K]) => {
        setWebdavForm((current) => normalizeWebDAVConfig({
            ...current,
            [key]: value,
        }));
    };

    const handleTestWebDAV = async () => {
        setIsTestingWebDAV(true);
        setWebdavStatus({ tone: 'info', message: '正在测试连接…' });

        try {
            await onTestWebDAV(webdavForm);
            setWebdavStatus({ tone: 'success', message: '连接成功' });
        } catch (error) {
            setWebdavStatus({ tone: 'error', message: getShortWebDAVErrorMessage(error, 'test') });
        } finally {
            setIsTestingWebDAV(false);
        }
    };

    const handlePushWebDAV = async () => {
        setIsPushingWebDAV(true);

        try {
            await onPushWebDAV(webdavForm, normalizeSettings(form));
            showToast('已推送到 WebDAV', 'success');
            if (webdavView === 'history') {
                await refreshWebDAVHistory(false);
            }
        } catch (error) {
            showToast(getShortWebDAVErrorMessage(error, 'push'), 'error');
        } finally {
            setIsPushingWebDAV(false);
        }
    };

    const handlePullWebDAV = async () => {
        setIsPullingWebDAV(true);

        try {
            const snapshot = await onPullWebDAV(webdavForm);
            const normalizedSettings = normalizeSettings(snapshot.settings);
            setForm(normalizedSettings);
            setSelectedProviderId(normalizedSettings.openaiProviders?.[0]?.id || '');
            setWhitelistText(formatWhitelist(normalizedSettings.siteWhitelist));
        } catch (error) {
            showToast(getShortWebDAVErrorMessage(error, 'pull'), 'error');
        } finally {
            setIsPullingWebDAV(false);
        }
    };

    const handleRestoreWebDAVBackup = async (fileName: string) => {
        setActiveWebDAVBackupFile(`restore:${fileName}`);

        try {
            const snapshot = await onRestoreWebDAVBackup(webdavForm, fileName);
            const normalizedSettings = normalizeSettings(snapshot.settings);
            setForm(normalizedSettings);
            setSelectedProviderId(normalizedSettings.openaiProviders?.[0]?.id || '');
            setWhitelistText(formatWhitelist(normalizedSettings.siteWhitelist));
        } catch (error) {
            showToast(getShortWebDAVErrorMessage(error, 'restore'), 'error');
        } finally {
            setActiveWebDAVBackupFile('');
        }
    };

    const handleDeleteWebDAVBackup = async (fileName: string) => {
        const confirmed = window.confirm(`确定删除历史版本“${fileName}”吗？`);
        if (!confirmed) return;

        setActiveWebDAVBackupFile(`delete:${fileName}`);
        try {
            await onDeleteWebDAVBackup(webdavForm, fileName);
            setWebdavHistory((current) => current.filter((item) => item.fileName !== fileName));
        } catch (error) {
            showToast(getShortWebDAVErrorMessage(error, 'delete'), 'error');
        } finally {
            setActiveWebDAVBackupFile('');
        }
    };

    async function refreshWebDAVHistory(_manual: boolean) {
        setIsLoadingWebDAVHistory(true);

        try {
            const items = await onListWebDAVBackups(webdavForm);
            setWebdavHistory(items);
            if (_manual) {
                showToast('备份列表已刷新', 'success');
            }
        } catch (error) {
            setWebdavHistory([]);
            showToast(getShortWebDAVErrorMessage(error, 'history'), 'error');
        } finally {
            setIsLoadingWebDAVHistory(false);
        }
    }

    async function checkPaddleService(trigger: 'auto' | 'manual', overrideUrl?: string) {
        const normalizedUrl = normalizePaddleServerUrl(overrideUrl ?? form.paddleOcrServerUrl);
        if (!normalizedUrl) {
            if (trigger === 'manual') {
                setPaddleServiceState({ tone: 'error', message: '请填写服务地址' });
            }
            return;
        }

        setIsCheckingPaddleService(true);
        setPaddleServiceState({ tone: 'info', message: '服务状态：检测中' });

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'API_REQUEST',
                url: `${normalizedUrl}/health`,
                timeoutMs: 3500,
                options: {
                    method: 'GET',
                    cache: 'no-store',
                },
            });

            if (!response?.success) {
                throw new Error(response?.error || '服务检测失败');
            }

            const data = response.data as {
                status?: string;
                model_ready?: boolean;
                dependency_ready?: boolean;
            };

            if (data?.status !== 'ok' || data?.dependency_ready !== true || data?.model_ready !== true) {
                setPaddleServiceState({ tone: 'error', message: '服务状态：不可用' });
            } else {
                setPaddleServiceState({ tone: 'success', message: '服务状态：可用' });
            }
        } catch (error) {
            setPaddleServiceState({
                tone: 'error',
                message: getPaddleServiceErrorMessage(error),
            });
        } finally {
            setIsCheckingPaddleService(false);
            if (trigger === 'auto') {
                setAutoCheckPaddleSignature(normalizedUrl);
            }
        }
    }

    const handleSave = async () => {
        const fontScale = clampNumber(form.fontScale ?? 1, 0.85, 1.2);
        const maskOpacity = clampNumber(form.maskOpacity ?? 0.24, 0.15, 0.55);
        const requestDelay = Math.max(0, Number(form.requestDelay) || 0);
        const normalizedProviders = (form.openaiProviders || []).map((provider, index) => createOpenAIProvider({
            ...provider,
            name: provider.name.trim(),
            apiBaseUrl: provider.apiBaseUrl.trim(),
            apiKey: provider.apiKey.trim(),
            model: provider.model.trim(),
            models: provider.models,
        }, index));

        if (form.translateEngine === 'openai' && !normalizedProviders.some((provider) => provider.enabled && provider.apiBaseUrl && provider.apiKey)) {
            showToast('请至少启用并配置一个可用的 AI 服务商', 'warning');
            setActiveTab('translate');
            return;
        }

        const normalizedSettings = normalizeSettings({
            ...form,
            fontScale,
            fontSize: Math.round(fontScale * 14),
            maskOpacity,
            requestDelay,
            siteWhitelist: parseWhitelist(whitelistText),
            deeplxUrl: form.deeplxUrl.trim(),
            deeplApiKey: form.deeplApiKey.trim(),
            cloudOcrKey: form.cloudOcrKey.trim(),
            paddleOcrServerUrl: normalizePaddleServerUrl(form.paddleOcrServerUrl),
            openaiProviders: normalizedProviders,
        });

        try {
            await onSaveWebDAVConfig(webdavForm);
            await onSave(normalizedSettings);
        } catch (error) {
            console.error('[MangaFlow] 保存 WebDAV 配置失败:', error);
            showToast('保存 WebDAV 配置失败，请稍后重试', 'error');
        }
    };

    return (
        <div className="manga-flow-settings manga-flow-settings--visible" aria-hidden={false}>
            <div className="manga-flow-settings__overlay" onClick={onClose} />

            <div className="manga-flow-settings__panel manga-flow-settings__panel--sidebar" role="dialog" aria-modal="true" aria-labelledby="manga-flow-settings-title">
                <h2 id="manga-flow-settings-title" className="manga-flow-settings__sr-only">设置面板</h2>
                <div className="manga-flow-settings__layout">
                    <aside className="manga-flow-settings__sidebar" aria-label="设置分类导航">
                        <nav className="manga-flow-settings__tabs">
                            {tabs.map((tab) => (
                                <button key={tab.id} type="button" className={`manga-flow-settings__tab ${activeTab === tab.id ? 'is-active' : ''}`.trim()} onClick={() => setActiveTab(tab.id)}>
                                    <span className="manga-flow-settings__tab-icon">{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>

                    <div className="manga-flow-settings__main">
                        <div className="manga-flow-settings__content manga-flow-settings__content--tabs">
                            <div className="manga-flow-settings__tab-pane">
                                {activeTab === 'general' ? renderGeneralTab(
                                    form,
                                    updateField,
                                    handleClearOcrCache,
                                    handleClearTranslationCache,
                                    isClearingOcrCache,
                                    isClearingTranslationCache
                                ) : null}
                                {activeTab === 'ocr' ? renderOcrTab({
                                    form,
                                    showCloudOcrKey,
                                    setShowCloudOcrKey,
                                    paddleServiceState,
                                    isCheckingPaddleService,
                                    updateField,
                                    onCheckPaddleService: () => void checkPaddleService('manual'),
                                    onChangePaddleServerUrl: (value) => {
                                        setPaddleServiceState(null);
                                        setAutoCheckPaddleSignature('');
                                        updateField('paddleOcrServerUrl', value);
                                    },
                                }) : null}
                                {activeTab === 'translate' ? renderTranslateTab({
                                    form,
                                    currentProvider,
                                    models: currentProvider?.models ?? [],
                                    modelQuery,
                                    manualModelName,
                                    currentProviderPreview,
                                    providerFeedback,
                                    loadingProviderModels,
                                    testingProviders,
                                    serviceTestState,
                                    isTestingService,
                                    showDeepLKey,
                                    setModelQuery,
                                    setManualModelName,
                                    setShowDeepLKey,
                                    updateField,
                                    addProvider,
                                    setSelectedProviderId,
                                    moveProvider,
                                    reorderProvider,
                                    removeProvider,
                                    updateProvider,
                                    fetchProviderModels,
                                    handleProviderTest,
                                    handleManualAddModel,
                                    handleServiceTest,
                                    setProviderState,
                                }) : null}
                                {activeTab === 'display' ? renderDisplayTab(form, updateField) : null}
                                {activeTab === 'site' ? renderSiteTab(form, whitelistText, setWhitelistText, updateField) : null}
                                {activeTab === 'sync' ? renderSyncTab({
                                    webdavForm,
                                    webdavView,
                                    showPassword: showWebDAVPassword,
                                    webdavStatus,
                                    isTestingWebDAV,
                                    isPushingWebDAV,
                                    isPullingWebDAV,
                                    isLoadingWebDAVHistory,
                                    webdavHistory,
                                    activeWebDAVBackupFile,
                                    onChangeView: setWebdavView,
                                    onChangeField: updateWebDAVField,
                                    onTogglePassword: () => setShowWebDAVPassword((current) => !current),
                                    onTest: () => void handleTestWebDAV(),
                                    onPush: () => void handlePushWebDAV(),
                                    onPull: () => void handlePullWebDAV(),
                                    onRefreshHistory: () => void refreshWebDAVHistory(true),
                                    onRestoreBackup: (fileName) => void handleRestoreWebDAVBackup(fileName),
                                    onDeleteBackup: (fileName) => void handleDeleteWebDAVBackup(fileName),
                                }) : null}
                                {activeTab === 'dev' && showDevTools ? renderDevTab(form, updateField) : null}
                            </div>
                        </div>

                        <footer className="manga-flow-settings__footer manga-flow-settings__footer--sticky">
                            <button type="button" className="mf-button mf-button--secondary" onClick={onClose}>
                                取消
                            </button>
                            <button type="button" className="mf-button mf-button--primary" onClick={() => void handleSave()}>
                                <Save size={15} strokeWidth={1.9} />
                                <span>保存设置</span>
                            </button>
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function renderGeneralTab(
    form: Settings,
    updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void,
    onClearOcrCache: () => void,
    onClearTranslationCache: () => void,
    isClearingOcrCache: boolean,
    isClearingTranslationCache: boolean
) {
    return (
        <>
            <TabIntro title="常规" />
            <PaneSection title="语言设置">
                <div className="manga-flow-settings__quick-grid">
                    <Field label="原文语言">
                        <DropdownSelect
                            value={form.sourceLang}
                            options={SOURCE_LANGUAGE_OPTIONS}
                            ariaLabel="原文语言"
                            onChange={(value) => updateField('sourceLang', value)}
                            renderSelected={(option) => <span className="manga-flow-settings__compact-select">{option.label}</span>}
                        />
                    </Field>
                    <Field label="目标语言">
                        <DropdownSelect
                            value={form.targetLang}
                            options={TARGET_LANGUAGE_OPTIONS}
                            ariaLabel="目标语言"
                            onChange={(value) => updateField('targetLang', value)}
                            renderSelected={(option) => <span className="manga-flow-settings__compact-select">{option.label}</span>}
                        />
                    </Field>
                </div>
            </PaneSection>
            <PaneSection title="缓存">
                <div className="manga-flow-settings__stack">
                    <Field label="OCR 缓存" helper="清除后会重新请求 OCR，适合重新验证坐标和识别结果。">
                        <div className="manga-flow-settings__inline-actions">
                            <button
                                type="button"
                                className="mf-button mf-button--secondary"
                                onClick={onClearOcrCache}
                                disabled={isClearingOcrCache}
                            >
                                {isClearingOcrCache ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                <span>{isClearingOcrCache ? '清除中…' : '清除 OCR 缓存'}</span>
                            </button>
                        </div>
                    </Field>
                    <Field label="翻译缓存" helper="清除后会重新请求翻译，适合回归测试不同模型或提示词结果。">
                        <div className="manga-flow-settings__inline-actions">
                            <button
                                type="button"
                                className="mf-button mf-button--secondary"
                                onClick={onClearTranslationCache}
                                disabled={isClearingTranslationCache}
                            >
                                {isClearingTranslationCache ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                <span>{isClearingTranslationCache ? '清除中…' : '清除翻译缓存'}</span>
                            </button>
                        </div>
                    </Field>
                </div>
            </PaneSection>
        </>
    );
}

function renderOcrTab(params: {
    form: Settings;
    updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
    showCloudOcrKey: boolean;
    setShowCloudOcrKey: (value: boolean | ((current: boolean) => boolean)) => void;
    paddleServiceState: InlineState | null;
    isCheckingPaddleService: boolean;
    onCheckPaddleService: () => void;
    onChangePaddleServerUrl: (value: string) => void;
}) {
    const {
        form,
        updateField,
        showCloudOcrKey,
        setShowCloudOcrKey,
        paddleServiceState,
        isCheckingPaddleService,
        onCheckPaddleService,
        onChangePaddleServerUrl,
    } = params;

    return (
        <>
            <TabIntro title="OCR" />
            <PaneSection title="OCR 引擎">
                <Field>
                    <DropdownSelect
                        value={form.ocrEngine}
                        options={OCR_ENGINE_OPTIONS}
                        ariaLabel="OCR 引擎"
                        onChange={(value) => updateField('ocrEngine', value)}
                        renderSelected={(option) => (
                            <div className="manga-flow-settings__provider-select">
                                <OcrEngineLogo engine={option.value} />
                                <span className="manga-flow-settings__compact-select">{option.label}</span>
                                {option.value === 'paddle_local' ? renderPaddleServiceStatusIcon(paddleServiceState, isCheckingPaddleService) : null}
                            </div>
                        )}
                        renderOptionLeading={(option) => <OcrEngineLogo engine={option.value} />}
                        renderOptionTrailing={(option) => (
                            option.value === 'paddle_local'
                                ? renderPaddleServiceStatusIcon(paddleServiceState, isCheckingPaddleService)
                                : null
                        )}
                    />
                </Field>
            </PaneSection>
            {form.ocrEngine === 'cloud' ? (
                <PaneSection title="Google Cloud Vision">
                    <Field
                        label="Cloud Vision API Key"
                        helper={(
                            <>
                                前往
                                {' '}
                                <a href="https://console.cloud.google.com/apis/library/vision.googleapis.com" target="_blank" rel="noreferrer">
                                    Google Cloud Console
                                </a>
                            </>
                        )}
                    >
                        <PasswordField
                            value={form.cloudOcrKey}
                            visible={showCloudOcrKey}
                            placeholder="请输入 Google Cloud Vision API Key"
                            onToggleVisibility={() => setShowCloudOcrKey((currentValue) => !currentValue)}
                            onChange={(value) => updateField('cloudOcrKey', value)}
                        />
                    </Field>
                </PaneSection>
            ) : null}
            {form.ocrEngine === 'paddle_local' ? (
                <PaneSection title="PaddleOCR 本地服务">
                    <div className="manga-flow-settings__stack">
                        <Field label="服务地址">
                            <input
                                className="manga-flow-settings__input"
                                type="text"
                                placeholder={DEFAULT_PADDLE_OCR_SERVER_URL}
                                value={form.paddleOcrServerUrl ?? DEFAULT_PADDLE_OCR_SERVER_URL}
                                onChange={(event) => onChangePaddleServerUrl(event.target.value)}
                            />
                        </Field>
                        <Field label="服务检测">
                            <div className="manga-flow-settings__inline-actions">
                                <button
                                    type="button"
                                    className="mf-button mf-button--secondary"
                                    onClick={onCheckPaddleService}
                                    disabled={isCheckingPaddleService}
                                >
                                    {isCheckingPaddleService ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                    <span>{paddleServiceState ? '重新检测' : '检测服务'}</span>
                                </button>
                                <InlineStatus state={paddleServiceState ?? { tone: 'warning', message: '服务状态：未检测' }} />
                            </div>
                        </Field>
                    </div>
                </PaneSection>
            ) : (
                <PaneSection title="Tesseract OCR">
                    <InfoBlock tone="info">Tesseract OCR 当前无需额外配置。</InfoBlock>
                </PaneSection>
            )}
        </>
    );
}

function renderTranslateTab(params: {
    form: Settings;
    currentProvider: OpenAIProvider | null;
    models: string[];
    modelQuery: string;
    manualModelName: string;
    currentProviderPreview: string;
    providerFeedback: Record<string, ProviderFeedbackState>;
    loadingProviderModels: Record<string, boolean>;
    testingProviders: Record<string, boolean>;
    serviceTestState: InlineState | null;
    isTestingService: boolean;
    showDeepLKey: boolean;
    setModelQuery: (value: string) => void;
    setManualModelName: (value: string) => void;
    setShowDeepLKey: (value: boolean | ((current: boolean) => boolean)) => void;
    updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
    addProvider: () => void;
    setSelectedProviderId: (providerId: string) => void;
    moveProvider: (providerId: string, direction: -1 | 1) => void;
    reorderProvider: (providerId: string, targetProviderId: string, position: 'before' | 'after') => void;
    removeProvider: (providerId: string) => void;
    updateProvider: (providerId: string, patch: Partial<OpenAIProvider> | ((provider: OpenAIProvider) => OpenAIProvider)) => void;
    fetchProviderModels: (providerId: string, trigger: 'auto' | 'manual', signature?: string) => Promise<void>;
    handleProviderTest: (providerId: string) => Promise<void>;
    handleManualAddModel: () => void;
    handleServiceTest: () => Promise<void>;
    setProviderState: (providerId: string, key: keyof ProviderFeedbackState, value: InlineState | null) => void;
}) {
    const {
        form, currentProvider, models, modelQuery, manualModelName, currentProviderPreview,
        providerFeedback, loadingProviderModels, testingProviders, serviceTestState, isTestingService,
        showDeepLKey, setModelQuery, setManualModelName, setShowDeepLKey, updateField, addProvider,
        setSelectedProviderId, moveProvider, reorderProvider, removeProvider, updateProvider, fetchProviderModels,
        handleProviderTest, handleManualAddModel, handleServiceTest, setProviderState,
    } = params;

    return (
        <>
            <TabIntro title="翻译" />
            <PaneSection title="翻译服务">
                <div className="manga-flow-settings__stack">
                    <Field>
                        <DropdownSelect
                            value={form.translateEngine}
                            options={TRANSLATION_ENGINE_OPTIONS}
                            ariaLabel="翻译引擎"
                            onChange={(value) => updateField('translateEngine', value)}
                            renderSelected={(option) => (
                                <div className="manga-flow-settings__provider-select">
                                    <PopupProviderLogo provider={option.value} />
                                    <span className="manga-flow-settings__compact-select">{option.label}</span>
                                </div>
                            )}
                            renderOptionLeading={(option) => <PopupProviderLogo provider={option.value} />}
                        />
                    </Field>
                    <div className="manga-flow-settings__grid manga-flow-settings__grid--service">
                        <Field label="请求间隔（毫秒）">
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
                                <button type="button" className="mf-button mf-button--secondary" onClick={() => void handleServiceTest()} disabled={isTestingService}>
                                    {isTestingService ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                    <span>测试服务</span>
                                </button>
                                {serviceTestState ? <InlineStatus state={serviceTestState} /> : null}
                            </div>
                        </Field>
                    </div>
                </div>
            </PaneSection>
            {form.translateEngine === 'openai' ? (
                <PaneSection title="AI 服务商">
                    <OpenAIProviderManager
                        providers={form.openaiProviders || []}
                        currentProvider={currentProvider}
                        models={models}
                        modelQuery={modelQuery}
                        manualModelName={manualModelName}
                        currentProviderPreview={currentProviderPreview}
                        providerFeedback={providerFeedback}
                        loadingProviderModels={loadingProviderModels}
                        testingProviders={testingProviders}
                        onSelectProvider={setSelectedProviderId}
                        onAddProvider={addProvider}
                        onMoveProvider={moveProvider}
                        onReorderProvider={reorderProvider}
                        onRemoveProvider={removeProvider}
                        onToggleProvider={(providerId, enabled) => updateProvider(providerId, { enabled })}
                        onUpdateProvider={updateProvider}
                        onFetchModels={(providerId, trigger) => void fetchProviderModels(providerId, trigger)}
                        onTestProvider={(providerId) => void handleProviderTest(providerId)}
                        onSetModelQuery={setModelQuery}
                        onSetManualModelName={setManualModelName}
                        onManualAddModel={handleManualAddModel}
                        onSelectModel={(model) => currentProvider && updateProvider(currentProvider.id, { model })}
                        onRemoveModel={(providerId, model) => {
                            updateProvider(providerId, (provider) => ({
                                ...provider,
                                model: provider.model === model ? provider.models.filter((item) => item !== model)[0] || '' : provider.model,
                                models: provider.models.filter((item) => item !== model),
                            }));
                            if (currentProvider) {
                                setProviderState(currentProvider.id, 'models', { tone: 'info', message: `已移除模型：${model}` });
                            }
                        }}
                    />
                </PaneSection>
            ) : null}
            {form.translateEngine === 'deeplx' ? (
                <PaneSection title="DeepLX">
                    <Field label="DeepLX 服务地址">
                        <input className="manga-flow-settings__input" type="text" placeholder="例如：https://api.deeplx.org/translate" value={form.deeplxUrl} onChange={(event) => updateField('deeplxUrl', event.target.value)} />
                    </Field>
                </PaneSection>
            ) : null}
            {form.translateEngine === 'deepl' ? (
                <PaneSection title="DeepL 官方 API">
                    <Field label="DeepL API Key">
                        <PasswordField value={form.deeplApiKey} visible={showDeepLKey} placeholder="例如：xxxxxx:fx" onToggleVisibility={() => setShowDeepLKey((currentValue) => !currentValue)} onChange={(value) => updateField('deeplApiKey', value)} />
                    </Field>
                </PaneSection>
            ) : null}
        </>
    );
}

function renderDisplayTab(form: Settings, updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void) {
    return (
        <>
            <TabIntro title="显示" />
            <PaneSection title="译文显示">
                <div className="manga-flow-settings__stack">
                    <SliderField label="译文字体倍率" valueLabel={`${Math.round((form.fontScale ?? 1) * 100)}%`}>
                        <input className="manga-flow-settings__range" type="range" min={85} max={120} step={1} value={Math.round((form.fontScale ?? 1) * 100)} onChange={(event) => updateField('fontScale', Number(event.target.value) / 100)} />
                    </SliderField>
                    <div className="manga-flow-settings__grid manga-flow-settings__grid--two">
                        <Field label="译文字体颜色">
                            <div className="manga-flow-settings__color-row">
                                <input className="manga-flow-settings__color-picker" type="color" value={form.fontColor} onChange={(event) => updateField('fontColor', event.target.value)} />
                                <input className="manga-flow-settings__input" type="text" value={form.fontColor} onChange={(event) => updateField('fontColor', event.target.value)} />
                            </div>
                        </Field>
                        <SliderField label="遮罩透明度" valueLabel={(form.maskOpacity ?? 0.24).toFixed(2)}>
                            <input className="manga-flow-settings__range" type="range" min={0.15} max={0.55} step={0.01} value={form.maskOpacity ?? 0.24} onChange={(event) => updateField('maskOpacity', Number(event.target.value))} />
                        </SliderField>
                    </div>
                </div>
            </PaneSection>
        </>
    );
}

function renderSiteTab(
    form: Settings,
    whitelistText: string,
    setWhitelistText: (value: string) => void,
    updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void
) {
    return (
        <>
            <TabIntro title="站点" />
            <PaneSection title="显示策略">
                <div className="manga-flow-settings__stack">
                    <Field label="悬浮球显示策略">
                        <DropdownSelect value={form.sitePolicy ?? 'auto_detect'} options={SITE_POLICY_OPTIONS} ariaLabel="悬浮球显示策略" onChange={(value) => updateField('sitePolicy', value)} renderSelected={(option) => <span className="manga-flow-settings__compact-select">{option.label}</span>} />
                    </Field>
                    <Field label="白名单域名">
                        <textarea className="manga-flow-settings__textarea" rows={6} value={whitelistText} disabled={(form.sitePolicy ?? 'auto_detect') !== 'whitelist_only'} onChange={(event) => setWhitelistText(event.target.value)} placeholder={'mangadex.org\nexample.com'} />
                    </Field>
                </div>
            </PaneSection>
        </>
    );
}

function renderSyncTab(params: {
    webdavForm: WebDAVConfig;
    webdavView: 'config' | 'history';
    showPassword: boolean;
    webdavStatus: InlineState | null;
    isTestingWebDAV: boolean;
    isPushingWebDAV: boolean;
    isPullingWebDAV: boolean;
    isLoadingWebDAVHistory: boolean;
    webdavHistory: WebDAVBackupItem[];
    activeWebDAVBackupFile: string;
    onChangeView: (view: 'config' | 'history') => void;
    onChangeField: <K extends keyof WebDAVConfig>(key: K, value: WebDAVConfig[K]) => void;
    onTogglePassword: () => void;
    onTest: () => void;
    onPush: () => void;
    onPull: () => void;
    onRefreshHistory: () => void;
    onRestoreBackup: (fileName: string) => void;
    onDeleteBackup: (fileName: string) => void;
}) {
    const {
        webdavForm,
        webdavView,
        showPassword,
        webdavStatus,
        isTestingWebDAV,
        isPushingWebDAV,
        isPullingWebDAV,
        isLoadingWebDAVHistory,
        webdavHistory,
        activeWebDAVBackupFile,
        onChangeView,
        onChangeField,
        onTogglePassword,
        onTest,
        onPush,
        onPull,
        onRefreshHistory,
        onRestoreBackup,
        onDeleteBackup,
    } = params;

    const backupItems = webdavHistory.filter((item) => !item.isLatest);
    const latestBackupFileName = backupItems[0]?.fileName || '';

    return (
        <>
            <TabIntro title="同步" />
            <PaneSection title="WebDAV">
                <div className="manga-flow-settings__sync-segment">
                    <button
                        type="button"
                        className={`manga-flow-settings__sync-segment-btn ${webdavView === 'config' ? 'is-active' : ''}`.trim()}
                        onClick={() => onChangeView('config')}
                    >
                        配置
                    </button>
                    <button
                        type="button"
                        className={`manga-flow-settings__sync-segment-btn ${webdavView === 'history' ? 'is-active' : ''}`.trim()}
                        onClick={() => onChangeView('history')}
                    >
                        历史版本
                    </button>
                </div>

                {webdavView === 'config' ? (
                    <div className="manga-flow-settings__sync-stack">
                        <div className="manga-flow-settings__sync-action-row manga-flow-settings__sync-action-row--status">
                            <span className="manga-flow-settings__label">连接信息</span>
                            <div className="manga-flow-settings__sync-status-slot">
                                {webdavStatus ? <InlineStatus state={webdavStatus} /> : null}
                            </div>
                            <button type="button" className="mf-button mf-button--secondary" onClick={onTest} disabled={isTestingWebDAV}>
                                {isTestingWebDAV ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                <span>测试连接</span>
                            </button>
                        </div>

                        <Field label="服务器地址">
                            <input
                                className="manga-flow-settings__input"
                                type="text"
                                placeholder="https://example.com/dav/"
                                value={webdavForm.serverUrl}
                                onChange={(event) => onChangeField('serverUrl', event.target.value)}
                            />
                        </Field>

                        <div className="manga-flow-settings__grid manga-flow-settings__grid--two">
                            <Field label="用户名">
                                <input
                                    className="manga-flow-settings__input"
                                    type="text"
                                    value={webdavForm.username}
                                    onChange={(event) => onChangeField('username', event.target.value)}
                                />
                            </Field>
                            <Field label="应用密码">
                                <PasswordField
                                    value={webdavForm.password}
                                    visible={showPassword}
                                    placeholder="请输入 WebDAV 密码"
                                    onToggleVisibility={onTogglePassword}
                                    onChange={(value) => onChangeField('password', value)}
                                />
                            </Field>
                        </div>

                        <div className="manga-flow-settings__grid manga-flow-settings__grid--two">
                            <SwitchField label="自动同步" checked={webdavForm.autoSync} onChange={(value) => onChangeField('autoSync', value)} />
                            <SwitchField label="记住密码" checked={webdavForm.rememberPassword} onChange={(value) => onChangeField('rememberPassword', value)} />
                        </div>

                        <div className="manga-flow-settings__grid manga-flow-settings__grid--two">
                            <Field label="同步延迟">
                                <div className="manga-flow-settings__sync-number">
                                    <input
                                        className="manga-flow-settings__input"
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={webdavForm.syncDelaySeconds}
                                        onChange={(event) => onChangeField('syncDelaySeconds', Number(event.target.value) || 1)}
                                    />
                                    <span>秒</span>
                                </div>
                            </Field>
                            <Field label="备份数量">
                                <div className="manga-flow-settings__sync-number">
                                    <input
                                        className="manga-flow-settings__input"
                                        type="number"
                                        min={5}
                                        max={50}
                                        value={webdavForm.backupLimit}
                                        onChange={(event) => onChangeField('backupLimit', Number(event.target.value) || 5)}
                                    />
                                    <span>份</span>
                                </div>
                            </Field>
                        </div>

                        <div className="manga-flow-settings__sync-footer-actions">
                            <button type="button" className="mf-button mf-button--secondary" onClick={onPull} disabled={isPullingWebDAV}>
                                {isPullingWebDAV ? <LoaderCircle className="mf-button__spinner" size={15} /> : <Download size={15} strokeWidth={1.8} />}
                                <span>立即拉取</span>
                            </button>
                            <button type="button" className="mf-button mf-button--primary" onClick={onPush} disabled={isPushingWebDAV}>
                                {isPushingWebDAV ? <LoaderCircle className="mf-button__spinner" size={15} /> : <Upload size={15} strokeWidth={1.8} />}
                                <span>立即推送</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="manga-flow-settings__sync-stack">
                        <div className="manga-flow-settings__sync-action-row">
                            <span className="manga-flow-settings__label">备份列表</span>
                            <button type="button" className="mf-button mf-button--secondary" onClick={onRefreshHistory} disabled={isLoadingWebDAVHistory}>
                                {isLoadingWebDAVHistory ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RefreshCw size={15} strokeWidth={1.8} />}
                                <span>刷新列表</span>
                            </button>
                        </div>

                        <div className="manga-flow-settings__history-list">
                            {backupItems.length > 0 ? backupItems.map((item) => {
                                const isRestoring = activeWebDAVBackupFile === `restore:${item.fileName}`;
                                const isDeleting = activeWebDAVBackupFile === `delete:${item.fileName}`;
                                const isLatestBackup = latestBackupFileName === item.fileName;

                                return (
                                    <div key={item.fileName} className="manga-flow-settings__history-item">
                                        <div className="manga-flow-settings__history-copy">
                                            <strong>{item.fileName}</strong>
                                            <span>{formatBackupTime(item.fileName, item.lastModified)}</span>
                                        </div>
                                        <div className="manga-flow-settings__history-actions">
                                            {isLatestBackup ? <span className="manga-flow-settings__history-tag">最新</span> : null}
                                            <button
                                                type="button"
                                                className="manga-flow-settings__icon-action manga-flow-settings__icon-action--restore"
                                                onClick={() => onRestoreBackup(item.fileName)}
                                                disabled={isRestoring || Boolean(activeWebDAVBackupFile)}
                                                aria-label="从此版本恢复"
                                                data-tooltip="从此版本恢复"
                                            >
                                                {isRestoring ? <LoaderCircle className="mf-button__spinner" size={15} /> : <RotateCcw size={15} strokeWidth={1.9} />}
                                            </button>
                                            <button
                                                type="button"
                                                className="manga-flow-settings__icon-action manga-flow-settings__icon-action--delete"
                                                onClick={() => onDeleteBackup(item.fileName)}
                                                disabled={isDeleting || Boolean(activeWebDAVBackupFile)}
                                                aria-label="删除此备份"
                                                data-tooltip="删除此备份"
                                            >
                                                {isDeleting ? <LoaderCircle className="mf-button__spinner" size={15} /> : <Trash2 size={15} strokeWidth={1.9} />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="manga-flow-settings__empty">暂无历史版本</div>
                            )}
                        </div>
                    </div>
                )}
            </PaneSection>
        </>
    );
}

function renderDevTab(form: Settings, updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void) {
    return (
        <>
            <TabIntro title="开发" />
            <PaneSection title="开发模式">
                <div className="manga-flow-settings__stack">
                    <SwitchField label="启用开发模式" checked={form.devMode ?? true} onChange={(value) => updateField('devMode', value)} />
                    <Field label="执行阶段">
                        <DropdownSelect value={form.devPhase ?? 'roi'} options={DEV_PHASE_OPTIONS} ariaLabel="执行阶段" onChange={(value) => updateField('devPhase', value)} disabled={!(form.devMode ?? true)} renderSelected={(option) => <span className="manga-flow-settings__compact-select">{option.label}</span>} />
                    </Field>
                    <div className="manga-flow-settings__checks">
                        <CheckboxField label="显示 OCR 红框" checked={form.showOcrBoxes ?? true} onChange={(value) => updateField('showOcrBoxes', value)} />
                        <CheckboxField label="显示 ROI 橙框" checked={form.showRoiBoxes ?? true} onChange={(value) => updateField('showRoiBoxes', value)} />
                        <CheckboxField label="显示遮罩绿框" checked={form.showMaskBoxes ?? false} onChange={(value) => updateField('showMaskBoxes', value)} />
                    </div>
                </div>
            </PaneSection>
        </>
    );
}


function formatBackupTime(fileName: string, lastModified?: string): string {
    const matched = fileName.match(/^mangaflow_backup_(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/);
    if (matched) {
        const [, yyyy, mm, dd, hh, mi, ss] = matched;
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    }

    if (!lastModified) return '未知时间';

    const date = new Date(lastModified);
    if (Number.isNaN(date.getTime())) {
        return lastModified;
    }

    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mi = `${date.getMinutes()}`.padStart(2, '0');
    const ss = `${date.getSeconds()}`.padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function buildServiceTestSettings(form: Settings, provider: OpenAIProvider | null): Partial<Settings> {
    if (form.translateEngine === 'openai' && provider) {
        return {
            sourceLang: form.sourceLang,
            targetLang: form.targetLang,
            apiBaseUrl: provider.apiBaseUrl,
            apiKey: provider.apiKey,
            model: provider.model,
            openaiProviders: [provider],
        };
    }

    return {
        sourceLang: form.sourceLang,
        targetLang: form.targetLang,
        apiBaseUrl: form.apiBaseUrl,
        apiKey: form.apiKey,
        model: form.model,
        deeplxUrl: form.deeplxUrl,
        deeplApiKey: form.deeplApiKey,
    };
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

function buildChatCompletionsPreview(baseUrl: string): string {
    const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
    return normalizedBase ? `${normalizedBase}/v1/chat/completions` : '/v1/chat/completions';
}

function mergeModelOptions(fetchedModels: string[], selectedModel: string, currentModels: string[] = []): string[] {
    const merged = Array.from(new Set([selectedModel, ...currentModels, ...fetchedModels].map((item) => item.trim()).filter(Boolean)));
    return sortModelNames(merged);
}

function resolveNextProviderModel(currentModel: string, fetchedModels: string[]): string {
    const normalizedCurrentModel = currentModel.trim();
    if (normalizedCurrentModel && fetchedModels.includes(normalizedCurrentModel)) {
        return normalizedCurrentModel;
    }

    return fetchedModels[0] || normalizedCurrentModel || '';
}

function sortModelNames(models: string[]): string[] {
    return [...models].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
}

function getShortRequestErrorMessage(error: unknown, mode: 'test' | 'models'): string {
    const rawMessage = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '';

    const normalizedMessage = rawMessage.trim();
    const prefix = mode === 'models' ? '拉取失败' : '测试失败';

    if (!normalizedMessage) {
        return `${prefix}，请稍后重试`;
    }

    if (normalizedMessage === 'MODEL_REQUIRED') {
        return '请先选择模型';
    }

    if (/401|403|unauthorized|invalid api key|authentication|鉴权/i.test(normalizedMessage)) {
        return `${prefix}，请检查 API Key`;
    }

    if (/404|not found/i.test(normalizedMessage)) {
        return `${prefix}，请检查服务地址`;
    }

    if (/Failed to fetch|fetch failed|networkerror|load failed/i.test(normalizedMessage)) {
        return `${prefix}，请检查地址或密钥`;
    }

    if (/Unexpected token|valid JSON|json/i.test(normalizedMessage)) {
        return `${prefix}，返回格式异常`;
    }

    if (/timeout|timed out|aborterror/i.test(normalizedMessage)) {
        return `${prefix}，请稍后重试`;
    }

    if (/模型列表/.test(normalizedMessage)) {
        return mode === 'models' ? '未返回模型列表' : `${prefix}，请稍后重试`;
    }

    return `${prefix}，请稍后重试`;
}

function getShortWebDAVErrorMessage(error: unknown, mode: 'test' | 'push' | 'pull' | 'history' | 'restore' | 'delete'): string {
    const rawMessage = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '';

    const normalizedMessage = rawMessage.trim();
    const prefixMap = {
        test: '连接失败',
        push: '推送失败',
        pull: '拉取失败',
        history: '读取失败',
        restore: '恢复失败',
        delete: '删除失败',
    } as const;

    const prefix = prefixMap[mode];
    if (!normalizedMessage) {
        return `${prefix}，请稍后重试`;
    }

    if (/401|403|unauthorized|authentication|forbidden/i.test(normalizedMessage)) {
        return `${prefix}，请检查账号或密码`;
    }

    if (/404|not found/i.test(normalizedMessage)) {
        return `${prefix}，请检查服务器地址`;
    }

    if (/timeout|timed out|aborterror/i.test(normalizedMessage)) {
        return `${prefix}，请求超时`;
    }

    if (/Failed to fetch|fetch failed|networkerror|load failed/i.test(normalizedMessage)) {
        return `${prefix}，无法连接服务器`;
    }

    return `${prefix}，请稍后重试`;
}

function normalizePaddleServerUrl(url?: string): string {
    const rawValue = (url || '').trim();
    return (rawValue || DEFAULT_PADDLE_OCR_SERVER_URL).replace(/\/+$/, '');
}

function getPaddleServiceErrorMessage(error: unknown): string {
    const message = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '';

    if (/超时|timeout/i.test(message)) {
        return '服务状态：连接超时';
    }

    if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return '服务状态：连接失败';
    }

    return '服务状态：不可用';
}

function renderPaddleServiceStatusIcon(state: InlineState | null, checking: boolean): ReactNode {
    if (checking) {
        return (
            <span className="manga-flow-settings__status-icon manga-flow-settings__status-icon--info" aria-hidden="true">
                <LoaderCircle className="manga-flow-settings__status-icon-spinner" size={15} strokeWidth={1.9} />
            </span>
        );
    }

    if (!state) return null;

    if (state.tone === 'success') {
        return (
            <span className="manga-flow-settings__status-icon manga-flow-settings__status-icon--success" aria-hidden="true">
                <CircleCheck size={15} strokeWidth={2.1} />
            </span>
        );
    }

    if (state.tone === 'error') {
        return (
            <span className="manga-flow-settings__status-icon manga-flow-settings__status-icon--error" aria-hidden="true">
                <AlertCircle size={15} strokeWidth={2.1} />
            </span>
        );
    }

    return null;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

import {
    ArrowDown,
    ArrowUp,
    Bot,
    GripVertical,
    LoaderCircle,
    Plus,
    RefreshCw,
    Search,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { OpenAIProvider } from '../../types';
import {
    Field,
    InlineStatus,
    MiniSwitch,
    PasswordField,
    type InlineState,
} from './settings-panel-controls';

export interface ProviderFeedbackState {
    models?: InlineState | null;
    test?: InlineState | null;
}

interface OpenAIProviderManagerProps {
    providers: OpenAIProvider[];
    currentProvider: OpenAIProvider | null;
    models: string[];
    modelQuery: string;
    manualModelName: string;
    currentProviderPreview: string;
    providerFeedback: Record<string, ProviderFeedbackState>;
    loadingProviderModels: Record<string, boolean>;
    testingProviders: Record<string, boolean>;
    onSelectProvider: (providerId: string) => void;
    onAddProvider: () => void;
    onMoveProvider: (providerId: string, direction: -1 | 1) => void;
    onReorderProvider: (providerId: string, targetProviderId: string, position: 'before' | 'after') => void;
    onRemoveProvider: (providerId: string) => void;
    onToggleProvider: (providerId: string, enabled: boolean) => void;
    onUpdateProvider: (providerId: string, patch: Partial<OpenAIProvider>) => void;
    onFetchModels: (providerId: string, trigger: 'auto' | 'manual') => void;
    onTestProvider: (providerId: string) => void;
    onSetModelQuery: (value: string) => void;
    onSetManualModelName: (value: string) => void;
    onManualAddModel: () => void;
    onSelectModel: (model: string) => void;
    onRemoveModel: (providerId: string, model: string) => void;
}

export function OpenAIProviderManager({
    providers,
    currentProvider,
    models,
    modelQuery,
    manualModelName,
    currentProviderPreview,
    providerFeedback,
    loadingProviderModels,
    testingProviders,
    onSelectProvider,
    onAddProvider,
    onMoveProvider,
    onReorderProvider,
    onRemoveProvider,
    onToggleProvider,
    onUpdateProvider,
    onFetchModels,
    onTestProvider,
    onSetModelQuery,
    onSetManualModelName,
    onManualAddModel,
    onSelectModel,
    onRemoveModel,
}: OpenAIProviderManagerProps) {
    const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
    const [activeGroup, setActiveGroup] = useState<string>('all');
    const [draggingProviderId, setDraggingProviderId] = useState<string | null>(null);
    const providerCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const dragSessionRef = useRef<{ providerId: string; lastHoverKey: string | null } | null>(null);
    const modelItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const currentIndex = currentProvider
        ? providers.findIndex((provider) => provider.id === currentProvider.id)
        : -1;

    const groupedModels = useMemo(() => groupModelsByPrefix(models), [models]);
    const selectedModelGroup = useMemo(
        () => (currentProvider?.model ? getModelGroupKey(currentProvider.model) : 'all'),
        [currentProvider?.model]
    );

    const visibleModels = useMemo(() => {
        const keyword = modelQuery.trim().toLowerCase();
        const baseModels = activeGroup === 'all'
            ? groupedModels.flatMap((group) => group.models)
            : groupedModels.find((group) => group.key === activeGroup)?.models ?? [];

        if (!keyword) {
            return baseModels;
        }

        return baseModels.filter((model) => model.toLowerCase().includes(keyword));
    }, [activeGroup, groupedModels, modelQuery]);

    useEffect(() => {
        if (activeGroup === 'all') return;
        if (!groupedModels.some((group) => group.key === activeGroup)) {
            setActiveGroup('all');
        }
    }, [activeGroup, groupedModels]);

    useEffect(() => {
        modelItemRefs.current = {};
    }, [currentProvider?.id]);

    useEffect(() => {
        if (!draggingProviderId) return;

        const handlePointerMove = (event: PointerEvent) => {
            event.preventDefault();

            const draggingId = dragSessionRef.current?.providerId;
            if (!draggingId) return;

            const hoveredProvider = providers.find((provider) => {
                const node = providerCardRefs.current[provider.id];
                if (!node) return false;
                const rect = node.getBoundingClientRect();
                return event.clientY >= rect.top && event.clientY <= rect.bottom;
            });

            if (!hoveredProvider || hoveredProvider.id === draggingId) return;

            const hoveredNode = providerCardRefs.current[hoveredProvider.id];
            if (!hoveredNode) return;

            const rect = hoveredNode.getBoundingClientRect();
            const position = event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before';
            const hoverKey = `${hoveredProvider.id}:${position}`;

            if (dragSessionRef.current?.lastHoverKey === hoverKey) {
                return;
            }

            dragSessionRef.current = {
                providerId: draggingId,
                lastHoverKey: hoverKey,
            };
            onReorderProvider(draggingId, hoveredProvider.id, position);
        };

        const handlePointerUp = () => {
            dragSessionRef.current = null;
            setDraggingProviderId(null);
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [draggingProviderId, onReorderProvider, providers]);

    const focusSelectedModelGroup = () => {
        if (!currentProvider?.model) return;

        setActiveGroup(selectedModelGroup);
        onSetModelQuery('');

        window.requestAnimationFrame(() => {
            modelItemRefs.current[currentProvider.model]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        });
    };

    const handleProviderPointerDown = (
        event: React.PointerEvent<HTMLDivElement>,
        providerId: string
    ) => {
        if (event.button !== 0) return;

        event.preventDefault();
        dragSessionRef.current = {
            providerId,
            lastHoverKey: null,
        };
        setDraggingProviderId(providerId);
        onSelectProvider(providerId);
    };

    return (
        <div className="manga-flow-settings__providers">
            <aside className="manga-flow-settings__provider-list">
                <div className="manga-flow-settings__provider-list-head">
                    <div>
                        <strong>已启用 {providers.filter((provider) => provider.enabled).length} / {providers.length}</strong>
                        <span>按优先级依次回退调用</span>
                    </div>
                    <button
                        type="button"
                        className="manga-flow-settings__accent-btn manga-flow-settings__provider-add-btn"
                        onClick={onAddProvider}
                    >
                        <Plus size={15} strokeWidth={2} />
                        <span>新增</span>
                    </button>
                </div>

                <div className="manga-flow-settings__provider-stack">
                    {providers.map((provider, index) => (
                        <div
                            key={provider.id}
                            className={[
                                'manga-flow-settings__provider-card',
                                provider.id === currentProvider?.id ? 'is-active' : '',
                                draggingProviderId === provider.id ? 'is-dragging' : '',
                            ].filter(Boolean).join(' ')}
                            role="button"
                            tabIndex={0}
                            aria-pressed={provider.id === currentProvider?.id}
                            ref={(node) => {
                                providerCardRefs.current[provider.id] = node;
                            }}
                            onClick={() => {
                                if (!draggingProviderId) {
                                    onSelectProvider(provider.id);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onSelectProvider(provider.id);
                                }
                            }}
                        >
                            <div
                                className="manga-flow-settings__provider-card-rank"
                                onPointerDown={(event) => handleProviderPointerDown(event, provider.id)}
                            >
                                <GripVertical size={14} strokeWidth={1.8} />
                                <span>{index + 1}</span>
                            </div>
                            <div className="manga-flow-settings__provider-card-copy">
                                <strong>{provider.name}</strong>
                                <span>{provider.apiBaseUrl || '未填写 Base URL'}</span>
                            </div>
                            <MiniSwitch checked={provider.enabled} readOnly />
                        </div>
                    ))}
                </div>
            </aside>

            <div className="manga-flow-settings__provider-detail">
                {currentProvider ? (
                    <>
                        <div className="manga-flow-settings__provider-detail-head">
                            <div>
                                <h4>{currentProvider.name}</h4>
                                <p>
                                    优先级 #{currentIndex + 1}
                                    {' · '}
                                    {currentProvider.enabled ? '已启用' : '已停用'}
                                </p>
                            </div>

                            <div className="manga-flow-settings__provider-detail-actions">
                                <button
                                    type="button"
                                    className="manga-flow-settings__mini-icon-btn"
                                    onClick={() => onMoveProvider(currentProvider.id, -1)}
                                    disabled={currentIndex <= 0}
                                    aria-label="上移服务商优先级"
                                >
                                    <ArrowUp size={15} strokeWidth={2} />
                                </button>
                                <button
                                    type="button"
                                    className="manga-flow-settings__mini-icon-btn"
                                    onClick={() => onMoveProvider(currentProvider.id, 1)}
                                    disabled={currentIndex >= providers.length - 1}
                                    aria-label="下移服务商优先级"
                                >
                                    <ArrowDown size={15} strokeWidth={2} />
                                </button>
                                <button
                                    type="button"
                                    className="manga-flow-settings__danger-btn"
                                    onClick={() => onRemoveProvider(currentProvider.id)}
                                    disabled={providers.length <= 1}
                                >
                                    <Trash2 size={15} strokeWidth={1.9} />
                                    <span>删除</span>
                                </button>
                                <div className="manga-flow-settings__switch-inline">
                                    <span>启用</span>
                                    <MiniSwitch
                                        checked={currentProvider.enabled}
                                        onChange={(value) => onToggleProvider(currentProvider.id, value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="manga-flow-settings__provider-form">
                            <Field label="服务商名称">
                                <input
                                    className="manga-flow-settings__input"
                                    type="text"
                                    value={currentProvider.name}
                                    onChange={(event) => onUpdateProvider(currentProvider.id, { name: event.target.value })}
                                    placeholder="例如：LongCat / DeepSeek / 自建网关"
                                />
                            </Field>

                            <div className="manga-flow-settings__grid manga-flow-settings__grid--provider-credentials">
                                <Field label="API Base URL" helper={`预览：${currentProviderPreview}`}>
                                    <input
                                        className="manga-flow-settings__input"
                                        type="text"
                                        value={currentProvider.apiBaseUrl}
                                        onChange={(event) => onUpdateProvider(currentProvider.id, { apiBaseUrl: event.target.value })}
                                        placeholder="例如：https://example.com"
                                    />
                                </Field>

                                <Field label="API Key">
                                    <PasswordField
                                        value={currentProvider.apiKey}
                                        visible={Boolean(visibleKeys[currentProvider.id])}
                                        placeholder="请输入 API Key"
                                        onToggleVisibility={() => setVisibleKeys((current) => ({
                                            ...current,
                                            [currentProvider.id]: !current[currentProvider.id],
                                        }))}
                                        onChange={(value) => onUpdateProvider(currentProvider.id, { apiKey: value })}
                                    />
                                </Field>
                            </div>

                            <div className="manga-flow-settings__provider-tool-row">
                                <button
                                    type="button"
                                    className="manga-flow-settings__accent-btn manga-flow-settings__accent-btn--green"
                                    onClick={() => onTestProvider(currentProvider.id)}
                                    disabled={Boolean(testingProviders[currentProvider.id])}
                                >
                                    {testingProviders[currentProvider.id] ? (
                                        <LoaderCircle className="mf-button__spinner" size={15} />
                                    ) : (
                                        <RefreshCw size={15} strokeWidth={1.8} />
                                    )}
                                    <span>测试连接</span>
                                </button>

                                <button
                                    type="button"
                                    className="manga-flow-settings__accent-btn manga-flow-settings__accent-btn--blue"
                                    onClick={() => onFetchModels(currentProvider.id, 'manual')}
                                    disabled={Boolean(loadingProviderModels[currentProvider.id])}
                                >
                                    {loadingProviderModels[currentProvider.id] ? (
                                        <LoaderCircle className="mf-button__spinner" size={15} />
                                    ) : (
                                        <RefreshCw size={15} strokeWidth={1.8} />
                                    )}
                                    <span>拉取模型</span>
                                </button>
                            </div>

                            {providerFeedback[currentProvider.id]?.test ? (
                                <InlineStatus state={providerFeedback[currentProvider.id]?.test!} />
                            ) : null}
                            {providerFeedback[currentProvider.id]?.models ? (
                                <InlineStatus state={providerFeedback[currentProvider.id]?.models!} />
                            ) : null}

                            <div className="manga-flow-settings__model-manager">
                                <div className="manga-flow-settings__model-toolbar">
                                    <label className="manga-flow-settings__model-toolbar-label">模型列表</label>
                                    <div className="manga-flow-settings__model-filter-row">
                                        <div className="manga-flow-settings__model-filter-tags">
                                            <button
                                                type="button"
                                                className={`manga-flow-settings__model-filter-tag ${activeGroup === 'all' ? 'is-active' : ''}`.trim()}
                                                onClick={() => setActiveGroup('all')}
                                            >
                                                全部
                                            </button>
                                            {groupedModels.map((group) => (
                                                <button
                                                    key={group.key}
                                                    type="button"
                                                    className={`manga-flow-settings__model-filter-tag ${activeGroup === group.key ? 'is-active' : ''}`.trim()}
                                                    onClick={() => setActiveGroup(group.key)}
                                                >
                                                    {group.label}
                                                </button>
                                            ))}
                                        </div>
                                        {currentProvider.model ? (
                                            <button
                                                type="button"
                                                className="manga-flow-settings__selected-model-chip"
                                                onClick={focusSelectedModelGroup}
                                            >
                                                <span className="manga-flow-settings__selected-model-dot" />
                                                <span>{currentProvider.model}</span>
                                            </button>
                                        ) : null}
                                    </div>
                                    <div className="manga-flow-settings__model-toolbar-fields">
                                        <div className="manga-flow-settings__search">
                                            <Search size={14} strokeWidth={2} />
                                            <input
                                                type="text"
                                                placeholder="搜索模型"
                                                value={modelQuery}
                                                onChange={(event) => onSetModelQuery(event.target.value)}
                                            />
                                        </div>

                                        <div className="manga-flow-settings__manual-model">
                                            <input
                                                className="manga-flow-settings__input"
                                                type="text"
                                                placeholder="手动添加模型，如 LongCat-Flash-Chat"
                                                value={manualModelName}
                                                onChange={(event) => onSetManualModelName(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        onManualAddModel();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="manga-flow-settings__accent-btn manga-flow-settings__accent-btn--violet"
                                                onClick={onManualAddModel}
                                            >
                                                <Plus size={15} strokeWidth={2} />
                                                <span>添加模型</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="manga-flow-settings__model-list">
                                    {visibleModels.length > 0 ? (
                                        visibleModels.map((model) => {
                                            const selected = currentProvider.model === model;
                                            return (
                                                <div
                                                    key={model}
                                                    ref={(node) => {
                                                        modelItemRefs.current[model] = node;
                                                    }}
                                                    className={`manga-flow-settings__model-item ${selected ? 'is-selected' : ''}`.trim()}
                                                >
                                                    <button
                                                        type="button"
                                                        className="manga-flow-settings__model-select"
                                                        onClick={() => onSelectModel(model)}
                                                    >
                                                        <span className="manga-flow-settings__model-dot" />
                                                        <span className="manga-flow-settings__model-name">{model}</span>
                                                        {selected ? <span className="manga-flow-settings__model-badge">默认</span> : null}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="manga-flow-settings__model-remove"
                                                        aria-label={`删除模型 ${model}`}
                                                        onClick={() => onRemoveModel(currentProvider.id, model)}
                                                    >
                                                        <Trash2 size={14} strokeWidth={1.9} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="manga-flow-settings__empty">
                                            <Bot size={18} strokeWidth={1.8} />
                                            <span>当前还没有可用模型，请先拉取或手动添加。</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

interface ModelGroup {
    key: string;
    label: string;
    models: string[];
}

function groupModelsByPrefix(models: string[]): ModelGroup[] {
    const grouped = new Map<string, string[]>();

    for (const model of models) {
        const groupKey = getModelGroupKey(model);
        const currentGroup = grouped.get(groupKey) || [];
        currentGroup.push(model);
        grouped.set(groupKey, currentGroup);
    }

    return Array.from(grouped.entries())
        .map(([key, values]) => ({
            key,
            label: formatModelGroupLabel(key),
            models: [...values].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' }));
}

function getModelGroupKey(model: string): string {
    const trimmed = model.trim().toLowerCase();
    const prefix = trimmed.split(/[-_:/\s]/)[0] || 'other';
    return prefix.replace(/[^a-z0-9]+/g, '') || 'other';
}

function formatModelGroupLabel(groupKey: string): string {
    const knownLabels: Record<string, string> = {
        gpt: 'GPT',
        claude: 'Claude',
        grok: 'Grok',
        gemini: 'Gemini',
        deepseek: 'DeepSeek',
        qwen: 'Qwen',
        glm: 'GLM',
    };

    if (knownLabels[groupKey]) {
        return knownLabels[groupKey];
    }

    if (groupKey === 'other') {
        return '其他';
    }

    return groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
}

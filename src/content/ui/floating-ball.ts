// 漫译 MangaFlow - 贴边悬浮球组件
// 右侧吸附、仅上下拖拽、hover 显示关闭、翻译完成后显示切换 icon

import type { FloatingBallState } from '../../types';

type ViewMode = 'original' | 'translated';

interface FloatingBallOptions {
    onStart: () => void;
    onPause: () => void;
    onSettings: () => void;
    onDisableSite: () => void;
    onDisableGlobal: () => void;
    onToggleView: () => void;
}

export class FloatingBall {
    private element: HTMLElement | null = null;
    private progressText: HTMLElement | null = null;
    private timerText: HTMLElement | null = null;
    private mainBtn: HTMLButtonElement | null = null;
    private settingsBtn: HTMLButtonElement | null = null;
    private toggleBtn: HTMLButtonElement | null = null;
    private disableMenu: HTMLElement | null = null;

    private state: FloatingBallState = 'idle';
    private options: FloatingBallOptions;
    private isDragging = false;
    private dragStartY = 0;
    private dragOffsetY = 0;
    private ballOffsetY = 120;
    private hasTranslationResult = false;
    private viewMode: ViewMode = 'translated';
    private disableMenuOpen = false;
    private ignoreClickUntil = 0;

    constructor(options: FloatingBallOptions) {
        this.options = options;
    }

    mount(): void {
        this.createElement();
        this.bindEvents();
        this.applyBallOffset();
        this.setVisible(false);
        this.setHasTranslationResult(false);
        this.setViewMode('translated');
    }

    private createElement(): void {
        const iconUrl = chrome.runtime.getURL('icons/icon48.png');

        this.element = document.createElement('div');
        this.element.id = 'manga-flow-ball';
        this.element.className = 'manga-flow-ball manga-flow-ball--idle';
        this.element.innerHTML = `
            <div class="manga-flow-ball__timer" aria-live="polite"></div>
            <div class="manga-flow-ball__shell">
                <button class="manga-flow-ball__close" type="button" title="关闭悬浮球" aria-label="关闭悬浮球">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18" />
                        <path d="M6 6L18 18" />
                    </svg>
                </button>

                <div class="manga-flow-ball__disable-menu">
                    <button class="manga-flow-ball__disable-item" type="button" data-action="site">禁用此网站</button>
                    <button class="manga-flow-ball__disable-item" type="button" data-action="global">全局禁用</button>
                </div>

                <div class="manga-flow-ball__container">
                    <button class="manga-flow-ball__main" type="button" title="开始翻译" aria-label="开始翻译">
                        <span class="manga-flow-ball__main-circle">
                            <img class="manga-flow-ball__icon" src="${iconUrl}" alt="MangaFlow" />
                            <span class="manga-flow-ball__spinner"></span>
                        </span>
                    </button>
                    <button class="manga-flow-ball__settings" type="button" title="打开设置" aria-label="打开设置">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.8" />
                            <circle cx="12" cy="12" r="1.8" />
                            <circle cx="12" cy="19" r="1.8" />
                        </svg>
                    </button>
                    <button class="manga-flow-ball__toggle" type="button" title="切换原文/译文" aria-label="切换原文/译文">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12.87 15.07 11 13.2l.07-.19a14.1 14.1 0 0 0 2.61-4.02h2.18V7h-5V5H8.86v2H4v1.99h7.17a11.4 11.4 0 0 1-2.25 4.01 9.75 9.75 0 0 1-1.69-2.27H5.24a12.55 12.55 0 0 0 2.47 3.34L3.96 18l1.41 1.41 3.75-3.75 2.33 2.33 1.42-1.51ZM18.5 10h-2L12 22h2l1.12-3h4.76L21 22h2l-4.5-12Zm-2.25 7 1.25-3.34L18.75 17h-2.5Z" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="manga-flow-ball__progress" aria-live="polite"></div>
        `;

        this.progressText = this.element.querySelector('.manga-flow-ball__progress');
        this.timerText = this.element.querySelector('.manga-flow-ball__timer');
        this.mainBtn = this.element.querySelector('.manga-flow-ball__main');
        this.settingsBtn = this.element.querySelector('.manga-flow-ball__settings');
        this.toggleBtn = this.element.querySelector('.manga-flow-ball__toggle');
        this.disableMenu = this.element.querySelector('.manga-flow-ball__disable-menu');

        document.body.appendChild(this.element);
    }

    private bindEvents(): void {
        if (!this.element) return;

        this.mainBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.shouldIgnoreClick()) return;
            this.closeDisableMenu();
            this.handleMainClick();
        });

        this.settingsBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.shouldIgnoreClick()) return;
            this.closeDisableMenu();
            this.options.onSettings();
        });

        this.toggleBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.shouldIgnoreClick() || !this.hasTranslationResult) return;
            this.closeDisableMenu();
            this.options.onToggleView();
        });

        const closeBtn = this.element.querySelector('.manga-flow-ball__close');
        closeBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.shouldIgnoreClick()) return;
            this.toggleDisableMenu();
        });

        this.disableMenu?.querySelector('[data-action="site"]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.closeDisableMenu();
            this.options.onDisableSite();
        });

        this.disableMenu?.querySelector('[data-action="global"]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.closeDisableMenu();
            this.options.onDisableGlobal();
        });

        this.element.addEventListener('mousedown', this.handleMouseDown);
        this.element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleDragEnd);
        document.addEventListener('touchmove', this.handleTouchMove, { passive: true });
        document.addEventListener('touchend', this.handleDragEnd);
        document.addEventListener('click', this.handleDocumentClick);
        window.addEventListener('resize', this.handleResize);
    }

    private readonly handleMouseDown = (event: MouseEvent): void => {
        this.beginDrag(event.clientY, event.target as HTMLElement | null);
    };

    private readonly handleTouchStart = (event: TouchEvent): void => {
        this.beginDrag(event.touches[0].clientY, event.target as HTMLElement | null);
    };

    private beginDrag(clientY: number, target: HTMLElement | null): void {
        if (!this.element) return;

        const interactiveTarget = target?.closest('button');
        if (interactiveTarget?.classList.contains('manga-flow-ball__close') || interactiveTarget?.classList.contains('manga-flow-ball__disable-item')) {
            this.dragStartY = 0;
            return;
        }

        this.dragStartY = clientY;
        this.dragOffsetY = this.element.getBoundingClientRect().top;
        this.isDragging = false;
    }

    private readonly handleMouseMove = (event: MouseEvent): void => {
        this.handleDragMove(event.clientY);
    };

    private readonly handleTouchMove = (event: TouchEvent): void => {
        this.handleDragMove(event.touches[0].clientY);
    };

    private handleDragMove(clientY: number): void {
        if (!this.element || this.dragStartY === 0) return;

        const deltaY = clientY - this.dragStartY;
        if (!this.isDragging && Math.abs(deltaY) >= 6) {
            this.isDragging = true;
            this.closeDisableMenu();
        }

        if (!this.isDragging) return;

        this.ballOffsetY = this.clampOffset(this.dragOffsetY + deltaY);
        this.applyBallOffset();
    }

    private readonly handleDragEnd = (): void => {
        if (this.isDragging) {
            this.ignoreClickUntil = Date.now() + 180;
        }
        this.isDragging = false;
        this.dragStartY = 0;
        this.dragOffsetY = 0;
    };

    private readonly handleDocumentClick = (event: MouseEvent): void => {
        if (!this.element) return;
        const target = event.target as Node | null;
        if (target && this.element.contains(target)) return;
        this.closeDisableMenu();
    };

    private readonly handleResize = (): void => {
        this.ballOffsetY = this.clampOffset(this.ballOffsetY);
        this.applyBallOffset();
    };

    private handleMainClick(): void {
        switch (this.state) {
            case 'idle':
            case 'completed':
            case 'error':
                this.options.onStart();
                break;
            case 'translating':
                this.options.onPause();
                break;
            case 'paused':
                this.options.onStart();
                break;
        }
    }

    private shouldIgnoreClick(): boolean {
        return Date.now() < this.ignoreClickUntil;
    }

    private toggleDisableMenu(): void {
        this.disableMenuOpen = !this.disableMenuOpen;
        this.element?.classList.toggle('manga-flow-ball--disable-open', this.disableMenuOpen);
    }

    private closeDisableMenu(): void {
        if (!this.disableMenuOpen) return;
        this.disableMenuOpen = false;
        this.element?.classList.remove('manga-flow-ball--disable-open');
    }

    private applyBallOffset(): void {
        if (!this.element) return;
        this.element.style.top = `${this.clampOffset(this.ballOffsetY)}px`;
    }

    private clampOffset(offsetY: number): number {
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
        const shellHeight = this.element?.querySelector('.manga-flow-ball__shell')?.getBoundingClientRect().height || 46;
        const timerHeight = this.timerText?.textContent ? 30 : 0;
        const progressHeight = this.progressText?.textContent ? 30 : 0;
        const minTop = 16 + timerHeight;
        const maxTop = Math.max(minTop, viewportHeight - shellHeight - progressHeight - 18);
        return Math.max(minTop, Math.min(offsetY, maxTop));
    }

    setVisible(visible: boolean): void {
        if (!this.element) return;
        this.element.classList.toggle('manga-flow-ball--visible', visible);
        if (!visible) {
            this.closeDisableMenu();
        }
    }

    show(): void {
        this.setVisible(true);
    }

    hide(): void {
        this.setVisible(false);
    }

    setState(state: FloatingBallState): void {
        this.state = state;
        if (!this.element || !this.mainBtn) return;

        this.element.classList.remove(
            'manga-flow-ball--idle',
            'manga-flow-ball--translating',
            'manga-flow-ball--paused',
            'manga-flow-ball--completed',
            'manga-flow-ball--error'
        );
        this.element.classList.add(`manga-flow-ball--${state}`);

        const titleMap: Record<FloatingBallState, string> = {
            idle: '开始翻译',
            translating: '暂停翻译',
            paused: '继续翻译',
            completed: '重新翻译',
            error: '重新尝试翻译',
        };

        this.mainBtn.title = titleMap[state];
        this.mainBtn.setAttribute('aria-label', titleMap[state]);
    }

    setElapsedTime(elapsedMs: number | null): void {
        if (!this.timerText) return;

        if (elapsedMs === null) {
            this.timerText.textContent = '';
            this.timerText.style.display = 'none';
        } else {
            this.timerText.textContent = `${Math.max(0, elapsedMs / 1000).toFixed(1)}s`;
            this.timerText.style.display = 'inline-flex';
        }

        this.ballOffsetY = this.clampOffset(this.ballOffsetY);
        this.applyBallOffset();
    }

    updateProgress(current: number, total: number): void {
        if (!this.progressText) return;
        this.progressText.textContent = `${current}/${total}`;
        this.progressText.style.display = 'inline-flex';
        this.ballOffsetY = this.clampOffset(this.ballOffsetY);
        this.applyBallOffset();
    }

    hideProgress(): void {
        if (!this.progressText) return;
        this.progressText.textContent = '';
        this.progressText.style.display = 'none';
        this.ballOffsetY = this.clampOffset(this.ballOffsetY);
        this.applyBallOffset();
    }

    setHasTranslationResult(hasResult: boolean): void {
        this.hasTranslationResult = hasResult;
        if (!this.element || !this.toggleBtn) return;
        this.element.classList.toggle('manga-flow-ball--has-toggle', hasResult);
        this.toggleBtn.disabled = !hasResult;
        if (!hasResult) {
            this.closeDisableMenu();
        }
    }

    setViewMode(viewMode: ViewMode): void {
        this.viewMode = viewMode;
        if (!this.element || !this.toggleBtn) return;

        this.element.classList.toggle('manga-flow-ball--view-original', viewMode === 'original');
        const label = viewMode === 'translated' ? '显示原图' : '显示译图';
        this.toggleBtn.title = label;
        this.toggleBtn.setAttribute('aria-label', label);
    }

    unmount(): void {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleDragEnd);
        document.removeEventListener('click', this.handleDocumentClick);
        window.removeEventListener('resize', this.handleResize);
        this.element?.remove();
    }
}

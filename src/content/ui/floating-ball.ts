// 漫译 MangaFlow - 悬浮球组件
// 黑白简洁风格的悬浮球 UI

import type { FloatingBallState } from '../../types';

interface FloatingBallOptions {
    onStart: () => void;
    onPause: () => void;
    onSettings: () => void;
}

export class FloatingBall {
    private element: HTMLElement | null = null;
    private progressText: HTMLElement | null = null;
    private state: FloatingBallState = 'idle';
    private options: FloatingBallOptions;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };

    constructor(options: FloatingBallOptions) {
        this.options = options;
    }

    mount(): void {
        this.createElement();
        this.bindEvents();
    }

    private createElement(): void {
        // 创建容器
        this.element = document.createElement('div');
        this.element.id = 'manga-flow-ball';
        this.element.className = 'manga-flow-ball';
        this.element.innerHTML = `
      <div class="manga-flow-ball__main" title="点击开始翻译">
        <svg class="manga-flow-ball__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span class="manga-flow-ball__text">译</span>
      </div>
      <div class="manga-flow-ball__progress"></div>
      <button class="manga-flow-ball__settings" title="设置">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    `;

        this.progressText = this.element.querySelector('.manga-flow-ball__progress');
        document.body.appendChild(this.element);
    }

    private bindEvents(): void {
        if (!this.element) return;

        const mainBtn = this.element.querySelector('.manga-flow-ball__main');
        const settingsBtn = this.element.querySelector('.manga-flow-ball__settings');

        // 主按钮点击
        mainBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isDragging) return;
            this.handleMainClick();
        });

        // 设置按钮点击
        settingsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.options.onSettings();
        });

        // 拖拽功能
        this.element.addEventListener('mousedown', this.handleDragStart.bind(this));
        document.addEventListener('mousemove', this.handleDragMove.bind(this));
        document.addEventListener('mouseup', this.handleDragEnd.bind(this));

        // 触摸设备支持
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('touchend', this.handleDragEnd.bind(this));
    }

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

    private handleDragStart(e: MouseEvent): void {
        if ((e.target as HTMLElement).closest('.manga-flow-ball__settings')) return;
        this.isDragging = false;
        this.dragOffset = {
            x: e.clientX - (this.element?.offsetLeft || 0),
            y: e.clientY - (this.element?.offsetTop || 0),
        };
    }

    private handleDragMove(e: MouseEvent): void {
        if (this.dragOffset.x === 0 && this.dragOffset.y === 0) return;
        this.isDragging = true;
        if (this.element) {
            this.element.style.left = `${e.clientX - this.dragOffset.x}px`;
            this.element.style.top = `${e.clientY - this.dragOffset.y}px`;
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
        }
    }

    private handleDragEnd(): void {
        setTimeout(() => {
            this.isDragging = false;
        }, 100);
        this.dragOffset = { x: 0, y: 0 };
    }

    private handleTouchStart(e: TouchEvent): void {
        const touch = e.touches[0];
        this.dragOffset = {
            x: touch.clientX - (this.element?.offsetLeft || 0),
            y: touch.clientY - (this.element?.offsetTop || 0),
        };
    }

    private handleTouchMove(e: TouchEvent): void {
        if (this.dragOffset.x === 0 && this.dragOffset.y === 0) return;
        const touch = e.touches[0];
        this.isDragging = true;
        if (this.element) {
            this.element.style.left = `${touch.clientX - this.dragOffset.x}px`;
            this.element.style.top = `${touch.clientY - this.dragOffset.y}px`;
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
        }
    }

    setState(state: FloatingBallState): void {
        this.state = state;
        if (!this.element) return;

        // 移除所有状态类
        this.element.classList.remove(
            'manga-flow-ball--idle',
            'manga-flow-ball--translating',
            'manga-flow-ball--paused',
            'manga-flow-ball--completed',
            'manga-flow-ball--error'
        );

        // 添加当前状态类
        this.element.classList.add(`manga-flow-ball--${state}`);

        // 更新图标
        const textEl = this.element.querySelector('.manga-flow-ball__text');
        if (textEl) {
            const icons: Record<FloatingBallState, string> = {
                idle: '译',
                translating: '⏳',
                paused: '⏸',
                completed: '✓',
                error: '✗',
            };
            textEl.textContent = icons[state];
        }
    }

    updateProgress(current: number, total: number): void {
        if (this.progressText) {
            this.progressText.textContent = `${current}/${total}`;
            this.progressText.style.display = 'block';
        }
    }

    unmount(): void {
        this.element?.remove();
    }
}

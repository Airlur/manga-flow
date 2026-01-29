// 漫译 MangaFlow - 悬浮球组件
// 小图标样式，类似"陪读蛙"的精致风格

import type { FloatingBallState } from '../../types';

interface FloatingBallOptions {
    onStart: () => void;
    onPause: () => void;
    onSettings: () => void;
}

export class FloatingBall {
    private element: HTMLElement | null = null;
    private progressText: HTMLElement | null = null;
    private mainBtn: HTMLElement | null = null;
    private state: FloatingBallState = 'idle';
    private options: FloatingBallOptions;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };
    private dragStartTime = 0;

    constructor(options: FloatingBallOptions) {
        this.options = options;
    }

    mount(): void {
        this.createElement();
        this.bindEvents();
    }

    private createElement(): void {
        // 获取扩展图标 URL
        const iconUrl = chrome.runtime.getURL('icons/icon48.png');

        // 创建容器
        this.element = document.createElement('div');
        this.element.id = 'manga-flow-ball';
        this.element.className = 'manga-flow-ball';
        this.element.innerHTML = `
            <div class="manga-flow-ball__container">
                <button class="manga-flow-ball__main" title="点击开始翻译">
                    <img class="manga-flow-ball__icon" src="${iconUrl}" alt="MangaFlow" />
                    <div class="manga-flow-ball__spinner"></div>
                </button>
                <button class="manga-flow-ball__settings" title="设置">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="6" cy="12" r="1.5"/>
                        <circle cx="12" cy="12" r="1.5"/>
                        <circle cx="18" cy="12" r="1.5"/>
                    </svg>
                </button>
            </div>
            <div class="manga-flow-ball__progress"></div>
        `;

        this.progressText = this.element.querySelector('.manga-flow-ball__progress');
        this.mainBtn = this.element.querySelector('.manga-flow-ball__main');
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
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
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
        this.dragStartTime = Date.now();
        this.isDragging = false;
        this.dragOffset = {
            x: e.clientX - (this.element?.offsetLeft || 0),
            y: e.clientY - (this.element?.offsetTop || 0),
        };
    }

    private handleDragMove(e: MouseEvent): void {
        if (this.dragOffset.x === 0 && this.dragOffset.y === 0) return;
        // 只有移动超过 5px 或持续 150ms 以上才认为是拖拽
        if (!this.isDragging && Date.now() - this.dragStartTime > 150) {
            this.isDragging = true;
        }
        if (this.element && this.isDragging) {
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
        this.dragStartTime = Date.now();
        this.dragOffset = {
            x: touch.clientX - (this.element?.offsetLeft || 0),
            y: touch.clientY - (this.element?.offsetTop || 0),
        };
    }

    private handleTouchMove(e: TouchEvent): void {
        if (this.dragOffset.x === 0 && this.dragOffset.y === 0) return;
        const touch = e.touches[0];
        if (!this.isDragging && Date.now() - this.dragStartTime > 150) {
            this.isDragging = true;
        }
        if (this.element && this.isDragging) {
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
    }

    updateProgress(current: number, total: number): void {
        if (this.progressText) {
            this.progressText.textContent = `${current}/${total}`;
            this.progressText.style.display = 'block';
        }
    }

    hideProgress(): void {
        if (this.progressText) {
            this.progressText.style.display = 'none';
        }
    }

    unmount(): void {
        this.element?.remove();
    }
}

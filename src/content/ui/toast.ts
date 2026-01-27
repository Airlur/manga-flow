// 漫译 MangaFlow - Toast 提示组件

type ToastType = 'success' | 'error' | 'warning' | 'info';

let toastContainer: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
    if (toastContainer && document.body.contains(toastContainer)) {
        return toastContainer;
    }

    toastContainer = document.createElement('div');
    toastContainer.id = 'manga-flow-toast-container';
    toastContainer.className = 'manga-flow-toast-container';
    document.body.appendChild(toastContainer);

    return toastContainer;
}

export function showToast(message: string, type: ToastType = 'info', duration: number = 3000): void {
    const container = ensureContainer();

    const toast = document.createElement('div');
    toast.className = `manga-flow-toast manga-flow-toast--${type}`;

    // 图标
    const icons: Record<ToastType, string> = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ',
    };

    toast.innerHTML = `
    <span class="manga-flow-toast__icon">${icons[type]}</span>
    <span class="manga-flow-toast__message">${message}</span>
  `;

    container.appendChild(toast);

    // 动画进入
    requestAnimationFrame(() => {
        toast.classList.add('manga-flow-toast--visible');
    });

    // 自动消失
    setTimeout(() => {
        toast.classList.remove('manga-flow-toast--visible');
        toast.classList.add('manga-flow-toast--hiding');

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

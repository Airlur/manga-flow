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

export function showToast(message: string, type: ToastType = 'info', duration = 3000): void {
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `manga-flow-toast manga-flow-toast--${type}`;

    const icons: Record<ToastType, string> = {
        success: '?',
        error: '?',
        warning: '!',
        info: 'i',
    };

    const icon = document.createElement('span');
    icon.className = 'manga-flow-toast__icon';
    icon.textContent = icons[type];

    const text = document.createElement('span');
    text.className = 'manga-flow-toast__message';
    text.textContent = message;

    toast.append(icon, text);
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('manga-flow-toast--visible');
    });

    window.setTimeout(() => {
        toast.classList.remove('manga-flow-toast--visible');
        toast.classList.add('manga-flow-toast--hiding');

        window.setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

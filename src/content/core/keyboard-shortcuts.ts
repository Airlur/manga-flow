import type { KeyboardShortcut, KeyboardShortcutsConfig, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../config/default-settings';

type ShortcutHandler = () => void | Promise<void>;

interface ShortcutHandlers {
    toggleTranslation?: ShortcutHandler;
    clearCache?: ShortcutHandler;
    switchEngine?: ShortcutHandler;
    pauseOCR?: ShortcutHandler;
    invokeSelection?: ShortcutHandler;
    exportCurrent?: ShortcutHandler;
}

export class KeyboardShortcutsManager {
    private handlers: ShortcutHandlers = {};
    private isListening = false;
    private settings: KeyboardShortcutsConfig | null = null;
    private boundHandleKeyDown: ((event: KeyboardEvent) => void) | null = null;

    constructor() {
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    }

    updateSettings(settings: KeyboardShortcutsConfig): void {
        this.settings = settings;
    }

    setHandlers(handlers: ShortcutHandlers): void {
        this.handlers = handlers;
    }

    startListening(): void {
        if (this.isListening) return;
        this.isListening = true;
        document.addEventListener('keydown', this.boundHandleKeyDown!, true);
    }

    stopListening(): void {
        if (!this.isListening) return;
        this.isListening = false;
        document.removeEventListener('keydown', this.boundHandleKeyDown!, true);
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (!this.settings) return;

        const isInputFocused = this.isInputElement(document.activeElement);
        if (isInputFocused) return;

        const shortcuts = this.settings;
        const targetKey = event.key.toUpperCase();

        if (this.matchesShortcut(event, shortcuts.toggleTranslation, targetKey)) {
            event.preventDefault();
            event.stopPropagation();
            void this.handlers.toggleTranslation?.();
            return;
        }

        if (this.matchesShortcut(event, shortcuts.clearCache, targetKey)) {
            event.preventDefault();
            event.stopPropagation();
            void this.handlers.clearCache?.();
            return;
        }

        if (this.matchesShortcut(event, shortcuts.switchEngine, targetKey)) {
            event.preventDefault();
            event.stopPropagation();
            void this.handlers.switchEngine?.();
            return;
        }

        if (this.matchesShortcut(event, shortcuts.pauseOCR, targetKey)) {
            event.preventDefault();
            event.stopPropagation();
            void this.handlers.pauseOCR?.();
            return;
        }

        if (this.matchesShortcut(event, shortcuts.invokeSelection, targetKey)) {
            event.preventDefault();
            event.stopPropagation();
            void this.handlers.invokeSelection?.();
            return;
        }

        if (this.matchesShortcut(event, shortcuts.exportCurrent, targetKey)) {
            event.preventDefault();
            event.stopPropagation();
            void this.handlers.exportCurrent?.();
            return;
        }
    }

    private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut, targetKey: string): boolean {
        if (!shortcut.enabled) return false;
        if (shortcut.key.toUpperCase() !== targetKey) return false;

        const ctrlMatch = shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const altMatch = shortcut.alt === event.altKey;
        const shiftMatch = shortcut.shift === event.shiftKey;

        return ctrlMatch && altMatch && shiftMatch;
    }

    private isInputElement(element: Element | null): boolean {
        if (!element) return false;
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return true;
        }
        return (element as HTMLElement).isContentEditable === true;
    }

    static formatShortcutDisplay(shortcut: KeyboardShortcut): string {
        const parts: string[] = [];
        if (shortcut.ctrl) parts.push('Ctrl');
        if (shortcut.alt) parts.push('Alt');
        if (shortcut.shift) parts.push('Shift');
        parts.push(shortcut.key.toUpperCase());
        return parts.join(' + ');
    }

    static shortcutToString(shortcut: KeyboardShortcut): string {
        let str = '';
        if (shortcut.ctrl) str += 'Ctrl+';
        if (shortcut.alt) str += 'Alt+';
        if (shortcut.shift) str += 'Shift+';
        str += shortcut.key.toUpperCase();
        return str;
    }
}

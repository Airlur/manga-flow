import { Check, ChevronDown } from 'lucide-react';
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption<T extends string = string> {
    value: T;
    label: string;
    description?: string;
    shortLabel?: string;
    group?: string;
}

interface DropdownSelectProps<T extends string> {
    value: T;
    options: DropdownOption<T>[];
    onChange: (value: T) => void;
    ariaLabel: string;
    placeholder?: string;
    disabled?: boolean;
    size?: 'default' | 'compact';
    renderSelected?: (option: DropdownOption<T>) => ReactNode;
    renderOptionLeading?: (option: DropdownOption<T>, selected: boolean) => ReactNode;
    className?: string;
}

export function DropdownSelect<T extends string>({
    value,
    options,
    onChange,
    ariaLabel,
    placeholder,
    disabled = false,
    size = 'default',
    renderSelected,
    renderOptionLeading,
    className = '',
}: DropdownSelectProps<T>) {
    const listboxId = useId();
    const rootRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value) ?? options[0],
        [options, value]
    );

    useEffect(() => {
        if (!open) return;

        const selectedIndex = Math.max(
            0,
            options.findIndex((option) => option.value === value)
        );
        setActiveIndex(selectedIndex);

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;

            if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        window.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleEscape as unknown as EventListener);
        return () => {
            window.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape as unknown as EventListener);
        };
    }, [open, options, value]);

    useLayoutEffect(() => {
        if (!open) return;

        const updatePopoverPosition = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;

            const rect = trigger.getBoundingClientRect();
            const margin = 10;
            const gap = 8;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const spaceAbove = rect.top - margin;
            const spaceBelow = viewportHeight - rect.bottom - margin;
            const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
            const maxHeight = Math.max(120, Math.min(260, (openAbove ? spaceAbove : spaceBelow) - gap));
            const width = Math.min(rect.width, viewportWidth - margin * 2);
            const left = Math.min(Math.max(rect.left, margin), Math.max(margin, viewportWidth - width - margin));

            setPopoverStyle(
                openAbove
                    ? {
                        position: 'fixed',
                        left,
                        width,
                        bottom: viewportHeight - rect.top + gap,
                        maxHeight,
                        zIndex: 100000000,
                    }
                    : {
                        position: 'fixed',
                        left,
                        width,
                        top: rect.bottom + gap,
                        maxHeight,
                        zIndex: 100000000,
                    }
            );
        };

        updatePopoverPosition();
        window.addEventListener('resize', updatePopoverPosition);
        window.addEventListener('scroll', updatePopoverPosition, true);

        return () => {
            window.removeEventListener('resize', updatePopoverPosition);
            window.removeEventListener('scroll', updatePopoverPosition, true);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const option = optionRefs.current[activeIndex];
        option?.focus();
        option?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open]);

    const openMenu = (preferredIndex?: number) => {
        if (disabled) return;
        const selectedIndex = Math.max(
            0,
            options.findIndex((option) => option.value === value)
        );
        setActiveIndex(preferredIndex ?? selectedIndex);
        setOpen(true);
    };

    const closeMenu = () => {
        setOpen(false);
        triggerRef.current?.focus();
    };

    const commit = (nextValue: T) => {
        onChange(nextValue);
        setOpen(false);
        triggerRef.current?.focus();
    };

    const moveFocus = (direction: 1 | -1) => {
        setActiveIndex((currentIndex) => {
            if (options.length === 0) return 0;
            return (currentIndex + direction + options.length) % options.length;
        });
    };

    const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(options.length - 1);
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((currentOpen) => !currentOpen);
        }
    };

    const onOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, optionValue: T) => {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                moveFocus(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                moveFocus(-1);
                break;
            case 'Home':
                event.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                event.preventDefault();
                setActiveIndex(options.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                commit(optionValue);
                break;
            case 'Escape':
                event.preventDefault();
                closeMenu();
                break;
            default:
                break;
        }
    };

    const selectedContent = selectedOption
        ? renderSelected?.(selectedOption) ?? (
            <div className="mf-select__selected-copy">
                <span className="mf-select__selected-label">{selectedOption.label}</span>
                {selectedOption.description ? (
                    <span className="mf-select__selected-description">{selectedOption.description}</span>
                ) : null}
            </div>
        )
        : (
            <span className="mf-select__placeholder">{placeholder ?? '请选择'}</span>
        );

    const dropdownContent = open ? (
        <div className="mf-select__popover" role="presentation" ref={popoverRef} style={popoverStyle}>
            <div className="mf-select__list" id={listboxId} role="listbox" aria-label={ariaLabel}>
                {options.map((option, index) => {
                    const selected = option.value === value;
                    const previousGroup = index > 0 ? options[index - 1]?.group : undefined;
                    const shouldRenderGroup = option.group && option.group !== previousGroup;

                    return (
                        <Fragment key={option.value}>
                            {shouldRenderGroup ? (
                                <div className="mf-select__group-label" aria-hidden="true">
                                    {option.group}
                                </div>
                            ) : null}
                            <button
                                ref={(node) => {
                                    optionRefs.current[index] = node;
                                }}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={`mf-select__option ${selected ? 'is-selected' : ''}`.trim()}
                                onClick={() => commit(option.value)}
                                onKeyDown={(event) => onOptionKeyDown(event, option.value)}
                            >
                                {renderOptionLeading ? (
                                    <span className="mf-select__option-leading">
                                        {renderOptionLeading(option, selected)}
                                    </span>
                                ) : null}
                                <span className="mf-select__option-copy">
                                    <span className="mf-select__option-label">{option.label}</span>
                                    {option.description ? (
                                        <span className="mf-select__option-description">{option.description}</span>
                                    ) : null}
                                </span>
                                {selected ? <Check className="mf-select__option-check" strokeWidth={2} /> : null}
                            </button>
                        </Fragment>
                    );
                })}
            </div>
        </div>
    ) : null;

    return (
        <div
            className={`mf-select ${size === 'compact' ? 'mf-select--compact' : ''} ${open ? 'is-open' : ''} ${className}`.trim()}
            ref={rootRef}
        >
            <button
                ref={triggerRef}
                type="button"
                className="mf-select__trigger"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => setOpen((currentOpen) => !currentOpen)}
                onKeyDown={onTriggerKeyDown}
                disabled={disabled}
            >
                <span className="mf-select__trigger-value">{selectedContent}</span>
                <ChevronDown className="mf-select__chevron" strokeWidth={1.85} />
            </button>

            {open ? createPortal(dropdownContent, document.body) : null}
        </div>
    );
}

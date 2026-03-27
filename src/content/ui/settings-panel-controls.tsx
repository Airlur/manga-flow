import { Check, Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';

export type StatusTone = 'info' | 'success' | 'error' | 'warning';

export interface InlineState {
    tone: StatusTone;
    message: string;
}

export function TabIntro({ title, description }: { title: string; description?: string }) {
    return (
        <div className="manga-flow-settings__tab-intro">
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
        </div>
    );
}

export function PaneSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className="manga-flow-settings__pane-section">
            <div className="manga-flow-settings__pane-head">
                <h4>{title}</h4>
                {description ? <p>{description}</p> : null}
            </div>
            {children}
        </section>
    );
}

export function Field({
    label,
    helper,
    children,
}: {
    label?: string;
    helper?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="manga-flow-settings__field">
            {label ? <label className="manga-flow-settings__label">{label}</label> : null}
            {children}
            {helper ? <div className="manga-flow-settings__helper">{helper}</div> : null}
        </div>
    );
}

export function InlineField({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="manga-flow-settings__inline-field">
            <span className="manga-flow-settings__inline-label">{label}</span>
            <div className="manga-flow-settings__inline-control">{children}</div>
        </div>
    );
}

export function SelectSummary({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <div className="manga-flow-settings__select-copy">
            <span>{title}</span>
            {description ? <small>{description}</small> : null}
        </div>
    );
}

export function PasswordField({
    value,
    visible,
    placeholder,
    onToggleVisibility,
    onChange,
    forcePassword = false,
}: {
    value: string;
    visible: boolean;
    placeholder: string;
    onToggleVisibility: () => void;
    onChange: (value: string) => void;
    forcePassword?: boolean;
}) {
    return (
        <div className="manga-flow-settings__password">
            <input
                className="manga-flow-settings__input"
                type={forcePassword ? 'password' : (visible ? 'text' : 'password')}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
            {!forcePassword ? (
                <button
                    type="button"
                    className="manga-flow-settings__password-toggle"
                    aria-label={visible ? '隐藏密钥' : '显示密钥'}
                    onClick={onToggleVisibility}
                >
                    {visible ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
                </button>
            ) : null}
        </div>
    );
}

export function SliderField({
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

export function MiniSwitch({
    checked,
    onChange,
    readOnly = false,
}: {
    checked: boolean;
    onChange?: (value: boolean) => void;
    readOnly?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className={`manga-flow-settings__mini-switch ${checked ? 'is-checked' : ''}`.trim()}
            onClick={() => {
                if (!readOnly) {
                    onChange?.(!checked);
                }
            }}
        >
            <span className="manga-flow-settings__mini-switch-thumb" />
        </button>
    );
}

export function SwitchField({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="manga-flow-settings__switch-row">
            <div className="manga-flow-settings__switch-copy">
                <span>{label}</span>
                {description ? <small>{description}</small> : null}
            </div>

            <MiniSwitch checked={checked} onChange={onChange} />
        </div>
    );
}

export function CheckboxField({
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

export function InlineStatus({ state }: { state: InlineState }) {
    return (
        <div className={`manga-flow-settings__inline-status manga-flow-settings__inline-status--${state.tone}`.trim()}>
            <span>{state.message}</span>
        </div>
    );
}

export function InfoBlock({
    tone,
    children,
}: {
    tone: StatusTone;
    children: ReactNode;
}) {
    return (
        <div className={`manga-flow-settings__info-block manga-flow-settings__info-block--${tone}`.trim()}>
            {children}
        </div>
    );
}

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { PanelIcon, type PanelIconName } from './PanelIcon';

/**
 * An icon button of a row of a panel's list. With `blocked` (the reason) it does nothing but still shows its
 * tooltip, hence aria-disabled rather than disabled.
 */
export function RowButton({
    icon,
    label,
    pressed,
    disabled,
    blocked,
    alert,
    onClick,
}: {
    icon: PanelIconName;
    label: string;
    pressed?: boolean;
    /** Shown in red, for a state that should catch the eye (a locked layer). */
    alert?: boolean;
    disabled: boolean;
    blocked: string | null;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className="panel-icon-button"
            aria-label={label}
            aria-pressed={pressed}
            aria-disabled={blocked !== null}
            data-alert={alert || undefined}
            disabled={disabled}
            title={blocked ?? label}
            onClick={() => blocked === null && onClick()}
        >
            <PanelIcon name={icon} />
        </button>
    );
}

/**
 * The last row of a panel's list: "+ … hinzufügen" as a line of the list rather than a button,
 * the plus under the swatches.
 */
export function AddRow({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
    return (
        <li className="layer-row layer-row-add">
            <button type="button" className="layer-row-main" disabled={disabled} onClick={onClick}>
                <span className="layer-row-add-icon">
                    <PanelIcon name="plus" size={14} />
                </span>
                <span className="layer-row-name">{label}</span>
            </button>
        </li>
    );
}

interface TextFieldProps {
    label: string;
    title?: string;
    /** The value in the document; the field starts with it (give the field a key that changes with it). */
    value: string;
    /** Shown while the field is empty. */
    placeholder?: string;
    disabled: boolean;
    maxLength?: number;
    /** A number field with these limits. */
    number?: { min: number; max: number };
    /** What is wrong with the typed text, shown below the field; such a text is never committed. */
    problem?: (text: string) => string | null;
    onCommit: (text: string) => void;
}

/**
 * A field that commits what was typed when it is left or on Enter, as one change, and puts the
 * value back on Esc. It then shows the value again: the new one arrives with the document.
 */
export function TextField({ label, title, value, placeholder, disabled, maxLength, number, problem, onCommit }: TextFieldProps) {
    const id = useId();
    const [error, setError] = useState<string | null>(null);
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && error === null) {
            event.currentTarget.blur();
        } else if (event.key === 'Escape') {
            event.currentTarget.value = value;
            setError(null);
            event.currentTarget.blur();
        }
    };
    return (
        <div className="panel-field" title={title}>
            <label htmlFor={id}>{label}</label>
            <input
                id={id}
                type={number ? 'number' : 'text'}
                min={number?.min}
                max={number?.max}
                step={number ? 1 : undefined}
                defaultValue={value}
                placeholder={placeholder}
                disabled={disabled}
                maxLength={maxLength}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error !== null}
                aria-describedby={error !== null ? `${id}-error` : undefined}
                onChange={(event) => setError(problem?.(event.currentTarget.value) ?? null)}
                onKeyDown={onKeyDown}
                onBlur={(event) => {
                    const text = event.currentTarget.value;
                    event.currentTarget.value = value;
                    setError(null);
                    if (text !== value && (problem?.(text) ?? null) === null) {
                        onCommit(text);
                    }
                }}
            />
            {error !== null && (
                <p id={`${id}-error`} className="panel-field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * The browser's colour picker. It commits when the picker closes (the native `change` event;
 * React's onChange fires for every colour passed over), so choosing a colour is one change.
 */
export function ColorField({
    label,
    value,
    shown,
    text,
    disabled,
    onCommit,
    reset,
}: {
    label: string;
    /** The colour the picker starts with. */
    value: string;
    /** The colour as the drawing shows it, which differs from the stored one on a dark background; null for none. */
    shown: string | null;
    /** Beside the colour: its code, or what stands for none. */
    text: string;
    disabled: boolean;
    onCommit: (color: string) => void;
    /** A button that takes the colour away again. */
    reset?: { label: string; onClick: () => void };
}) {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const commitRef = useRef(onCommit);
    useEffect(() => {
        commitRef.current = onCommit;
    });
    useEffect(() => {
        const input = inputRef.current!;
        const commit = () => commitRef.current(input.value);
        input.addEventListener('change', commit);
        return () => input.removeEventListener('change', commit);
    }, []);
    return (
        <div className="panel-field">
            <label htmlFor={id}>{label}</label>
            <div className="panel-field-value">
                <span className="panel-color">
                    <input ref={inputRef} id={id} type="color" defaultValue={value} disabled={disabled} />
                    <span className="layer-swatch" data-empty={shown === null} style={shown === null ? undefined : { background: shown }} />
                    <code>{text}</code>
                </span>
                {reset && (
                    <button type="button" className="panel-icon-button" aria-label={reset.label} title={reset.label} disabled={disabled} onClick={reset.onClick}>
                        <PanelIcon name="reset" />
                    </button>
                )}
            </div>
        </div>
    );
}

/** A choice that commits at once, as one change. */
export function SelectField({
    label,
    value,
    options,
    disabled,
    onCommit,
}: {
    label: string;
    value: string;
    options: readonly { value: string; label: string; disabled?: boolean }[];
    disabled: boolean;
    onCommit: (value: string) => void;
}) {
    const id = useId();
    return (
        <div className="panel-field">
            <label htmlFor={id}>{label}</label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => {
                    onCommit(event.currentTarget.value);
                    // The keys go to the editor again
                    event.currentTarget.blur();
                }}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

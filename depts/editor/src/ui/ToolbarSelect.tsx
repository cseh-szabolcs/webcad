import { useId, type ReactNode } from 'react';
import { useMenu } from './useMenu';

export interface ToolbarSelectOption<T extends string> {
    value: T;
    /** Shown on the button while chosen. */
    label: string;
    /** Shown in the menu. */
    menuLabel: string;
    title?: string;
    lang?: string;
    /** Shown before the label, on the button and in the menu. */
    icon?: ReactNode;
}

/**
 * Choice of one value in the toolbar: one button with the chosen value and ▾ opens a menu of
 * radio buttons, which opens downwards and closes after a choice. The label is only shown as
 * the button's tooltip, like the icon-only toolbar buttons.
 */
export function ToolbarSelect<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly ToolbarSelectOption<T>[];
    onChange: (value: T) => void;
}) {
    const { open, setOpen, rootRef } = useMenu();
    const name = useId();
    const current = options.find((option) => option.value === value);

    return (
        <div className="snap-switch toolbar-select" ref={rootRef}>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                aria-label={label}
                onClick={() => setOpen(!open)}
                title={label}
            >
                {current?.icon}
                <span lang={current?.lang}>{current?.label}</span>
                <span aria-hidden="true">▾</span>
            </button>
            {open && (
                <div className="snap-menu" role="radiogroup" aria-label={label}>
                    {options.map((option) => (
                        <label key={option.value} lang={option.lang} title={option.title}>
                            <input
                                type="radio"
                                name={name}
                                checked={option.value === value}
                                onChange={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                            />
                            {option.icon}
                            {option.menuLabel}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

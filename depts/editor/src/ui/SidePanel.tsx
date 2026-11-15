import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { PanelIcon } from './PanelIcon';

/** How far an arrow key moves the edge of the panel, in screen px. */
const KEY_STEP_PX = 16;

export interface SidePanelTab<T extends string> {
    id: T;
    label: string;
    content: ReactNode;
}

interface SidePanelProps<T extends string> {
    /** Shown as tabs in the head of the panel; all stay mounted, so each keeps its state and scroll. */
    tabs: readonly SidePanelTab<T>[];
    tab: T;
    onTabChange: (tab: T) => void;
    open: boolean;
    /** Width in screen px while open, within `minWidth` and `maxWidth`. */
    width: number;
    minWidth: number;
    maxWidth: number;
    /** The width a double click on the edge goes back to. */
    defaultWidth: number;
    onOpenChange: (open: boolean) => void;
    /** Once per drag, on release; and per arrow key. */
    onWidthChange: (width: number) => void;
    texts: { panel: string; open: string; close: string; resize: string };
}

/**
 * A panel docked right of the drawing, like the side bar of an IDE, with tabs in its head: it slides in by a width
 * transition (its content keeps its width, so it does not reflow), its left edge can be dragged
 * (also moved by the arrow keys, reset by a double click), and a small button in the middle of
 * that edge opens and closes it at any time.
 */
export function SidePanel<T extends string>({
    tabs,
    tab,
    onTabChange,
    open,
    width,
    minWidth,
    maxWidth,
    defaultWidth,
    onOpenChange,
    onWidthChange,
    texts,
}: SidePanelProps<T>) {
    const idPrefix = useId();
    /** While the edge is dragged: where it started and the width it shows now. */
    const [drag, setDrag] = useState<{ startX: number; startWidth: number; width: number } | null>(null);
    const clamp = (value: number) => Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
    const shown = drag?.width ?? width;

    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) {
            return;
        }
        // Keeps the browser from selecting text on the way
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ startX: event.clientX, startWidth: width, width });
    };
    const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
        if (drag) {
            // The edge is the left one: to the left is wider
            setDrag({ ...drag, width: clamp(drag.startWidth + drag.startX - event.clientX) });
        }
    };
    const endDrag = () => {
        if (drag) {
            setDrag(null);
            if (drag.width !== width) {
                onWidthChange(drag.width);
            }
        }
    };
    const moveByKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.key === 'ArrowLeft' ? KEY_STEP_PX : event.key === 'ArrowRight' ? -KEY_STEP_PX : 0;
        if (step !== 0) {
            // Not a key for the editor
            event.preventDefault();
            event.stopPropagation();
            onWidthChange(clamp(width + step));
        }
    };

    // Arrow keys, Home and End go through the tabs like any tab list
    const moveTab = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = tabs.findIndex((item) => item.id === tab);
        const next =
            event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
        if (next === null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const target = tabs[(next + tabs.length) % tabs.length];
        onTabChange(target.id);
        document.getElementById(`${idPrefix}-tab-${target.id}`)?.focus();
    };

    return (
        <aside
            className="side-panel"
            data-open={open}
            data-resizing={drag !== null}
            aria-label={texts.panel}
            style={{ '--side-panel-width': `${shown}px` } as React.CSSProperties}
        >
            <button
                type="button"
                className="side-panel-toggle"
                aria-expanded={open}
                aria-label={open ? texts.close : texts.open}
                title={open ? texts.close : texts.open}
                onClick={() => onOpenChange(!open)}
            >
                <PanelIcon name={open ? 'chevronRight' : 'chevronLeft'} size={14} />
            </button>
            {open && (
                <div
                    className="side-panel-sash"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={texts.resize}
                    aria-valuenow={shown}
                    aria-valuemin={minWidth}
                    aria-valuemax={maxWidth}
                    title={texts.resize}
                    tabIndex={0}
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
                    onDoubleClick={() => onWidthChange(clamp(defaultWidth))}
                    onKeyDown={moveByKey}
                />
            )}
            <div className="side-panel-clip">
                <div className="side-panel-content" inert={!open}>
                    <header className="side-panel-header">
                        <div className="side-panel-tabs" role="tablist" aria-label={texts.panel} onKeyDown={moveTab}>
                            {tabs.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    id={`${idPrefix}-tab-${item.id}`}
                                    className="side-panel-tab"
                                    aria-selected={item.id === tab}
                                    aria-controls={`${idPrefix}-panel-${item.id}`}
                                    tabIndex={item.id === tab ? 0 : -1}
                                    onClick={() => onTabChange(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <button type="button" className="panel-icon-button" aria-label={texts.close} title={texts.close} onClick={() => onOpenChange(false)}>
                            <PanelIcon name="close" />
                        </button>
                    </header>
                    {tabs.map((item) => (
                        <div
                            key={item.id}
                            role="tabpanel"
                            id={`${idPrefix}-panel-${item.id}`}
                            aria-labelledby={`${idPrefix}-tab-${item.id}`}
                            className="side-panel-body"
                            hidden={item.id !== tab}
                        >
                            {item.content}
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}

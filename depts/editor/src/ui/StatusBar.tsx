import { useEffect, useRef, useState } from 'react';
import { SNAP_MODE_LABELS, SNAP_MODES, type SnapMode } from 'app/cad/editor/snapping/SnapMode';
import type { Point } from 'app/cad/model/Point';
import type { Viewport } from 'app/cad/renderer/Viewport';
import type { SnapSettings } from 'app/settings/editorSettings';
import { markerPath } from './SnapMarker';

interface StatusBarProps {
    viewport: Viewport | null;
    /** Pointer position in view px, or null when it is outside the canvas. */
    pointer: Point | null;
    snapSettings: SnapSettings;
    onSnapSettingsChange: (settings: SnapSettings) => void;
}

/** Cursor position in model space, the object snap switch and the zoom level. */
export function StatusBar({ viewport, pointer, snapSettings, onSnapSettingsChange }: StatusBarProps) {
    const model = viewport && pointer ? viewport.viewToModel(pointer) : null;

    return (
        <footer className="statusbar">
            <b>{model ? `X ${formatCoordinate(model.x)}  Y ${formatCoordinate(model.y)}` : 'X –  Y –'}</b>
            <SnapSwitch settings={snapSettings} onChange={onSnapSettingsChange} />
            {viewport && <span>Zoom {viewport.scale.toFixed(3)} px/mm</span>}
        </footer>
    );
}

/** OFANG switch (like F3) with a menu of the running snap modes, like AutoCAD's status bar. */
function SnapSwitch({ settings, onChange }: { settings: SnapSettings; onChange: (settings: SnapSettings) => void }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        const close = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    const toggleMode = (mode: SnapMode) => {
        const modes = new Set(settings.modes);
        if (modes.has(mode)) {
            modes.delete(mode);
        } else {
            modes.add(mode);
        }
        onChange({ ...settings, modes });
    };

    return (
        <div className="snap-switch" ref={rootRef}>
            <button
                type="button"
                aria-pressed={settings.enabled}
                onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
                title="Objektfang ein/aus (F3)"
            >
                OFANG
            </button>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
                title="Objektfang-Modi wählen"
            >
                ▾
            </button>
            {open && (
                <div className="snap-menu" role="group" aria-label="Objektfang-Modi">
                    {SNAP_MODES.map((mode) => (
                        <label key={mode}>
                            <input type="checkbox" checked={settings.modes.has(mode)} onChange={() => toggleMode(mode)} />
                            <svg className="snap-menu-icon" width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                                <path d={markerPath(mode, 5)} />
                            </svg>
                            {SNAP_MODE_LABELS[mode]}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

/** One decimal, without a negative zero. */
function formatCoordinate(value: number): string {
    return (Math.round(value * 10) / 10 + 0).toFixed(1);
}

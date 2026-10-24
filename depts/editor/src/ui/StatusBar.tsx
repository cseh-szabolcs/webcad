import { useEffect, useRef, useState } from 'react';
import { SNAP_MODE_LABELS, SNAP_MODES, type SnapMode } from 'app/cad/editor/snapping/SnapMode';
import { formatAngleList, parseAngleList } from 'app/cad/editor/tracking/PolarTracking';
import type { Point } from 'app/cad/model/Point';
import type { Viewport } from 'app/cad/renderer/Viewport';
import { POLAR_INCREMENTS, type PolarSettings, type SnapSettings } from 'app/settings/editorSettings';
import { markerPath } from './SnapMarker';

interface StatusBarProps {
    viewport: Viewport | null;
    /** Pointer position in view px, or null when it is outside the canvas. */
    pointer: Point | null;
    snapSettings: SnapSettings;
    onSnapSettingsChange: (settings: SnapSettings) => void;
    polarSettings: PolarSettings;
    onPolarSettingsChange: (settings: PolarSettings) => void;
}

/**
 * The polar tracking and object snap switches on the left, the cursor position in model space
 * and the zoom level on the right, so the switches stay put while the numbers change width.
 */
export function StatusBar({
    viewport,
    pointer,
    snapSettings,
    onSnapSettingsChange,
    polarSettings,
    onPolarSettingsChange,
}: StatusBarProps) {
    const model = viewport && pointer ? viewport.viewToModel(pointer) : null;

    return (
        <footer className="statusbar">
            <PolarSwitch settings={polarSettings} onChange={onPolarSettingsChange} />
            <SnapSwitch settings={snapSettings} onChange={onSnapSettingsChange} />
            <b className="statusbar-position">
                {model ? `X ${formatCoordinate(model.x)}  Y ${formatCoordinate(model.y)}` : 'X –  Y –'}
            </b>
            {viewport && <span>Zoom {viewport.scale.toFixed(3)} px/mm</span>}
        </footer>
    );
}

/** Open state of a status bar menu, which closes on a press outside `rootRef` or on Escape. */
function useMenu() {
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

    return { open, setOpen, rootRef };
}

/**
 * POLAR switch (like F10) with a menu of the increment angles, like AutoCAD's status bar, and
 * a field for the additional angles.
 */
function PolarSwitch({ settings, onChange }: { settings: PolarSettings; onChange: (settings: PolarSettings) => void }) {
    const { open, setOpen, rootRef } = useMenu();

    return (
        <div className="snap-switch" ref={rootRef}>
            <button
                type="button"
                aria-pressed={settings.enabled}
                onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
                title="Polarspur ein/aus (F10)"
            >
                POLAR
            </button>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
                title="Polarwinkel wählen"
            >
                ▾
            </button>
            {open && (
                <div className="snap-menu">
                    <div className="polar-increments" role="radiogroup" aria-label="Winkelschritt">
                        {POLAR_INCREMENTS.map((angle) => (
                            <label key={angle}>
                                <input
                                    type="radio"
                                    name="polar-increment"
                                    checked={settings.incrementAngle === angle}
                                    // Choosing an angle also switches polar tracking on, like AutoCAD
                                    onChange={() => onChange({ ...settings, enabled: true, incrementAngle: angle })}
                                />
                                {angle}°
                            </label>
                        ))}
                    </div>
                    <AdditionalAngles
                        angles={settings.additionalAngles}
                        onChange={(additionalAngles) => onChange({ ...settings, enabled: true, additionalAngles })}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Field for the additional polar angles, e.g. "30, 60". Every valid change applies at once (and
 * switches polar tracking on); while the text is invalid it is marked and the last valid
 * angles stay.
 */
function AdditionalAngles({ angles, onChange }: { angles: readonly number[]; onChange: (angles: number[]) => void }) {
    const [text, setText] = useState(() => formatAngleList(angles));
    const parsed = parseAngleList(text);

    const edit = (value: string) => {
        setText(value);
        const next = parseAngleList(value);
        if (next !== null && formatAngleList(next) !== formatAngleList(angles)) {
            onChange(next);
        }
    };

    return (
        <label className="polar-additional">
            Zusatzwinkel
            <input
                type="text"
                value={text}
                placeholder="z. B. 30, 60"
                aria-invalid={parsed === null}
                title="Winkel in Grad, durch Komma getrennt (Dezimalpunkt), höchstens 10"
                onChange={(event) => edit(event.target.value)}
            />
        </label>
    );
}

/** OFANG switch (like F3) with a menu of the running snap modes, like AutoCAD's status bar. */
function SnapSwitch({ settings, onChange }: { settings: SnapSettings; onChange: (settings: SnapSettings) => void }) {
    const { open, setOpen, rootRef } = useMenu();

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

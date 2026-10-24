import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SNAP_MODES, snapModeLabel, type SnapMode } from 'app/cad/editor/snapping/SnapMode';
import { formatAngleList, MAX_ADDITIONAL_ANGLES, parseAngleList } from 'app/cad/editor/tracking/PolarTracking';
import { MAX_MAJOR_EVERY, parseGridSpacing, parseMajorEvery } from 'app/cad/renderer/grid';
import type { Point } from 'app/cad/model/Point';
import type { Viewport } from 'app/cad/renderer/Viewport';
import { POLAR_INCREMENTS, type GridSettings, type PolarSettings, type SnapSettings } from 'app/settings/editorSettings';
import { markerPath } from './SnapMarker';
import { useMenu } from './useMenu';

interface StatusBarProps {
    viewport: Viewport | null;
    /** Pointer position in view px, or null when it is outside the canvas. */
    pointer: Point | null;
    snapSettings: SnapSettings;
    onSnapSettingsChange: (settings: SnapSettings) => void;
    polarSettings: PolarSettings;
    onPolarSettingsChange: (settings: PolarSettings) => void;
    ortho: boolean;
    onOrthoChange: (ortho: boolean) => void;
    gridSettings: GridSettings;
    onGridSettingsChange: (settings: GridSettings) => void;
}

/**
 * The grid, Ortho, polar tracking and object snap switches on the left (in AutoCAD's order), the cursor position in model space
 * and the zoom level on the right, so the switches stay put while the numbers change width.
 */
export function StatusBar({
    viewport,
    pointer,
    snapSettings,
    onSnapSettingsChange,
    polarSettings,
    onPolarSettingsChange,
    ortho,
    onOrthoChange,
    gridSettings,
    onGridSettingsChange,
}: StatusBarProps) {
    const { t } = useTranslation();
    const model = viewport && pointer ? viewport.viewToModel(pointer) : null;

    return (
        <footer className="statusbar">
            <GridSwitch settings={gridSettings} onChange={onGridSettingsChange} />
            <div className="snap-switch">
                <button type="button" aria-pressed={ortho} onClick={() => onOrthoChange(!ortho)} title={t('status.orthoTitle')}>
                    {t('status.ortho')}
                </button>
            </div>
            <PolarSwitch settings={polarSettings} onChange={onPolarSettingsChange} />
            <SnapSwitch settings={snapSettings} onChange={onSnapSettingsChange} />
            <b className="statusbar-position">
                {model ? `X ${formatCoordinate(model.x)}  Y ${formatCoordinate(model.y)}` : 'X –  Y –'}
            </b>
            {viewport && <span>{t('status.zoom', { scale: viewport.scale.toFixed(3) })}</span>}
        </footer>
    );
}

/**
 * RASTER switch (like F7) with a menu of the grid spacing and the lines per major line, like
 * AutoCAD's GRIDUNIT and GRIDMAJOR.
 */
function GridSwitch({ settings, onChange }: { settings: GridSettings; onChange: (settings: GridSettings) => void }) {
    const { t } = useTranslation();
    const { open, setOpen, rootRef } = useMenu();

    return (
        <div className="snap-switch" ref={rootRef}>
            <button
                type="button"
                aria-pressed={settings.enabled}
                onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
                title={t('status.gridTitle')}
            >
                {t('status.grid')}
            </button>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
                title={t('status.gridMenuTitle')}
            >
                ▾
            </button>
            {open && (
                <div className="snap-menu">
                    <NumberField
                        label={t('status.gridSpacing')}
                        value={settings.spacing}
                        parse={parseGridSpacing}
                        title={t('status.gridSpacingTitle')}
                        // Every valid value also switches the grid on, like the polar angles
                        onChange={(spacing) => onChange({ ...settings, enabled: true, spacing })}
                    />
                    <NumberField
                        label={t('status.majorEvery')}
                        value={settings.majorEvery}
                        parse={parseMajorEvery}
                        title={t('status.majorEveryTitle', { max: MAX_MAJOR_EVERY })}
                        onChange={(majorEvery) => onChange({ ...settings, enabled: true, majorEvery })}
                    />
                </div>
            )}
        </div>
    );
}

/**
 * Number field in a status bar menu: every valid change applies at once; while the text is
 * invalid it is marked and the last valid value stays.
 */
function NumberField({
    label,
    value,
    parse,
    title,
    onChange,
}: {
    label: string;
    value: number;
    parse: (text: string) => number | null;
    title: string;
    onChange: (value: number) => void;
}) {
    const [text, setText] = useState(() => String(value));
    const parsed = parse(text);

    const edit = (next: string) => {
        setText(next);
        const nextValue = parse(next);
        if (nextValue !== null && nextValue !== value) {
            onChange(nextValue);
        }
    };

    return (
        <label className="menu-field">
            {label}
            <input
                type="text"
                inputMode="decimal"
                value={text}
                aria-invalid={parsed === null}
                title={title}
                onChange={(event) => edit(event.target.value)}
            />
        </label>
    );
}

/**
 * POLAR switch (like F10) with a menu of the increment angles, like AutoCAD's status bar, and
 * a field for the additional angles.
 */
function PolarSwitch({ settings, onChange }: { settings: PolarSettings; onChange: (settings: PolarSettings) => void }) {
    const { t } = useTranslation();
    const { open, setOpen, rootRef } = useMenu();

    return (
        <div className="snap-switch" ref={rootRef}>
            <button
                type="button"
                aria-pressed={settings.enabled}
                onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
                title={t('status.polarTitle')}
            >
                {t('status.polar')}
            </button>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
                title={t('status.polarMenuTitle')}
            >
                ▾
            </button>
            {open && (
                <div className="snap-menu">
                    <div className="polar-increments" role="radiogroup" aria-label={t('status.polarIncrement')}>
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
    const { t } = useTranslation();
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
            {t('status.additionalAngles')}
            <input
                type="text"
                value={text}
                placeholder={t('status.additionalAnglesPlaceholder')}
                aria-invalid={parsed === null}
                title={t('status.additionalAnglesTitle', { max: MAX_ADDITIONAL_ANGLES })}
                onChange={(event) => edit(event.target.value)}
            />
        </label>
    );
}

/** OFANG switch (like F3) with a menu of the running snap modes, like AutoCAD's status bar. */
function SnapSwitch({ settings, onChange }: { settings: SnapSettings; onChange: (settings: SnapSettings) => void }) {
    const { t } = useTranslation();
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
                title={t('status.snapTitle')}
            >
                {t('status.snap')}
            </button>
            <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                onClick={() => setOpen(!open)}
                title={t('status.snapMenuTitle')}
            >
                ▾
            </button>
            {open && (
                <div className="snap-menu" role="group" aria-label={t('status.snapModes')}>
                    {SNAP_MODES.map((mode) => (
                        <label key={mode}>
                            <input type="checkbox" checked={settings.modes.has(mode)} onChange={() => toggleMode(mode)} />
                            <svg className="snap-menu-icon" width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
                                <path d={markerPath(mode, 5)} />
                            </svg>
                            {snapModeLabel(mode)}
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

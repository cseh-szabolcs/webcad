import { SNAP_MODES } from '../cad/editor/snapping/SnapMode';
import { MAX_ADDITIONAL_ANGLES } from '../cad/editor/tracking/PolarTracking';
import { MAX_MAJOR_EVERY } from '../cad/renderer/grid';
import {
    DEFAULT_DYNAMIC_INPUT_SETTINGS,
    DEFAULT_GRID_SETTINGS,
    DEFAULT_OBJECT_TRACKING_SETTINGS,
    DEFAULT_SNAP_SETTINGS,
    DEFAULT_TRACKING_MODES,
    POLAR_INCREMENTS,
    withOrtho,
    type DynamicInputSettings,
    type GridSettings,
    type ObjectTrackingSettings,
    type SnapSettings,
    type TrackingModes,
} from './editorSettings';

/** What the status bar switches and their menus set, remembered per browser. */
export interface EditorSwitches {
    snap: SnapSettings;
    tracking: TrackingModes;
    objectTracking: ObjectTrackingSettings;
    grid: GridSettings;
    dynamicInput: DynamicInputSettings;
}

export const DEFAULT_EDITOR_SWITCHES: EditorSwitches = {
    snap: DEFAULT_SNAP_SETTINGS,
    tracking: DEFAULT_TRACKING_MODES,
    objectTracking: DEFAULT_OBJECT_TRACKING_SETTINGS,
    grid: DEFAULT_GRID_SETTINGS,
    dynamicInput: DEFAULT_DYNAMIC_INPUT_SETTINGS,
};

const STORAGE_KEY = 'webcad.editor.switches';

/** As JSON; the snap modes as a list. */
export function serializeSwitches(switches: EditorSwitches): string {
    return JSON.stringify({ ...switches, snap: { ...switches.snap, modes: [...switches.snap.modes] } });
}

/**
 * The switches from their JSON. Every value that is missing or not valid (another version, a
 * changed entry) falls back to its default, so stored text never breaks the editor.
 */
export function parseSwitches(json: string | null): EditorSwitches {
    let stored: unknown;
    try {
        stored = json === null ? null : JSON.parse(json);
    } catch {
        stored = null;
    }
    const d = DEFAULT_EDITOR_SWITCHES;
    const snap = record(field(stored, 'snap'));
    const tracking = record(field(stored, 'tracking'));
    const polar = record(tracking.polar);
    const objectTracking = record(field(stored, 'objectTracking'));
    const grid = record(field(stored, 'grid'));
    const dynamicInput = record(field(stored, 'dynamicInput'));
    const modes = Array.isArray(snap.modes) ? SNAP_MODES.filter((mode) => (snap.modes as unknown[]).includes(mode)) : null;
    const angles = Array.isArray(polar.additionalAngles) ? polar.additionalAngles : null;
    const polarSettings = {
        enabled: flag(polar.enabled, d.tracking.polar.enabled),
        incrementAngle: POLAR_INCREMENTS.find((increment) => increment === polar.incrementAngle) ?? d.tracking.polar.incrementAngle,
        additionalAngles:
            angles !== null && angles.length <= MAX_ADDITIONAL_ANGLES && angles.every((angle) => typeof angle === 'number' && Number.isFinite(angle))
                ? (angles as number[])
                : d.tracking.polar.additionalAngles,
    };
    // Ortho and polar tracking exclude each other: Ortho wins if both were stored on
    const ortho = flag(tracking.ortho, d.tracking.ortho);
    return {
        snap: { enabled: flag(snap.enabled, d.snap.enabled), modes: modes === null ? d.snap.modes : new Set(modes) },
        tracking: withOrtho({ ortho: false, polar: polarSettings }, ortho),
        objectTracking: {
            enabled: flag(objectTracking.enabled, d.objectTracking.enabled),
            allPolarAngles: flag(objectTracking.allPolarAngles, d.objectTracking.allPolarAngles),
        },
        grid: {
            enabled: flag(grid.enabled, d.grid.enabled),
            spacing: typeof grid.spacing === 'number' && Number.isFinite(grid.spacing) && grid.spacing > 0 ? grid.spacing : d.grid.spacing,
            majorEvery:
                Number.isInteger(grid.majorEvery) && (grid.majorEvery as number) >= 1 && (grid.majorEvery as number) <= MAX_MAJOR_EVERY
                    ? (grid.majorEvery as number)
                    : d.grid.majorEvery,
        },
        dynamicInput: {
            enabled: flag(dynamicInput.enabled, d.dynamicInput.enabled),
            pointerInput: flag(dynamicInput.pointerInput, d.dynamicInput.pointerInput),
            dimensionInput: flag(dynamicInput.dimensionInput, d.dynamicInput.dimensionInput),
            prompts: flag(dynamicInput.prompts, d.dynamicInput.prompts),
        },
    };
}

/** The switches stored in this browser, the defaults where there are none. */
export function loadSwitches(): EditorSwitches {
    try {
        return parseSwitches(localStorage.getItem(STORAGE_KEY));
    } catch {
        // Storage blocked (private mode)
        return DEFAULT_EDITOR_SWITCHES;
    }
}

export function saveSwitches(switches: EditorSwitches): void {
    try {
        localStorage.setItem(STORAGE_KEY, serializeSwitches(switches));
    } catch {
        // Storage blocked: the switches just are not remembered
    }
}

const record = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const field = (value: unknown, key: string): unknown => record(value)[key];
const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

import { SNAP_MODES, type SnapMode } from '../cad/editor/snapping/SnapMode';
import type { DisplayTheme } from '../cad/renderer/displayColor';

/**
 * Central editor settings. Fixed defaults for now; later the user can change them, so code
 * receives an `EditorSettings` object instead of reading these defaults directly.
 */
export interface EditorSettings {
    /**
     * Length of the crosshair lines as a percentage of the drawing area's larger side, like
     * AutoCAD's CURSORSIZE (1–100). At 100 the lines run across the whole drawing area.
     */
    crosshairSize: number;
    /**
     * Half the side of the pick box in screen px, like AutoCAD's PICKBOX: an element whose
     * outline passes through this square around the cursor is hovered and picked by a click.
     */
    pickboxSize: number;
    /** Whether the crosshair shows the pick box as a small square in its centre. */
    showPickbox: boolean;
    /**
     * Half the side of the object snap aperture box in screen px, like AutoCAD's APERTURE:
     * snap points inside this square around the cursor are found.
     */
    apertureSize: number;
    /** Whether the crosshair shows the aperture box during point prompts, like APBOX. */
    showApertureBox: boolean;
    /** Half the size of the snap marker in screen px, like AUTOSNAPSIZE. */
    snapMarkerSize: number;
    /** AutoSnap parts, like AUTOSNAP: marker, tooltip with the mode name, magnet. */
    snapMarker: boolean;
    snapTooltip: boolean;
    /** The crosshair jumps onto the snap point (and onto the polar tracking path). */
    snapMagnet: boolean;
    /**
     * Snap point preview, a deliberate deviation from AutoCAD: at point prompts, small markers
     * show all snap points of the objects under the aperture. They have no function.
     */
    snapPreview: boolean;
    /**
     * Colour of the snap point preview and of the rubber band while moving, per background, so
     * the two always match: orange on light, as yellow is hard to see on white.
     */
    previewColor: Readonly<Record<DisplayTheme, string>>;
    /**
     * Polar tracking tolerance in screen px: a polar path is taken while the cursor is at
     * most this far from it, so the behaviour does not depend on the zoom.
     */
    polarTolerance: number;
    /**
     * Smallest distance in screen px between two grid lines: while the grid spacing would come
     * out closer, the grid is shown coarser (see GridSettings.majorEvery).
     */
    gridMinSpacing: number;
    /** Colours of the grid's minor and major lines, per background. */
    gridColor: Readonly<Record<DisplayTheme, { minor: string; major: string }>>;
}

export const DEFAULT_EDITOR_SETTINGS: Readonly<EditorSettings> = {
    crosshairSize: 5,
    pickboxSize: 5,
    showPickbox: true,
    apertureSize: 10,
    showApertureBox: false,
    snapMarkerSize: 5,
    snapMarker: true,
    snapTooltip: true,
    snapMagnet: true,
    snapPreview: true,
    previewColor: { light: '#ea580c', dark: '#facc15' },
    polarTolerance: 10,
    gridMinSpacing: 10,
    gridColor: {
        light: { minor: '#eef0f3', major: '#dde1e6' },
        dark: { minor: '#283039', major: '#343d48' },
    },
};

/**
 * Grid display, switched while the editor runs (status bar, F7), like AutoCAD's GRIDMODE. The
 * grid is never part of the document and is never plotted.
 */
export interface GridSettings {
    /** Main switch like F7 (GRIDMODE). */
    enabled: boolean;
    /** Distance between grid lines in mm, the same for X and Y, like GRIDUNIT. */
    spacing: number;
    /**
     * Every this many lines one is a major line, like GRIDMAJOR (1–100). Zoomed out, the
     * grid gets coarser by this factor (by 2 at 1), like AutoCAD's adaptive grid.
     */
    majorEvery: number;
}

export const DEFAULT_GRID_SETTINGS: Readonly<GridSettings> = {
    enabled: true,
    spacing: 10,
    majorEvery: 10,
};

/** Running object snaps, switched while the editor runs (status bar, F3). */
export interface SnapSettings {
    /** Main switch like F3; the chosen modes are kept while it is off. */
    enabled: boolean;
    /** Running snap modes, like OSMODE. */
    modes: ReadonlySet<SnapMode>;
}

export const DEFAULT_SNAP_SETTINGS: Readonly<SnapSettings> = {
    enabled: true,
    // All but the geometric centre, which AutoCAD also leaves off
    modes: new Set(SNAP_MODES.filter((mode) => mode !== 'GCE')),
};

/** Polar tracking, switched while the editor runs (status bar, F10), like AutoCAD's POLARMODE. */
export interface PolarSettings {
    /** Main switch like F10; the angles are kept while it is off. */
    enabled: boolean;
    /** Paths run at every multiple of this angle (degrees), like POLARANG. */
    incrementAngle: number;
    /** Further angles (degrees, counter-clockwise from +X), like POLARADDANG; no multiples. */
    additionalAngles: readonly number[];
}

/** Increment angles offered in the status bar menu, like AutoCAD's. */
export const POLAR_INCREMENTS: readonly number[] = [90, 45, 30, 22.5, 18, 15, 10, 5];

export const DEFAULT_POLAR_SETTINGS: Readonly<PolarSettings> = {
    enabled: true,
    incrementAngle: 90,
    additionalAngles: [],
};

/** Ortho (F8) and polar tracking (F10), which exclude each other like in AutoCAD. */
export interface TrackingModes {
    ortho: boolean;
    polar: PolarSettings;
}

export const DEFAULT_TRACKING_MODES: Readonly<TrackingModes> = {
    ortho: false,
    polar: DEFAULT_POLAR_SETTINGS,
};

/** Switches Ortho; switching it on switches polar tracking off (its angles are kept). */
export function withOrtho(modes: TrackingModes, ortho: boolean): TrackingModes {
    return { ortho, polar: ortho && modes.polar.enabled ? { ...modes.polar, enabled: false } : modes.polar };
}

/** Changes polar tracking; switching it on switches Ortho off. */
export function withPolar(modes: TrackingModes, polar: PolarSettings): TrackingModes {
    return { ortho: modes.ortho && !polar.enabled, polar };
}

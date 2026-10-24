import { SNAP_MODES, type SnapMode } from '../cad/editor/snapping/SnapMode';

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
    /** The crosshair jumps onto the snap point. */
    snapMagnet: boolean;
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
    modes: new Set(SNAP_MODES),
};

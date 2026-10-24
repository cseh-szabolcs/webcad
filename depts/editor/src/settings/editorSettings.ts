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
}

export const DEFAULT_EDITOR_SETTINGS: Readonly<EditorSettings> = {
    crosshairSize: 5,
    pickboxSize: 5,
    showPickbox: true,
};

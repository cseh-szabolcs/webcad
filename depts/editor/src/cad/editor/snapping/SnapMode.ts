import { t } from '../../../i18n/i18n';

/**
 * Object snap modes, named like AutoCAD's: END endpoint, MID midpoint, CEN centre,
 * GCE geometric centre, QUA quadrant, INT intersection.
 */
export type SnapMode = 'END' | 'MID' | 'CEN' | 'GCE' | 'QUA' | 'INT';

/** All modes in the order the settings menu lists them (as AutoCAD's dialog does). */
export const SNAP_MODES: readonly SnapMode[] = ['END', 'MID', 'CEN', 'GCE', 'QUA', 'INT'];

/** Name shown in the snap tooltip and the settings, like AutoCAD's, in the current language. */
export function snapModeLabel(mode: SnapMode): string {
    return t(`snap.mode.${mode}`);
}

/**
 * Precedence between snap points about equally near the cursor, and for points that
 * coincide (an endpoint that is also an intersection shows as endpoint); lower wins.
 */
export const SNAP_MODE_RANK: Readonly<Record<SnapMode, number>> = { END: 0, INT: 1, CEN: 2, MID: 3, QUA: 4, GCE: 5 };

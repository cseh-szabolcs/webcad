/**
 * Object snap modes, named like AutoCAD's: END endpoint, MID midpoint, CEN centre,
 * GCE geometric centre, QUA quadrant, INT intersection.
 */
export type SnapMode = 'END' | 'MID' | 'CEN' | 'GCE' | 'QUA' | 'INT';

/** All modes in the order the settings menu lists them (as AutoCAD's dialog does). */
export const SNAP_MODES: readonly SnapMode[] = ['END', 'MID', 'CEN', 'GCE', 'QUA', 'INT'];

/** Names shown in the snap tooltip and the settings, like the German AutoCAD. */
export const SNAP_MODE_LABELS: Readonly<Record<SnapMode, string>> = {
    END: 'Endpunkt',
    MID: 'Mittelpunkt',
    CEN: 'Zentrum',
    GCE: 'Geometrisches Zentrum',
    QUA: 'Quadrant',
    INT: 'Schnittpunkt',
};

/**
 * Precedence between snap points about equally near the cursor, and for points that
 * coincide (an endpoint that is also an intersection shows as endpoint); lower wins.
 */
export const SNAP_MODE_RANK: Readonly<Record<SnapMode, number>> = { END: 0, INT: 1, CEN: 2, MID: 3, QUA: 4, GCE: 5 };

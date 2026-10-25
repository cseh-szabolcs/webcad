import type { Point } from '../../model/Point';
import type { PolarSettings } from '../../../settings/editorSettings';

/** A path is kept by hysteresis while no other one is more than this much nearer (screen px). */
export const HYSTERESIS_PX = 2;
/** Angles closer than this (degrees) count as the same path. */
const ANGLE_EPSILON = 1e-9;

/** Most additional angles, as in AutoCAD (POLARADDANG takes up to 10). */
export const MAX_ADDITIONAL_ANGLES = 10;

const ANGLE = /^[+-]?(?:\d+\.?\d*|\.\d+)°?$/;

/**
 * Parses a typed list of additional angles such as "30, 60" (separated by commas, semicolons
 * or spaces; the point is the decimal separator; a trailing ° is allowed) in degrees, without
 * duplicates. Empty text is no angles. Null if a part is no number or there are more than
 * MAX_ADDITIONAL_ANGLES.
 */
export function parseAngleList(text: string): number[] | null {
    const parts = text.split(/[\s,;]+/).filter((part) => part !== '');
    if (parts.length > MAX_ADDITIONAL_ANGLES || !parts.every((part) => ANGLE.test(part))) {
        return null;
    }
    return [...new Set(parts.map((part) => Number(part.replace('°', ''))))];
}

/** The angles as they are typed, e.g. "30, 60". */
export function formatAngleList(angles: readonly number[]): string {
    return angles.join(', ');
}

/** Where polar tracking is looked for: around the cursor, measured from the reference point. */
export interface PolarQuery {
    /** The last point of the command, e.g. the base point of SCHIEBEN. */
    reference: Point;
    cursor: Point;
    /** Size of one screen pixel in mm. */
    pixelSize: number;
    /** Largest distance of the cursor from a path in screen px (see EditorSettings.polarTolerance). */
    tolerance: number;
}

/** The polar path the cursor follows, and the cursor projected onto it. */
export interface PolarTrack {
    /** Degrees in [0, 360), counter-clockwise from +X (Y up). */
    angle: number;
    /** The cursor projected onto the path: the point a click takes. */
    point: Point;
    /** Distance of `point` from the reference point in mm. */
    distance: number;
}

/**
 * Angles of the polar paths in degrees, ascending in [0, 360): every multiple of the increment
 * plus the additional angles, without duplicates.
 */
export function polarAngles(settings: Pick<PolarSettings, 'incrementAngle' | 'additionalAngles'>): number[] {
    const angles: number[] = [];
    const add = (angle: number) => {
        const normalized = normalizeAngle(angle);
        if (!angles.some((existing) => sameAngle(existing, normalized))) {
            angles.push(normalized);
        }
    };
    const increment = settings.incrementAngle;
    if (increment > 0) {
        for (let k = 0; k * increment < 360 - ANGLE_EPSILON; k++) {
            // Rounded, so e.g. 3 × 22.5 stays exactly 67.5
            add(Math.round(k * increment * 1e9) / 1e9);
        }
    }
    settings.additionalAngles.forEach(add);
    return angles.sort((a, b) => a - b);
}

/**
 * The polar path at the cursor, like AutoCAD's polar tracking: a ray from the reference point
 * at one of the polar angles that passes within the tolerance of the cursor, in front of the
 * reference point and once the cursor is at least the tolerance away from it. The nearest path
 * wins; `previous` stays while it is still within the tolerance and no other path is more than
 * 2 px nearer, so the path does not flicker. Null while polar tracking is off or no path is near.
 */
export function findPolarTrack(query: PolarQuery, settings: PolarSettings, previous: PolarTrack | null = null): PolarTrack | null {
    if (!settings.enabled) {
        return null;
    }
    const ray = nearestRay(query, polarAngles(settings), previous?.angle ?? null);
    return ray && { angle: ray.angle, point: ray.point, distance: ray.distance };
}

/** A ray near the cursor (see nearestRay), with the cursor's distance from it. */
export interface RayHit extends PolarTrack {
    /** Distance of the cursor from the ray in screen px. */
    offset: number;
}

/**
 * The ray from `query.reference` at one of `angles` nearest to the cursor, within the tolerance,
 * in front of the reference point and once the cursor is at least the tolerance away from it.
 * The ray at `previousAngle` stays while no other one is more than HYSTERESIS_PX nearer.
 * Shared by polar tracking and object snap tracking.
 */
export function nearestRay(query: PolarQuery, angles: readonly number[], previousAngle: number | null = null): RayHit | null {
    const { reference, cursor, pixelSize, tolerance } = query;
    const dx = cursor.x - reference.x;
    const dy = cursor.y - reference.y;
    if (Math.hypot(dx, dy) / pixelSize < tolerance) {
        return null;
    }
    let best: RayHit | null = null;
    let kept: RayHit | null = null;
    for (const angle of angles) {
        const direction = angleDirection(angle);
        const along = dx * direction.x + dy * direction.y;
        // Screen px between the cursor and the path
        const offset = Math.abs(dx * direction.y - dy * direction.x) / pixelSize;
        if (along <= 0 || offset > tolerance) {
            continue;
        }
        const hit = {
            angle,
            point: { x: reference.x + direction.x * along, y: reference.y + direction.y * along },
            distance: along,
            offset,
        };
        if (best === null || offset < best.offset) {
            best = hit;
        }
        if (previousAngle !== null && sameAngle(previousAngle, angle)) {
            kept = hit;
        }
    }
    if (kept !== null && best !== null && kept.offset - best.offset <= HYSTERESIS_PX) {
        return kept;
    }
    return best;
}

/**
 * Unit vector at `angle` degrees. Components that are zero up to rounding are exactly zero, so
 * a horizontal or vertical path keeps y or x exactly.
 */
export function angleDirection(angle: number): Point {
    const radians = (angle * Math.PI) / 180;
    const clean = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);
    return { x: clean(Math.cos(radians)), y: clean(Math.sin(radians)) };
}

function normalizeAngle(angle: number): number {
    const normalized = ((angle % 360) + 360) % 360;
    return sameAngle(normalized, 360) ? 0 : normalized;
}

export function sameAngle(a: number, b: number): boolean {
    return Math.abs(a - b) < ANGLE_EPSILON;
}

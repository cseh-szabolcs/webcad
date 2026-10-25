import type { Point } from '../../model/Point';
import type { ObjectTrackingSettings, PolarSettings } from '../../../settings/editorSettings';
import { coincide } from '../snapping/SnapEngine';
import type { SnapMode } from '../snapping/SnapMode';
import { angleDirection, HYSTERESIS_PX, nearestRay, polarAngles, sameAngle, type PolarTrack } from './PolarTracking';

/** Most points acquired at once, like AutoCAD; acquiring one more drops the oldest. */
export const MAX_ACQUIRED_POINTS = 7;

/** Paths of "track orthogonally only": right, up, left, down. */
const ORTHOGONAL_ANGLES: readonly number[] = [0, 90, 180, 270];

/** Rays closer to parallel than this (cross product of the unit directions) do not cross. */
const PARALLEL_EPSILON = 1e-9;

/** A snap point acquired for object snap tracking, shown as a small +. */
export interface AcquiredPoint {
    point: Point;
    mode: SnapMode;
}

/**
 * The acquired points after dwelling on `snap`: an acquired point is dropped again, any other
 * one is added, dropping the oldest beyond MAX_ACQUIRED_POINTS.
 */
export function toggleAcquired(points: readonly AcquiredPoint[], snap: AcquiredPoint): AcquiredPoint[] {
    const i = points.findIndex(({ point }) => coincide(point, snap.point));
    if (i >= 0) {
        return [...points.slice(0, i), ...points.slice(i + 1)];
    }
    return [...points, { point: snap.point, mode: snap.mode }].slice(-MAX_ACQUIRED_POINTS);
}

/** Angles of the paths from every acquired point: orthogonal, or all polar angles. */
export function trackingAngles(settings: ObjectTrackingSettings, polar: PolarSettings): readonly number[] {
    return settings.allPolarAngles ? polarAngles(polar) : ORTHOGONAL_ANGLES;
}

/** A ray the tracking point lies on. */
export interface TrackPath {
    /** Where the ray starts: an acquired point, or the base point for a polar or Ortho path. */
    origin: Point;
    /** Degrees in [0, 360), counter-clockwise from +X (Y up). */
    angle: number;
    /** Distance of the tracking point from `origin` in mm. */
    distance: number;
    /** The acquired point's snap mode, or the base point's polar path or Ortho axis. */
    source: SnapMode | 'polar' | 'ortho';
}

/** The point object snap tracking gives: on one path, or where two paths cross. */
export interface ObjectTrack {
    point: Point;
    /** One path, or the two that cross at `point`. */
    paths: readonly TrackPath[];
}

export interface TrackingQuery {
    cursor: Point;
    /** Size of one screen pixel in mm. */
    pixelSize: number;
    /** Largest distance of the cursor from a single path in screen px (see EditorSettings.polarTolerance). */
    tolerance: number;
    /** Half the aperture box side in screen px: two paths crossing in it give their intersection. */
    aperture: number;
}

/** Rays from the base point that the tracking paths may cross: the polar paths or the Ortho axis. */
export interface BasePaths {
    origin: Point;
    angles: readonly number[];
    source: 'polar' | 'ortho';
}

export interface TrackingOptions {
    base?: BasePaths | null;
    /** Whether the point may lie on a single path; false with Ortho, which keeps it on its axis. */
    single?: boolean;
    /** The track shown last, kept by hysteresis like the polar path. */
    previous?: ObjectTrack | null;
}

interface Ray {
    origin: Point;
    angle: number;
    direction: Point;
    source: TrackPath['source'];
}

/**
 * Object snap tracking at the cursor, like AutoCAD's AutoTrack: rays from every acquired point
 * at `angles`. Where two rays from different points (or one of them and a ray of `base`) cross
 * in the aperture box, the intersection nearest to the cursor wins. Otherwise the ray nearest
 * to the cursor within the tolerance gives the cursor projected onto it (see nearestRay); the
 * previous single path stays while no other one is more than HYSTERESIS_PX nearer. Null if no
 * path is near.
 */
export function findObjectTrack(
    query: TrackingQuery,
    acquired: readonly AcquiredPoint[],
    angles: readonly number[],
    { base = null, single = true, previous = null }: TrackingOptions = {},
): ObjectTrack | null {
    if (acquired.length === 0) {
        return null;
    }
    const crossing = nearestIntersection(query, acquired, angles, base);
    if (crossing !== null || !single) {
        return crossing;
    }
    const kept = previous?.paths.length === 1 ? previous.paths[0] : null;
    let best: { track: ObjectTrack; offset: number } | null = null;
    let keptHit: { track: ObjectTrack; offset: number } | null = null;
    for (const { point, mode } of acquired) {
        const own = kept !== null && kept.source !== 'polar' && kept.source !== 'ortho' && coincide(kept.origin, point);
        const ray = nearestRay(
            { reference: point, cursor: query.cursor, pixelSize: query.pixelSize, tolerance: query.tolerance },
            angles,
            own ? kept.angle : null,
        );
        if (ray === null) {
            continue;
        }
        const hit = {
            track: { point: ray.point, paths: [{ origin: point, angle: ray.angle, distance: ray.distance, source: mode }] },
            offset: ray.offset,
        };
        if (best === null || hit.offset < best.offset) {
            best = hit;
        }
        if (own && sameAngle(ray.angle, kept.angle)) {
            keptHit = hit;
        }
    }
    if (keptHit !== null && best !== null && keptHit.offset - best.offset <= HYSTERESIS_PX) {
        return keptHit.track;
    }
    return best?.track ?? null;
}

/**
 * Whether the polar path wins over a single tracking path: the one nearer to the cursor, where
 * the one shown before (`polarBefore`) stays unless the other is more than HYSTERESIS_PX nearer.
 */
export function polarWins(polar: PolarTrack, track: ObjectTrack, cursor: Point, pixelSize: number, polarBefore: boolean): boolean {
    const polarOffset = Math.hypot(cursor.x - polar.point.x, cursor.y - polar.point.y) / pixelSize;
    const trackOffset = Math.hypot(cursor.x - track.point.x, cursor.y - track.point.y) / pixelSize;
    return polarBefore ? polarOffset - trackOffset <= HYSTERESIS_PX : trackOffset - polarOffset > HYSTERESIS_PX;
}

/** Where two rays of different origins cross in the aperture box, nearest to the cursor first. */
function nearestIntersection(
    query: TrackingQuery,
    acquired: readonly AcquiredPoint[],
    angles: readonly number[],
    base: BasePaths | null,
): ObjectTrack | null {
    const { cursor, pixelSize, aperture } = query;
    const half = aperture * pixelSize;
    // Only rays through the aperture box can cross in it: at most its half diagonal off the cursor
    const reach = half * Math.SQRT2;
    const rays: Ray[] = [];
    const add = (origin: Point, rayAngles: readonly number[], source: Ray['source']) => {
        for (const angle of rayAngles) {
            const direction = angleDirection(angle);
            const dx = cursor.x - origin.x;
            const dy = cursor.y - origin.y;
            if (Math.abs(dx * direction.y - dy * direction.x) <= reach && dx * direction.x + dy * direction.y > -reach) {
                rays.push({ origin, angle, direction, source });
            }
        }
    };
    for (const { point, mode } of acquired) {
        add(point, angles, mode);
    }
    if (base !== null) {
        add(base.origin, base.angles, base.source);
    }
    let best: { track: ObjectTrack; distance: number } | null = null;
    for (let i = 0; i < rays.length; i++) {
        for (let j = i + 1; j < rays.length; j++) {
            const a = rays[i];
            const b = rays[j];
            if (coincide(a.origin, b.origin)) {
                // Rays from the same point only meet in it
                continue;
            }
            const crossing = intersectRays(a, b);
            if (crossing === null) {
                continue;
            }
            const { point } = crossing;
            if (Math.max(Math.abs(point.x - cursor.x), Math.abs(point.y - cursor.y)) > half) {
                continue;
            }
            const distance = Math.hypot(point.x - cursor.x, point.y - cursor.y);
            if (best === null || distance < best.distance) {
                best = {
                    track: {
                        point,
                        paths: [
                            { origin: a.origin, angle: a.angle, distance: crossing.along[0], source: a.source },
                            { origin: b.origin, angle: b.angle, distance: crossing.along[1], source: b.source },
                        ],
                    },
                    distance,
                };
            }
        }
    }
    return best?.track ?? null;
}

/** Where two rays cross in front of both origins, with the distances along each; null if they do not. */
function intersectRays(a: Ray, b: Ray): { point: Point; along: [number, number] } | null {
    const denominator = a.direction.x * b.direction.y - a.direction.y * b.direction.x;
    if (Math.abs(denominator) < PARALLEL_EPSILON) {
        return null;
    }
    const wx = b.origin.x - a.origin.x;
    const wy = b.origin.y - a.origin.y;
    const s = (wx * b.direction.y - wy * b.direction.x) / denominator;
    const t = (wx * a.direction.y - wy * a.direction.x) / denominator;
    if (s <= 0 || t <= 0) {
        return null;
    }
    const point = { x: a.origin.x + a.direction.x * s, y: a.origin.y + a.direction.y * s };
    // Exact on axis-parallel rays: a vertical ray keeps its origin's x, a horizontal one its y
    for (const ray of [a, b]) {
        if (ray.direction.x === 0) {
            point.x = ray.origin.x;
        }
        if (ray.direction.y === 0) {
            point.y = ray.origin.y;
        }
    }
    return { point, along: [s, t] };
}

import { polylineTouchesRect } from '../../geometry/selectionGeometry';
import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';
import { ShapeIndex } from '../selection/ShapeIndex';
import { shapeIntersections } from './intersections';
import { buildSnapShapes, type SnapShape } from './SnapGeometry';
import { SNAP_MODE_RANK, type SnapMode } from './SnapMode';

/**
 * Distance difference (screen px) below which two snap points count as equally near; also
 * how much nearer another point must be to take over from the previous snap (hysteresis).
 */
const TIE_TOLERANCE_PX = 2;
/** Snap points closer than this (mm) are one point. */
const COINCIDENCE_MM = 1e-6;
/** Upper bound for the shape pairs intersected per query. */
const MAX_INTERSECTION_PAIRS = 200;

export interface SnapQuery {
    /** Cursor in model space. */
    cursor: Point;
    /** Size of one screen pixel in mm. */
    pixelSize: number;
    /** Half the side of the aperture box in screen px (see EditorSettings.apertureSize). */
    aperture: number;
    /** Enabled snap modes; none disables snapping. */
    modes: ReadonlySet<SnapMode>;
}

/** The snap point the cursor snaps to. Derived, never persisted. */
export interface SnapResult {
    point: Point;
    mode: SnapMode;
    /** Elements the point belongs to, e.g. both for an intersection. */
    elementIds: Id[];
}

/**
 * Curves with a centre (circles, arcs, ellipses) that the aperture touched during the
 * current point prompt. Only their centres snap: a centre is acquired by first passing over
 * its curve, so the empty middle of a circle does not snap by accident. Start a new memory
 * with every point prompt.
 */
export class SnapMemory {
    private readonly touched = new Set<Id>();

    touch(elementId: Id): void {
        this.touched.add(elementId);
    }

    has(elementId: Id): boolean {
        return this.touched.has(elementId);
    }
}

interface Candidate extends SnapResult {
    /** Distance to the cursor in screen px. */
    distance: number;
    order: number;
}

/**
 * Object snap (OSNAP) like AutoCAD's AutoSnap, on the exact element geometry. A snap point
 * only snaps when it lies in the aperture box (a square in screen px around the cursor, so
 * the same size at every zoom); a point outside never pulls the snap away from the cursor.
 * A centre also needs its curve to have been touched by the box during the prompt (see
 * SnapMemory). The nearest point wins; points within TIE_TOLERANCE_PX of it go by mode
 * (END, INT, CEN, MID, QUA), then by distance, then the element drawn on top. Coinciding
 * points merge into the higher mode. Beyond the best point, candidates() orders the others
 * the same way for Tab cycling: the next band of points within TIE_TOLERANCE_PX of each
 * other, by mode, and so on.
 *
 * Hysteresis: given the previous snap result, that point stays first while it is still in
 * the aperture and no other point is more than TIE_TOLERANCE_PX nearer, so the snap does
 * not flicker between almost equally near points.
 *
 * Elements on hidden layers do not snap, those on locked layers do. Built from the
 * document once; rebuild it when the document changes.
 */
export class SnapEngine {
    private readonly index: ShapeIndex<SnapShape>;

    constructor(doc: CadDocument) {
        this.index = new ShapeIndex(buildSnapShapes(doc));
    }

    /** The best snap point at the cursor, or null; see candidates(). */
    find(query: SnapQuery, memory: SnapMemory = new SnapMemory(), previous: SnapResult | null = null): SnapResult | null {
        return this.candidates(query, memory, previous)[0] ?? null;
    }

    /**
     * All snap points in the aperture, best first: the order Tab cycles through. With
     * `previous` (the snap result shown last), that point stays first as long as no other
     * point is more than TIE_TOLERANCE_PX nearer.
     */
    candidates(query: SnapQuery, memory: SnapMemory = new SnapMemory(), previous: SnapResult | null = null): SnapResult[] {
        const { cursor, pixelSize, aperture, modes } = query;
        if (modes.size === 0) {
            return [];
        }
        const half = aperture * pixelSize;
        const box = { x: cursor.x - half, y: cursor.y - half, width: 2 * half, height: 2 * half };
        const inside = (p: Point) => Math.max(Math.abs(p.x - cursor.x), Math.abs(p.y - cursor.y)) <= half;
        const candidates: Candidate[] = [];
        const add = (point: Point, mode: SnapMode, shapes: SnapShape[]) =>
            candidates.push({
                point,
                mode,
                distance: Math.hypot(point.x - cursor.x, point.y - cursor.y) / pixelSize,
                order: Math.max(...shapes.map((shape) => shape.order)),
                elementIds: [...new Set(shapes.map((shape) => shape.elementId))],
            });

        const shapes = this.index.search(box);
        const touching = shapes.filter((shape) => polylineTouchesRect(shape.points, box));
        for (const shape of touching) {
            if (shape.primitive.kind === 'arc' || shape.primitive.kind === 'ellipse') {
                memory.touch(shape.elementId);
            }
        }
        for (const shape of shapes) {
            for (const { point, mode } of shape.snapPoints) {
                if (modes.has(mode) && inside(point) && (mode !== 'CEN' || memory.has(shape.elementId))) {
                    add(point, mode, [shape]);
                }
            }
        }
        if (modes.has('INT')) {
            let pairs = 0;
            for (let i = 0; i < touching.length && pairs < MAX_INTERSECTION_PAIRS; i++) {
                for (let j = i + 1; j < touching.length && pairs < MAX_INTERSECTION_PAIRS; j++, pairs++) {
                    for (const point of shapeIntersections(touching[i], touching[j], box)) {
                        if (inside(point)) {
                            add(point, 'INT', [touching[i], touching[j]]);
                        }
                    }
                }
            }
        }
        return keepPrevious(rank(merge(candidates)), previous).map(({ point, mode, elementIds }) => ({
            point,
            mode,
            elementIds,
        }));
    }
}

/** Same mode at (almost) the same point: the same snap point, also in a new search. */
export function sameSnapPoint(a: SnapResult, b: SnapResult): boolean {
    return a.mode === b.mode && Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) <= COINCIDENCE_MM;
}

/** Merges coinciding candidates: the higher mode wins, the elements add up. */
function merge(candidates: Candidate[]): Candidate[] {
    const merged: Candidate[] = [];
    for (const candidate of candidates) {
        const same = merged.find(
            (other) => Math.hypot(other.point.x - candidate.point.x, other.point.y - candidate.point.y) <= COINCIDENCE_MM,
        );
        if (!same) {
            merged.push({ ...candidate });
            continue;
        }
        if (SNAP_MODE_RANK[candidate.mode] < SNAP_MODE_RANK[same.mode]) {
            same.mode = candidate.mode;
            same.point = candidate.point;
        }
        same.order = Math.max(same.order, candidate.order);
        same.elementIds = [...new Set([...same.elementIds, ...candidate.elementIds])];
    }
    return merged;
}

/**
 * Best first: the nearest point and all within TIE_TOLERANCE_PX of it form a band, ordered by
 * mode, then distance, then the element drawn on top; the remaining points follow in bands
 * the same way.
 */
function rank(candidates: Candidate[]): Candidate[] {
    const rest = [...candidates].sort((a, b) => a.distance - b.distance);
    const ranked: Candidate[] = [];
    while (rest.length > 0) {
        const limit = rest[0].distance + TIE_TOLERANCE_PX;
        const end = rest.findIndex((candidate) => candidate.distance > limit);
        const band = rest.splice(0, end === -1 ? rest.length : end);
        ranked.push(
            ...band.sort(
                (a, b) =>
                    SNAP_MODE_RANK[a.mode] - SNAP_MODE_RANK[b.mode] || a.distance - b.distance || b.order - a.order,
            ),
        );
    }
    return ranked;
}

/** Moves the previous snap point to the front unless another point is clearly nearer. */
function keepPrevious(ranked: Candidate[], previous: SnapResult | null): Candidate[] {
    const i = previous ? ranked.findIndex((candidate) => sameSnapPoint(candidate, previous)) : -1;
    if (i <= 0) {
        return ranked;
    }
    const nearest = Math.min(...ranked.map((candidate) => candidate.distance));
    if (nearest < ranked[i].distance - TIE_TOLERANCE_PX) {
        return ranked;
    }
    return [ranked[i], ...ranked.slice(0, i), ...ranked.slice(i + 1)];
}

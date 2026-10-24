import { polylineTouchesRect } from '../../geometry/selectionGeometry';
import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';
import { ShapeIndex } from '../selection/ShapeIndex';
import { shapeIntersections } from './intersections';
import { buildSnapShapes, type SnapShape } from './SnapGeometry';
import { SNAP_MODE_RANK, type SnapMode } from './SnapMode';

/** Distance difference (screen px) below which two snap points count as equally near. */
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
    /**
     * A centre outside the aperture, found because its curve passes through it. The magnet
     * leaves the cursor at the pointer for these, like AutoCAD.
     */
    remote: boolean;
}

/**
 * Curves with a centre (circles, arcs, ellipses) that the aperture touched during the
 * current point prompt. Their centre then also snaps when the cursor is right on it, like
 * AutoCAD, where a centre is found by first passing over the curve. Start a new memory with
 * every point prompt.
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

/** Candidate classes: points inside the aperture win over centres of curves passing through it. */
const INSIDE = 0;
const REMOTE = 1;

interface Candidate extends Omit<SnapResult, 'remote'> {
    klass: typeof INSIDE | typeof REMOTE;
    /** Distance to the cursor in screen px. */
    distance: number;
    order: number;
}

/**
 * Object snap (OSNAP) like AutoCAD's AutoSnap, on the exact element geometry. Endpoints,
 * midpoints, quadrants and intersections snap when they lie in the aperture box (a square in
 * screen px around the cursor, so the same size at every zoom). A centre snaps as soon as
 * its curve passes through the box, and when the cursor is on it after the curve did (see
 * SnapMemory). Points in the box win over remote centres; among them the nearest wins, and
 * points within TIE_TOLERANCE_PX of it go by mode (END, INT, CEN, MID, QUA), then by
 * distance, then the element drawn on top. Coinciding points merge into the higher mode.
 *
 * Elements on hidden layers do not snap, those on locked layers do. Built from the
 * document once; rebuild it when the document changes.
 */
export class SnapEngine {
    private readonly index: ShapeIndex<SnapShape>;

    constructor(doc: CadDocument) {
        this.index = new ShapeIndex(buildSnapShapes(doc));
    }

    find(query: SnapQuery, memory: SnapMemory = new SnapMemory()): SnapResult | null {
        const { cursor, pixelSize, aperture, modes } = query;
        if (modes.size === 0) {
            return null;
        }
        const half = aperture * pixelSize;
        const box = { x: cursor.x - half, y: cursor.y - half, width: 2 * half, height: 2 * half };
        const inside = (p: Point) => Math.max(Math.abs(p.x - cursor.x), Math.abs(p.y - cursor.y)) <= half;
        const candidates: Candidate[] = [];
        const add = (point: Point, mode: SnapMode, klass: Candidate['klass'], shapes: SnapShape[]) =>
            candidates.push({
                point,
                mode,
                klass,
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
            const touches = touching.includes(shape);
            for (const { point, mode } of shape.snapPoints) {
                if (!modes.has(mode)) {
                    continue;
                }
                if (mode === 'CEN' && touches) {
                    add(point, mode, inside(point) ? INSIDE : REMOTE, [shape]);
                } else if (inside(point) && (mode !== 'CEN' || memory.has(shape.elementId))) {
                    add(point, mode, INSIDE, [shape]);
                }
            }
        }
        if (modes.has('INT')) {
            let pairs = 0;
            for (let i = 0; i < touching.length && pairs < MAX_INTERSECTION_PAIRS; i++) {
                for (let j = i + 1; j < touching.length && pairs < MAX_INTERSECTION_PAIRS; j++, pairs++) {
                    for (const point of shapeIntersections(touching[i], touching[j], box)) {
                        if (inside(point)) {
                            add(point, 'INT', INSIDE, [touching[i], touching[j]]);
                        }
                    }
                }
            }
        }
        const best = pickBest(merge(candidates));
        return best && { point: best.point, mode: best.mode, elementIds: best.elementIds, remote: best.klass === REMOTE };
    }
}

/** Merges coinciding candidates: the higher mode and class win, the elements add up. */
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
        same.klass = Math.min(same.klass, candidate.klass) as Candidate['klass'];
        same.order = Math.max(same.order, candidate.order);
        same.elementIds = [...new Set([...same.elementIds, ...candidate.elementIds])];
    }
    return merged;
}

function pickBest(candidates: Candidate[]): Candidate | null {
    if (candidates.length === 0) {
        return null;
    }
    const klass = Math.min(...candidates.map((candidate) => candidate.klass));
    const inClass = candidates.filter((candidate) => candidate.klass === klass);
    const nearest = Math.min(...inClass.map((candidate) => candidate.distance));
    return inClass
        .filter((candidate) => candidate.distance <= nearest + TIE_TOLERANCE_PX)
        .sort(
            (a, b) =>
                SNAP_MODE_RANK[a.mode] - SNAP_MODE_RANK[b.mode] || a.distance - b.distance || b.order - a.order,
        )[0];
}

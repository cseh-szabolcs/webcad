import { boundsOf, pointInPolygon, polylineTouchesRect } from '../../geometry/selectionGeometry';
import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import { ShapeIndex } from '../selection/ShapeIndex';
import { shapeIntersections } from './intersections';
import { buildSnapShapes, type SnapPoint, type SnapShape } from './SnapGeometry';
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
 * Elements whose outline the aperture touched during the current point prompt. Only the
 * centres of touched curves snap: a centre is acquired by first passing over its curve, so
 * the empty middle of a circle does not snap by accident. Likewise the snap point preview
 * only shows a closed element around the cursor after the cursor came in over its outline.
 * Start a new memory with every point prompt.
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

/** Area enclosed by a closed element (circle, ellipse, closed polyline …), for the snap point preview. */
interface Region {
    elementId: Id;
    /** The element's sampled outline, closed implicitly. */
    polygon: Point[];
    area: number;
    bounds: Rect;
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
    private readonly shapesByElement = new Map<Id, SnapShape[]>();
    /** Snap points of an element in all modes, unmerged (see objectSnapPoints); filled on demand. */
    private readonly objectPoints = new Map<Id, SnapPoint[]>();
    private readonly regions: ShapeIndex<Region>;

    constructor(doc: CadDocument) {
        const shapes = buildSnapShapes(doc);
        this.index = new ShapeIndex(shapes);
        for (const shape of shapes) {
            const own = this.shapesByElement.get(shape.elementId);
            if (own) {
                own.push(shape);
            } else {
                this.shapesByElement.set(shape.elementId, [shape]);
            }
        }
        this.regions = new ShapeIndex(
            [...this.shapesByElement].flatMap(([elementId, own]) => {
                const region = closedRegion(elementId, own);
                return region ? [region] : [];
            }),
        );
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
        const box = apertureBox(query);
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
            memory.touch(shape.elementId);
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

    /**
     * Snap point preview, a deliberate deviation from AutoCAD: all snap points in the enabled
     * modes of the elements whose outline passes through the aperture, wherever they lie
     * (endpoints, midpoints, centres, quadrants and the elements' intersections with all
     * others). Where no outline does, those of the innermost closed element around the cursor
     * (the smallest area: in the table, not the rug under it) whose outline the cursor passed
     * over in this prompt (see SnapMemory), so it came in over the outline; an element the
     * prompt started in shows only once its outline was touched. Coinciding points merge into the
     * higher mode; the order is stable (drawing order of the elements). They only show where
     * snapping is possible, a centre included.
     */
    previewPoints(query: SnapQuery, memory: SnapMemory = new SnapMemory()): SnapPoint[] {
        if (query.modes.size === 0) {
            return [];
        }
        const box = apertureBox(query);
        const elementIds = new Set(
            this.index
                .search(box)
                .filter((shape) => polylineTouchesRect(shape.points, box))
                .map((shape) => shape.elementId),
        );
        for (const id of elementIds) {
            memory.touch(id);
        }
        if (elementIds.size === 0) {
            const { cursor } = query;
            const around = this.regions
                .search({ x: cursor.x, y: cursor.y, width: 0, height: 0 })
                .filter((region) => memory.has(region.elementId) && pointInPolygon(cursor, region.polygon));
            if (around.length > 0) {
                elementIds.add(around.reduce((inner, region) => (region.area < inner.area ? region : inner)).elementId);
            }
        }
        return distinctPoints(
            [...elementIds].flatMap((id) => this.objectSnapPoints(id)).filter(({ mode }) => query.modes.has(mode)),
        );
    }

    /** Fixed snap points of an element and its intersections with every other shape (its own too). */
    private objectSnapPoints(elementId: Id): SnapPoint[] {
        const cached = this.objectPoints.get(elementId);
        if (cached) {
            return cached;
        }
        const shapes = this.shapesByElement.get(elementId) ?? [];
        const points = shapes.flatMap((shape) => shape.snapPoints);
        for (const shape of shapes) {
            for (const other of this.index.search(shape.bounds)) {
                if (other === shape) {
                    continue;
                }
                // The crossings lie where both shapes' bounds overlap
                for (const point of shapeIntersections(shape, other, overlap(shape.bounds, other.bounds))) {
                    points.push({ point, mode: 'INT' });
                }
            }
        }
        this.objectPoints.set(elementId, points);
        return points;
    }
}

/**
 * The area an element encloses: its primitives run on from one to the next and back to the
 * start (circle, ellipse, closed polyline, also a chain that happens to end where it began).
 * Null for an open element.
 */
function closedRegion(elementId: Id, shapes: readonly SnapShape[]): Region | null {
    const ends = (shape: SnapShape) => [shape.points[0], shape.points[shape.points.length - 1]] as const;
    const chained = shapes.every((shape, i) => coincide(ends(shapes[(i + 1) % shapes.length])[0], ends(shape)[1]));
    // Each primitive without its last point, which is the next one's first
    const polygon = shapes.flatMap((shape) => shape.points.slice(0, -1));
    if (!chained || polygon.length < 3) {
        return null;
    }
    let twiceArea = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        twiceArea += (polygon[j].x - polygon[i].x) * (polygon[j].y + polygon[i].y);
    }
    const area = Math.abs(twiceArea) / 2;
    return area > 0 ? { elementId, polygon, area, bounds: boundsOf(polygon) } : null;
}

/** The aperture box around the cursor in model space. */
function apertureBox({ cursor, pixelSize, aperture }: SnapQuery): Rect {
    const half = aperture * pixelSize;
    return { x: cursor.x - half, y: cursor.y - half, width: 2 * half, height: 2 * half };
}

/** Overlap of two rectangles that touch. */
function overlap(a: Rect, b: Rect): Rect {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    return {
        x,
        y,
        width: Math.max(Math.min(a.x + a.width, b.x + b.width) - x, 0),
        height: Math.max(Math.min(a.y + a.height, b.y + b.height) - y, 0),
    };
}

/** Coinciding points as one, in the higher mode, at the place of the first. */
function distinctPoints(points: SnapPoint[]): SnapPoint[] {
    const distinct: SnapPoint[] = [];
    for (const candidate of points) {
        const i = distinct.findIndex(({ point }) => coincide(point, candidate.point));
        if (i === -1) {
            distinct.push(candidate);
        } else if (SNAP_MODE_RANK[candidate.mode] < SNAP_MODE_RANK[distinct[i].mode]) {
            distinct[i] = { point: distinct[i].point, mode: candidate.mode };
        }
    }
    return distinct;
}

/** Same mode at (almost) the same point: the same snap point, also in a new search. */
export function sameSnapPoint(a: SnapResult, b: SnapResult): boolean {
    return a.mode === b.mode && coincide(a.point, b.point);
}

/** Points closer than COINCIDENCE_MM: one snap point, whatever the search found them by. */
export function coincide(a: Point, b: Point): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) <= COINCIDENCE_MM;
}

/** Merges coinciding candidates: the higher mode wins, the elements add up. */
function merge(candidates: Candidate[]): Candidate[] {
    const merged: Candidate[] = [];
    for (const candidate of candidates) {
        const same = merged.find((other) => coincide(other.point, candidate.point));
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

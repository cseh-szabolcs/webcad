import type { Point } from '../model/Point';
import type { Rect } from '../renderer/Viewport';

/*
 * Geometry for object selection on flattened outlines (see flattenPathSpec). Only the
 * outline counts: a fill or the inside of a closed shape is never hit.
 */

/** Rectangle spanned by two opposite corners in any order. */
export function rectFromCorners(a: Point, b: Point): Rect {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x),
        height: Math.abs(a.y - b.y),
    };
}

/** Bounding box of a non-empty point list. */
export function boundsOf(points: readonly Point[]): Rect {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Shortest distance from `p` to the polyline; Infinity for an empty one. */
export function distanceToPolyline(p: Point, points: readonly Point[]): number {
    if (points.length === 1) {
        return Math.hypot(p.x - points[0].x, p.y - points[0].y);
    }
    let best = Infinity;
    for (let i = 1; i < points.length; i++) {
        best = Math.min(best, distanceToSegment(p, points[i - 1], points[i]));
    }
    return best;
}

/** Window selection: the whole polyline lies inside the rectangle (edges included). */
export function polylineInsideRect(points: readonly Point[], rect: Rect): boolean {
    return points.length > 0 && points.every((p) => pointInRect(p, rect));
}

/** Crossing selection: the polyline lies inside the rectangle or crosses one of its edges. */
export function polylineTouchesRect(points: readonly Point[], rect: Rect): boolean {
    if (points.some((p) => pointInRect(p, rect))) {
        return true;
    }
    return crossesEdges(points, rectCorners(rect));
}

/** Even-odd test; the polygon is closed implicitly. */
export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Window lasso: every point lies inside the (possibly concave) polygon and no segment
 * leaves it, which can happen at a concave notch even with both ends inside.
 */
export function polylineInsidePolygon(points: readonly Point[], polygon: readonly Point[]): boolean {
    if (points.length === 0 || polygon.length < 3) {
        return false;
    }
    return points.every((p) => pointInPolygon(p, polygon)) && !crossesEdges(points, polygon);
}

/** Crossing lasso: part of the polyline lies inside the polygon or crosses its outline. */
export function polylineTouchesPolygon(points: readonly Point[], polygon: readonly Point[]): boolean {
    if (polygon.length < 3) {
        return false;
    }
    return points.some((p) => pointInPolygon(p, polygon)) || crossesEdges(points, polygon);
}

function pointInRect(p: Point, rect: Rect): boolean {
    return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

function rectCorners(rect: Rect): Point[] {
    const right = rect.x + rect.width;
    const top = rect.y + rect.height;
    return [
        { x: rect.x, y: rect.y },
        { x: right, y: rect.y },
        { x: right, y: top },
        { x: rect.x, y: top },
    ];
}

/** Whether a segment of the polyline intersects an edge of the closed polygon. */
function crossesEdges(points: readonly Point[], polygon: readonly Point[]): boolean {
    for (let i = 1; i < points.length; i++) {
        for (let j = 0, k = polygon.length - 1; j < polygon.length; k = j++) {
            if (segmentsIntersect(points[i - 1], points[i], polygon[k], polygon[j])) {
                return true;
            }
        }
    }
    return false;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.min(Math.max(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0), 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Closed segments ab and cd share at least one point (touching and collinear overlap count). */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
    const d1 = orientation(c, d, a);
    const d2 = orientation(c, d, b);
    const d3 = orientation(a, b, c);
    const d4 = orientation(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    return (
        (d1 === 0 && onSegment(c, d, a)) ||
        (d2 === 0 && onSegment(c, d, b)) ||
        (d3 === 0 && onSegment(a, b, c)) ||
        (d4 === 0 && onSegment(a, b, d))
    );
}

/** Sign of the cross product (b − a) × (p − a). */
function orientation(a: Point, b: Point, p: Point): number {
    return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
}

/** For a point collinear with ab: whether it lies within the segment's bounding box. */
function onSegment(a: Point, b: Point, p: Point): boolean {
    return (
        p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
    );
}

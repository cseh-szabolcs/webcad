import type { Point } from '../model/Point';
import type { PathSpec } from '../renderer/PathSpec';
import type { Rect } from '../renderer/Viewport';

/** Upper bound for the pieces of one cubic segment, so a tiny tolerance cannot explode. */
const MAX_PIECES_PER_CURVE = 256;

/**
 * Polyline approximation of a path in model space. Straight segments are kept as they are;
 * cubic segments are split into equal parameter steps so that the polyline stays within
 * `tolerance` (mm) of the curve. A closed path ends with its first point again.
 */
export function flattenPathSpec(spec: PathSpec, tolerance: number): Point[] {
    const { segments } = spec;
    if (segments.length === 0) {
        return [];
    }
    const points: Point[] = [copy(segments[0].point)];
    const count = spec.closed ? segments.length : segments.length - 1;
    for (let i = 0; i < count; i++) {
        const from = segments[i];
        const to = segments[(i + 1) % segments.length];
        if (!from.handleOut && !to.handleIn) {
            points.push(copy(to.point));
            continue;
        }
        const p0 = from.point;
        const p1 = from.handleOut ? { x: p0.x + from.handleOut.x, y: p0.y + from.handleOut.y } : p0;
        const p3 = to.point;
        const p2 = to.handleIn ? { x: p3.x + to.handleIn.x, y: p3.y + to.handleIn.y } : p3;
        points.push(...flattenCubic(p0, p1, p2, p3, tolerance));
    }
    return points;
}

/**
 * Exact bounding box of a path in model space, without flattening it; it contains every
 * point of flattenPathSpec.
 */
export function pathSpecBounds(spec: PathSpec): Rect {
    const { segments } = spec;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const add = (x: number, y: number) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    };
    for (const { point } of segments) {
        add(point.x, point.y);
    }
    const count = spec.closed ? segments.length : segments.length - 1;
    for (let i = 0; i < count; i++) {
        const from = segments[i];
        const to = segments[(i + 1) % segments.length];
        if (!from.handleOut && !to.handleIn) {
            continue;
        }
        const p0 = from.point;
        const p1 = from.handleOut ? { x: p0.x + from.handleOut.x, y: p0.y + from.handleOut.y } : p0;
        const p3 = to.point;
        const p2 = to.handleIn ? { x: p3.x + to.handleIn.x, y: p3.y + to.handleIn.y } : p3;
        // The curve turns around where a derivative is zero
        for (const t of [...cubicExtrema(p0.x, p1.x, p2.x, p3.x), ...cubicExtrema(p0.y, p1.y, p2.y, p3.y)]) {
            const u = 1 - t;
            const a = u * u * u;
            const b = 3 * u * u * t;
            const c = 3 * u * t * t;
            const d = t * t * t;
            add(a * p0.x + b * p1.x + c * p2.x + d * p3.x, a * p0.y + b * p1.y + c * p2.y + d * p3.y);
        }
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Parameters in (0, 1) where one coordinate of a cubic Bézier has a zero derivative. */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
    // Derivative / 3 = a·t² + b·t + c
    const a = p3 - 3 * p2 + 3 * p1 - p0;
    const b = 2 * (p2 - 2 * p1 + p0);
    const c = p1 - p0;
    const roots: number[] = [];
    if (Math.abs(a) < 1e-12 * (Math.abs(b) + Math.abs(c))) {
        if (b !== 0) {
            roots.push(-c / b);
        }
    } else {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
            const root = Math.sqrt(discriminant);
            roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
        }
    }
    return roots.filter((t) => t > 0 && t < 1);
}

/**
 * Points of a cubic Bézier after `p0`, ending with `p3`. Linear interpolation over a step h
 * deviates by at most M·h²/8, where M bounds the second derivative (6 × the largest second
 * difference of the control points); the piece count is chosen from that bound.
 */
function flattenCubic(p0: Point, p1: Point, p2: Point, p3: Point, tolerance: number): Point[] {
    const dd1 = Math.hypot(p0.x - 2 * p1.x + p2.x, p0.y - 2 * p1.y + p2.y);
    const dd2 = Math.hypot(p1.x - 2 * p2.x + p3.x, p1.y - 2 * p2.y + p3.y);
    const maxSecondDerivative = 6 * Math.max(dd1, dd2);
    const pieces = Math.min(
        Math.max(Math.ceil(Math.sqrt(maxSecondDerivative / (8 * tolerance))), 1),
        MAX_PIECES_PER_CURVE,
    );

    const points: Point[] = [];
    for (let i = 1; i < pieces; i++) {
        const t = i / pieces;
        const u = 1 - t;
        const a = u * u * u;
        const b = 3 * u * u * t;
        const c = 3 * u * t * t;
        const d = t * t * t;
        points.push({
            x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
            y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
        });
    }
    points.push(copy(p3));
    return points;
}

/** Plain point, so vertex objects (with their ids) do not leak into derived outlines. */
function copy(p: Point): Point {
    return { x: p.x, y: p.y };
}

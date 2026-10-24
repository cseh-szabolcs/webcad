import type { Point } from '../model/Point';

/** Cubic Bézier by its four absolute control points, in model space. */
export interface CubicBezier {
    p0: Point;
    p1: Point;
    p2: Point;
    p3: Point;
}

/** Gauss–Legendre nodes and weights on [−1, 1], five points. */
const GAUSS = [
    [0, 0.5688888888888889],
    [-0.5384693101056831, 0.4786286704993665],
    [0.5384693101056831, 0.4786286704993665],
    [-0.906179845938664, 0.2369268850561891],
    [0.906179845938664, 0.2369268850561891],
] as const;
/** Sub-intervals for the length integral, so strongly bent curves stay accurate. */
const LENGTH_INTERVALS = 16;
const MIDPOINT_ITERATIONS = 50;

export function bezierPoint({ p0, p1, p2, p3 }: CubicBezier, t: number): Point {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/** First derivative with respect to t. */
export function bezierDerivative({ p0, p1, p2, p3 }: CubicBezier, t: number): Point {
    const u = 1 - t;
    const a = 3 * u * u;
    const b = 6 * u * t;
    const c = 3 * t * t;
    return {
        x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
        y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
    };
}

/** Arc length from t = 0 to `t`. */
export function bezierLength(curve: CubicBezier, t = 1): number {
    const step = t / LENGTH_INTERVALS;
    let length = 0;
    for (let i = 0; i < LENGTH_INTERVALS; i++) {
        const mid = (i + 0.5) * step;
        for (const [node, weight] of GAUSS) {
            const d = bezierDerivative(curve, mid + (node * step) / 2);
            length += (weight * step * Math.hypot(d.x, d.y)) / 2;
        }
    }
    return length;
}

/** Point halfway along the curve by arc length (not at t = 0.5), like AutoCAD's midpoint snap. */
export function bezierMidpoint(curve: CubicBezier): Point {
    const half = bezierLength(curve) / 2;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < MIDPOINT_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        if (bezierLength(curve, mid) < half) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return bezierPoint(curve, (lo + hi) / 2);
}

import type { Point } from '../model/Point';

export interface CircleShape {
    center: Point;
    radius: number;
}

/** Relative to the size of the points, below which three points count as on one line. */
const COLLINEAR = 1e-12;

/** The circle with `a` and `b` as the ends of a diameter; null if they coincide. */
export function circleOnDiameter(a: Point, b: Point): CircleShape | null {
    const radius = Math.hypot(b.x - a.x, b.y - a.y) / 2;
    return radius > 0 ? { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, radius } : null;
}

/** The circle through three points (circumcircle); null if two coincide or all lie on one line. */
export function circleThrough(a: Point, b: Point, c: Point): CircleShape | null {
    // Relative to `a`, so far-off coordinates keep their precision
    const bx = b.x - a.x;
    const by = b.y - a.y;
    const cx = c.x - a.x;
    const cy = c.y - a.y;
    const d = 2 * (bx * cy - by * cx);
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    if (Math.abs(d) <= COLLINEAR * Math.max(b2, c2)) {
        return null;
    }
    const ux = (cy * b2 - by * c2) / d;
    const uy = (bx * c2 - cx * b2) / d;
    return { center: { x: a.x + ux, y: a.y + uy }, radius: Math.hypot(ux, uy) };
}

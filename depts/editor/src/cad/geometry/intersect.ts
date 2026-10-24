import type { Point } from '../model/Point';

/** Tolerance for curve parameters at the ends of a segment. */
const PARAM_EPS = 1e-9;
const NEWTON_ITERATIONS = 12;
/** Distance (mm) below which two curve points count as the same intersection. */
const NEWTON_TOLERANCE = 1e-7;

/** A curve over t ∈ [0, 1] with its first derivative, for numeric intersections. */
export interface ParametricCurve {
    point(t: number): Point;
    derivative(t: number): Point;
}

/**
 * Parameters of the crossing of segments ab and cd: `t` along ab, `u` along cd, both in
 * [0, 1]. Parallel and collinear segments give null (an overlap has no single point).
 */
export function segmentIntersectionParams(a: Point, b: Point, c: Point, d: Point): { t: number; u: number } | null {
    const rx = b.x - a.x;
    const ry = b.y - a.y;
    const sx = d.x - c.x;
    const sy = d.y - c.y;
    const denominator = rx * sy - ry * sx;
    const scale = Math.hypot(rx, ry) * Math.hypot(sx, sy);
    if (scale === 0 || Math.abs(denominator) <= 1e-12 * scale) {
        return null;
    }
    const qx = c.x - a.x;
    const qy = c.y - a.y;
    const t = (qx * sy - qy * sx) / denominator;
    const u = (qx * ry - qy * rx) / denominator;
    if (t < -PARAM_EPS || t > 1 + PARAM_EPS || u < -PARAM_EPS || u > 1 + PARAM_EPS) {
        return null;
    }
    return { t, u };
}

/** Crossing point of segments ab and cd, if any (see segmentIntersectionParams). */
export function segmentIntersections(a: Point, b: Point, c: Point, d: Point): Point[] {
    const params = segmentIntersectionParams(a, b, c, d);
    return params ? [{ x: a.x + params.t * (b.x - a.x), y: a.y + params.t * (b.y - a.y) }] : [];
}

/** Points where segment ab meets the circle; a tangent gives one point. */
export function segmentCircleIntersections(a: Point, b: Point, center: Point, radius: number): Point[] {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fx = a.x - center.x;
    const fy = a.y - center.y;
    const qa = dx * dx + dy * dy;
    if (qa === 0) {
        return [];
    }
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - radius * radius;
    let discriminant = qb * qb - 4 * qa * qc;
    // Grazing within rounding counts as touching
    if (discriminant < 0 && discriminant > -1e-9 * qb * qb) {
        discriminant = 0;
    }
    if (discriminant < 0) {
        return [];
    }
    const root = Math.sqrt(discriminant);
    const ts = root === 0 ? [-qb / (2 * qa)] : [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)];
    return ts
        .filter((t) => t >= -PARAM_EPS && t <= 1 + PARAM_EPS)
        .map((t) => ({ x: a.x + t * dx, y: a.y + t * dy }));
}

/** Points where two circles meet; touching circles give one point, equal ones none. */
export function circleIntersections(c1: Point, r1: number, c2: Point, r2: number): Point[] {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);
    if (d === 0 || d > r1 + r2 + 1e-9 * (r1 + r2) || d < Math.abs(r1 - r2) - 1e-9 * (r1 + r2)) {
        return [];
    }
    // Distance from c1 to the radical line along c1 → c2, and the half chord
    const along = (d * d + r1 * r1 - r2 * r2) / (2 * d);
    const half = Math.sqrt(Math.max(r1 * r1 - along * along, 0));
    const mx = c1.x + (along * dx) / d;
    const my = c1.y + (along * dy) / d;
    if (half === 0) {
        return [{ x: mx, y: my }];
    }
    const ox = (-dy * half) / d;
    const oy = (dx * half) / d;
    return [
        { x: mx + ox, y: my + oy },
        { x: mx - ox, y: my - oy },
    ];
}

/**
 * Refines an approximate intersection of two curves at parameters (t, s) with Newton's
 * method on p(t) − q(s) = 0. Returns the parameters, or null if it does not converge (e.g.
 * where the curves only touch) or leaves [0, 1].
 */
export function refineIntersection(
    p: ParametricCurve,
    q: ParametricCurve,
    t: number,
    s: number,
): { t: number; s: number } | null {
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
        const a = p.point(t);
        const b = q.point(s);
        const fx = a.x - b.x;
        const fy = a.y - b.y;
        if (Math.hypot(fx, fy) <= NEWTON_TOLERANCE) {
            return t >= -PARAM_EPS && t <= 1 + PARAM_EPS && s >= -PARAM_EPS && s <= 1 + PARAM_EPS ? { t, s } : null;
        }
        const dp = p.derivative(t);
        const dq = q.derivative(s);
        // Solve [dp, −dq] · (Δt, Δs) = −f
        const det = -dp.x * dq.y + dq.x * dp.y;
        if (Math.abs(det) < 1e-12) {
            return null;
        }
        t += (fx * dq.y - fy * dq.x) / det;
        s += (dp.y * fx - dp.x * fy) / det;
    }
    return null;
}

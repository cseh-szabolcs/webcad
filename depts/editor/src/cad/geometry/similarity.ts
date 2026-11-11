import type { Point, Vector2 } from '../model/Point';

/**
 * A rotation, uniform scaling or reflection about a point (shapes keep their form): the matrix
 * `x' = a·x + c·y + tx`, `y' = b·x + d·y + ty`, and what it does to a length (`scale`), to a
 * direction (`rotation`, radians counter-clockwise, after the flip of Y if `mirrored`) and to
 * the sense of rotation.
 */
export interface Similarity {
    a: number;
    b: number;
    c: number;
    d: number;
    tx: number;
    ty: number;
    scale: number;
    rotation: number;
    mirrored: boolean;
}

/** Counter-clockwise rotation about `origin`; multiples of 90° turn exactly. */
export function rotationAbout(origin: Point, degrees: number): Similarity {
    return similarity(origin, 1, degrees, false);
}

/** Scaling by `factor` from `origin`. */
export function scalingAbout(origin: Point, factor: number): Similarity {
    return similarity(origin, factor, 0, false);
}

/** Reflection across the line through `a` and `b`; null if they coincide. */
export function reflectionAcross(a: Point, b: Point): Similarity | null {
    if (a.x === b.x && a.y === b.y) {
        return null;
    }
    // Flipping Y and turning by twice the line's angle
    return similarity(a, 1, (2 * Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, true);
}

export function transformPoint(s: Similarity, { x, y }: Point): Point {
    return { x: s.a * x + s.c * y + s.tx, y: s.b * x + s.d * y + s.ty };
}

/** A direction or offset, which the fixed point does not move. */
export function transformVector(s: Similarity, { x, y }: Vector2): Vector2 {
    return { x: s.a * x + s.c * y, y: s.b * x + s.d * y };
}

/** The direction `angle` (radians) afterwards, in (-π, π]. */
export function transformAngle(s: Similarity, angle: number): number {
    const turned = s.rotation + (s.mirrored ? -angle : angle);
    const wrapped = turned - 2 * Math.PI * Math.ceil((turned - Math.PI) / (2 * Math.PI));
    return wrapped + 0;
}

function similarity(origin: Point, scale: number, degrees: number, mirrored: boolean): Similarity {
    const [cos, sin] = cosSin(degrees);
    const flip = mirrored ? -1 : 1;
    // `+ 0` leaves no negative zero
    const a = scale * cos + 0;
    const b = scale * sin + 0;
    const c = -scale * flip * sin + 0;
    const d = scale * flip * cos + 0;
    return {
        a,
        b,
        c,
        d,
        tx: origin.x - (a * origin.x + c * origin.y),
        ty: origin.y - (b * origin.x + d * origin.y),
        scale,
        rotation: (degrees * Math.PI) / 180,
        mirrored,
    };
}

/** Exact for multiples of 90°, so a quarter turn leaves no rounding in the coordinates. */
function cosSin(degrees: number): [number, number] {
    const quarters = degrees / 90;
    if (Math.abs(quarters - Math.round(quarters)) < 1e-9) {
        const exact: [number, number][] = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
        ];
        return exact[((Math.round(quarters) % 4) + 4) % 4];
    }
    const radians = (degrees * Math.PI) / 180;
    return [Math.cos(radians), Math.sin(radians)];
}

import type { Point, Vector2 } from '../model/Point';

/** An ellipse by its centre, radii and the angle of its `radiusX` axis (radians, counter-clockwise, Y up). */
export interface EllipseShape {
    center: Point;
    radiusX: number;
    radiusY: number;
    rotation: number;
}

/** `v` (given in the ellipse's own axes) turned by `rotation` into model directions. */
export function rotate(v: Vector2, rotation: number): Vector2 {
    if (rotation === 0) {
        return v;
    }
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** The point at parameter `angle` (0 = end of the `radiusX` axis, π/2 = end of the `radiusY` axis). */
export function ellipsePoint({ center, radiusX, radiusY, rotation }: EllipseShape, angle: number): Point {
    const v = rotate({ x: radiusX * Math.cos(angle), y: radiusY * Math.sin(angle) }, rotation);
    return { x: center.x + v.x, y: center.y + v.y };
}

/** Derivative of ellipsePoint by `angle`. */
export function ellipseTangent({ radiusX, radiusY, rotation }: EllipseShape, angle: number): Vector2 {
    return rotate({ x: -radiusX * Math.sin(angle), y: radiusY * Math.cos(angle) }, rotation);
}

/** The four axis ends, counter-clockwise from the end of the `radiusX` axis. */
export function ellipseQuadrants({ center, radiusX, radiusY, rotation }: EllipseShape): Point[] {
    // Exact cosines and sines, so an axis-aligned ellipse gets exact points
    const ends = [
        { x: radiusX, y: 0 },
        { x: 0, y: radiusY },
        { x: -radiusX, y: 0 },
        { x: 0, y: -radiusY },
    ];
    return ends.map((end) => {
        const v = rotate(end, rotation);
        return { x: center.x + v.x, y: center.y + v.y };
    });
}

import type { Point } from '../model/Point';
import { arcCenterOverChord, arcSweep, arcThrough, type ArcSweep } from './arc';

/**
 * One segment of a polyline: straight, or with a `bulge` an arc from `from` to `to`. The bulge
 * is the tangent of a quarter of the angle the arc spans, like in DXF: positive counter-clockwise
 * (Y up), 1 half a circle.
 */
export interface PolylineSegment {
    from: Point;
    to: Point;
    bulge: number;
}

/** The segments through `points` in order; a closed polyline (of more than two points) also back to the first. */
export function polylineSegments(points: readonly Point[], bulges: readonly number[], closed: boolean): PolylineSegment[] {
    const count = closed && points.length > 2 ? points.length : points.length - 1;
    const segments: PolylineSegment[] = [];
    for (let i = 0; i < count; i++) {
        segments.push({ from: points[i], to: points[(i + 1) % points.length], bulge: bulges[i] ?? 0 });
    }
    return segments;
}

/** The signed angle (radians) the arc of a bulge spans, positive counter-clockwise. */
export function bulgeSweep(bulge: number): number {
    return 4 * Math.atan(bulge);
}

/** The arc of a segment with a bulge: its centre, radius and angles; null for a straight one or one of no length. */
export function bulgeArc({ from, to, bulge }: PolylineSegment): (ArcSweep & { center: Point; clockwise: boolean }) | null {
    const sweep = bulgeSweep(bulge);
    const center = bulge === 0 ? null : arcCenterOverChord(from, to, sweep);
    if (center === null) {
        return null;
    }
    return {
        center,
        radius: Math.hypot(from.x - center.x, from.y - center.y),
        startAngle: Math.atan2(from.y - center.y, from.x - center.x),
        sweep,
        clockwise: sweep < 0,
    };
}

/** The bulge of the arc from `from` through `mid` to `to`; null if they give none (on one line, or two coincide). */
export function bulgeThrough(from: Point, mid: Point, to: Point): number | null {
    const arc = arcThrough(from, mid, to);
    return arc && Math.tan(arcSweep(arc.center, from, to, arc.clockwise).sweep / 4);
}

/** The middle of a segment: of its chord, or with a bulge of its arc (its sagitta is the bulge times half the chord). */
export function segmentMidpoint({ from, to, bulge }: PolylineSegment): Point {
    return {
        x: (from.x + to.x) / 2 + ((to.y - from.y) * bulge) / 2,
        y: (from.y + to.y) / 2 - ((to.x - from.x) * bulge) / 2,
    };
}

/** The direction (radians from +X) a segment arrives at its end in: along its chord, turned by half its angle. */
export function segmentEndDirection({ from, to, bulge }: PolylineSegment): number {
    return Math.atan2(to.y - from.y, to.x - from.x) + bulgeSweep(bulge) / 2;
}

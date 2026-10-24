import type { Point } from '../model/Point';
import type { SegmentSpec } from '../renderer/PathSpec';

const TAU = 2 * Math.PI;

export interface ArcSweep {
    radius: number;
    startAngle: number;
    /** Signed: negative for clockwise. */
    sweep: number;
}

/**
 * Radius and angles of a circular arc. The radius is the distance from `center` to `start`;
 * `end` only sets the end angle, so the arc ends on the ray from the centre through `end`.
 * Start and end at the same angle give a full circle.
 */
export function arcSweep(center: Point, start: Point, end: Point, clockwise: boolean): ArcSweep {
    const radius = Math.hypot(start.x - center.x, start.y - center.y);
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

    let sweep = (((clockwise ? startAngle - endAngle : endAngle - startAngle) % TAU) + TAU) % TAU;
    if (sweep < 1e-9) {
        sweep = TAU;
    }
    return { radius, startAngle, sweep: clockwise ? -sweep : sweep };
}

/** Whether `angle` lies on the arc from `startAngle` over the signed `sweep` (ends included). */
export function angleOnArc(angle: number, startAngle: number, sweep: number): boolean {
    if (Math.abs(sweep) >= TAU - 1e-9) {
        return true;
    }
    const offset = sweep >= 0 ? angle - startAngle : startAngle - angle;
    const normalized = ((offset % TAU) + TAU) % TAU;
    // Just below a full turn is just before the start
    return normalized <= Math.abs(sweep) + 1e-9 || normalized >= TAU - 1e-9;
}

/** Cubic Bézier segments of a circular arc (see `arcSweep`), at most 90° each. */
export function arcSegments(center: Point, start: Point, end: Point, clockwise: boolean): SegmentSpec[] {
    const { radius, startAngle, sweep } = arcSweep(center, start, end, clockwise);
    const count = Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9);
    const step = sweep / count;
    // Signed handle length, so handles point along the direction of travel
    const k = (4 / 3) * Math.tan(step / 4) * radius;

    const segments: SegmentSpec[] = [];
    for (let i = 0; i <= count; i++) {
        const angle = startAngle + i * step;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tangent = { x: -sin * k, y: cos * k };
        segments.push({
            point: { x: center.x + radius * cos, y: center.y + radius * sin },
            handleIn: i > 0 ? { x: -tangent.x, y: -tangent.y } : undefined,
            handleOut: i < count ? tangent : undefined,
        });
    }
    return segments;
}

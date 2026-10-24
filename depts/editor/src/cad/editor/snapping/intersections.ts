import { angleOnArc } from '../../geometry/arc';
import {
    circleIntersections,
    refineIntersection,
    segmentCircleIntersections,
    segmentIntersectionParams,
    segmentIntersections,
} from '../../geometry/intersect';
import { polylineTouchesRect } from '../../geometry/selectionGeometry';
import type { Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import { SAMPLE_TOLERANCE_MM, type SnapPrimitive, type SnapShape } from './SnapGeometry';

type Arc = Extract<SnapPrimitive, { kind: 'arc' }>;

/**
 * Intersections of two snap shapes, at least those inside `box` (model space). Segments and
 * circular arcs are intersected exactly. Pairs with an ellipse or a Bézier are found on the
 * sampled polylines near `box` and refined with Newton's method on the exact curves; where
 * the curves only touch, the sampled crossing is kept as it is.
 */
export function shapeIntersections(p: SnapShape, q: SnapShape, box: Rect): Point[] {
    const a = p.primitive;
    const b = q.primitive;
    if (a.kind === 'segment' && b.kind === 'segment') {
        return segmentIntersections(a.a, a.b, b.a, b.b);
    }
    if (a.kind === 'segment' && b.kind === 'arc') {
        return segmentArc(a.a, a.b, b);
    }
    if (a.kind === 'arc' && b.kind === 'segment') {
        return segmentArc(b.a, b.b, a);
    }
    if (a.kind === 'arc' && b.kind === 'arc') {
        return circleIntersections(a.center, a.radius, b.center, b.radius).filter((point) => onArc(point, a) && onArc(point, b));
    }
    return sampledIntersections(p, q, box);
}

function segmentArc(from: Point, to: Point, arc: Arc): Point[] {
    return segmentCircleIntersections(from, to, arc.center, arc.radius).filter((point) => onArc(point, arc));
}

function onArc(point: Point, arc: Arc): boolean {
    return angleOnArc(Math.atan2(point.y - arc.center.y, point.x - arc.center.x), arc.startAngle, arc.sweep);
}

function sampledIntersections(p: SnapShape, q: SnapShape, box: Rect): Point[] {
    // The polylines deviate from the curves by up to the tolerance, so look a little wider
    const margin = 2 * SAMPLE_TOLERANCE_MM;
    const near = { x: box.x - margin, y: box.y - margin, width: box.width + 2 * margin, height: box.height + 2 * margin };
    const found: Point[] = [];
    for (const i of piecesTouching(p, near)) {
        for (const j of piecesTouching(q, near)) {
            const hit = segmentIntersectionParams(p.points[i], p.points[i + 1], q.points[j], q.points[j + 1]);
            if (!hit) {
                continue;
            }
            const t = p.params[i] + hit.t * (p.params[i + 1] - p.params[i]);
            const s = q.params[j] + hit.u * (q.params[j + 1] - q.params[j]);
            const refined = refineIntersection(p.curve, q.curve, t, s);
            found.push(refined ? p.curve.point(refined.t) : p.curve.point(t));
        }
    }
    return found;
}

/** Indices of the polyline pieces of a shape that touch `rect`. */
function piecesTouching(shape: SnapShape, rect: Rect): number[] {
    const indices: number[] = [];
    for (let i = 0; i < shape.points.length - 1; i++) {
        if (polylineTouchesRect([shape.points[i], shape.points[i + 1]], rect)) {
            indices.push(i);
        }
    }
    return indices;
}

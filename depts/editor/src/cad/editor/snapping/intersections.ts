import RBush from 'rbush';
import { angleOnArc } from '../../geometry/arc';
import {
    circleIntersections,
    refineIntersection,
    segmentCircleIntersections,
    segmentIntersectionParams,
    segmentIntersections,
} from '../../geometry/intersect';
import { polylineTouchesRect, rectFromCorners } from '../../geometry/selectionGeometry';
import type { Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import { SAMPLE_TOLERANCE_MM, type SnapPrimitive, type SnapShape } from './SnapGeometry';

type Arc = Extract<SnapPrimitive, { kind: 'arc' }>;
/** Shapes with at most this many polyline pieces are scanned piece by piece, larger ones get an R-tree. */
const SCAN_PIECES = 32;

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
        const a = p.points[i];
        const b = p.points[i + 1];
        // Only the pieces of q around this piece of p can cross it
        const around = rectFromCorners(a, b);
        for (const j of piecesTouching(q, near, around)) {
            const hit = segmentIntersectionParams(a, b, q.points[j], q.points[j + 1]);
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

interface Piece {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    index: number;
}

/** R-trees over the polyline pieces of the larger shapes, built on first use. */
const pieceTrees = new WeakMap<SnapShape, RBush<Piece>>();

function pieceTree(shape: SnapShape): RBush<Piece> {
    let tree = pieceTrees.get(shape);
    if (!tree) {
        const pieces: Piece[] = [];
        for (let i = 0; i < shape.points.length - 1; i++) {
            const a = shape.points[i];
            const b = shape.points[i + 1];
            pieces.push({
                minX: Math.min(a.x, b.x),
                minY: Math.min(a.y, b.y),
                maxX: Math.max(a.x, b.x),
                maxY: Math.max(a.y, b.y),
                index: i,
            });
        }
        tree = new RBush<Piece>().load(pieces);
        pieceTrees.set(shape, tree);
    }
    return tree;
}

/**
 * Indices of the polyline pieces of a shape that touch `rect`, in order; with `around`, only
 * those whose bounds also touch that rectangle.
 */
function piecesTouching(shape: SnapShape, rect: Rect, around?: Rect): number[] {
    const touches = (i: number) => polylineTouchesRect([shape.points[i], shape.points[i + 1]], rect);
    const count = shape.points.length - 1;
    if (count <= SCAN_PIECES) {
        const indices: number[] = [];
        for (let i = 0; i < count; i++) {
            if (touches(i)) {
                indices.push(i);
            }
        }
        return indices;
    }
    const area = around ? overlap(rect, around) : rect;
    if (area === null) {
        return [];
    }
    return pieceTree(shape)
        .search({ minX: area.x, minY: area.y, maxX: area.x + area.width, maxY: area.y + area.height })
        .map((piece) => piece.index)
        .filter(touches)
        .sort((a, b) => a - b);
}

/** The area two rectangles share (edges included), or null. */
function overlap(a: Rect, b: Rect): Rect | null {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const width = Math.min(a.x + a.width, b.x + b.width) - x;
    const height = Math.min(a.y + a.height, b.y + b.height) - y;
    return width >= 0 && height >= 0 ? { x, y, width, height } : null;
}

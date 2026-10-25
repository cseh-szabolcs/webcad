import { angleOnArc, arcSweep } from '../../geometry/arc';
import { bezierDerivative, bezierMidpoint, bezierPoint, type CubicBezier } from '../../geometry/bezier';
import { ellipsePoint, ellipseQuadrants, ellipseTangent, type EllipseShape } from '../../geometry/ellipse';
import type { ParametricCurve } from '../../geometry/intersect';
import { polygonCentroid } from '../../geometry/polygon';
import { boundsOf } from '../../geometry/selectionGeometry';
import type { CadDocument } from '../../model/CadDocument';
import type { CadElement } from '../../model/CadElement';
import { indexDocument, requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import { elementsInDrawOrder } from '../../model/drawOrder';
import type { Id, Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import type { SnapMode } from './SnapMode';

const TAU = 2 * Math.PI;
/** Maximum deviation of the sampled polyline from the exact curve, in mm. */
export const SAMPLE_TOLERANCE_MM = 0.1;
/** Upper bound for the pieces of one primitive, so a huge curve cannot explode. */
const MAX_PIECES = 1024;

/** Exact geometry an element snaps on; a polyline gives one segment per edge. */
export type SnapPrimitive =
    | { kind: 'segment'; a: Point; b: Point }
    /** Circle (sweep 2π) or circular arc; the sweep is signed, negative for clockwise. */
    | { kind: 'arc'; center: Point; radius: number; startAngle: number; sweep: number }
    /** Ellipse, its `radiusX` axis at `rotation`. */
    | ({ kind: 'ellipse' } & EllipseShape)
    | { kind: 'bezier'; curve: CubicBezier };

/** Snap point that does not depend on other elements. */
export interface SnapPoint {
    point: Point;
    mode: SnapMode;
}

/** One snap primitive of an element with what the snap search needs. Derived, never persisted. */
export interface SnapShape {
    elementId: Id;
    /** Drawing order of the element; higher is drawn on top. */
    order: number;
    primitive: SnapPrimitive;
    /** The primitive over t ∈ [0, 1], for numeric intersections. */
    curve: ParametricCurve;
    /** Polyline within SAMPLE_TOLERANCE_MM of the primitive, and the parameter t of each point. */
    points: Point[];
    params: number[];
    /** Bounding box of `points`, slightly larger than the curve's at most. */
    bounds: Rect;
    /** Endpoints, midpoint, centre and quadrants; intersections are found per query. */
    snapPoints: SnapPoint[];
}

/**
 * Snap point of a whole element rather than of one of its primitives: the geometric centre
 * of a closed polyline, which no single edge knows. Derived, never persisted.
 */
export interface ElementSnapPoint extends SnapPoint {
    elementId: Id;
    /** Drawing order of the element, as in SnapShape. */
    order: number;
    /** The point as an empty rectangle, for the ShapeIndex. */
    bounds: Rect;
}

/**
 * Snap primitives of all elements on visible layers, in drawing order. Unlike selection,
 * elements on locked layers are included: AutoCAD snaps to them, it only does not select
 * them.
 */
export function buildSnapShapes(doc: CadDocument): SnapShape[] {
    const index = indexDocument(doc);
    return elementsInDrawOrder(doc, (layer) => layer.visible).flatMap((element, order) =>
        elementPrimitives(element, index).map((primitive) => snapShape(element.id, order, primitive)),
    );
}

/** Element snap points of all elements on visible layers, like buildSnapShapes. */
export function buildElementSnapPoints(doc: CadDocument): ElementSnapPoint[] {
    const index = indexDocument(doc);
    return elementsInDrawOrder(doc, (layer) => layer.visible).flatMap((element, order) =>
        elementSnapPoints(element, index).map(({ point, mode }) => ({
            elementId: element.id,
            order,
            point,
            mode,
            bounds: { x: point.x, y: point.y, width: 0, height: 0 },
        })),
    );
}

/**
 * Geometric centre (GCE) of a closed polyline with at least three vertices: the centroid of
 * its area, or the centre of its bounds where it has none. Other elements have none.
 */
export function elementSnapPoints(element: CadElement, index: DocumentIndex): SnapPoint[] {
    if (element.type !== 'polyline' || !element.closed || element.vertexIds.length < 3) {
        return [];
    }
    const points = element.vertexIds.map((id) => {
        const { x, y } = requireVertex(index, id);
        return { x, y };
    });
    return [{ point: polygonCentroid(points), mode: 'GCE' }];
}

export function elementPrimitives(element: CadElement, index: DocumentIndex): SnapPrimitive[] {
    const vertex = (id: Id): Point => {
        const { x, y } = requireVertex(index, id);
        return { x, y };
    };
    switch (element.type) {
        case 'line':
            return [{ kind: 'segment', a: vertex(element.startVertexId), b: vertex(element.endVertexId) }];
        case 'polyline': {
            const points = element.vertexIds.map(vertex);
            const count = element.closed && points.length > 2 ? points.length : points.length - 1;
            const segments: SnapPrimitive[] = [];
            for (let i = 0; i < count; i++) {
                segments.push({ kind: 'segment', a: points[i], b: points[(i + 1) % points.length] });
            }
            return segments;
        }
        case 'circle':
            return [{ kind: 'arc', center: vertex(element.centerVertexId), radius: element.radius, startAngle: 0, sweep: TAU }];
        case 'ellipse':
            return [
                {
                    kind: 'ellipse',
                    center: vertex(element.centerVertexId),
                    radiusX: element.radiusX,
                    radiusY: element.radiusY,
                    rotation: element.rotation ?? 0,
                },
            ];
        case 'arc': {
            const center = vertex(element.centerVertexId);
            const sweep = arcSweep(center, vertex(element.startVertexId), vertex(element.endVertexId), element.clockwise);
            return [{ kind: 'arc', center, ...sweep }];
        }
        case 'bezier': {
            const p0 = vertex(element.startVertexId);
            const p3 = vertex(element.endVertexId);
            const p1 = { x: p0.x + element.startControl.x, y: p0.y + element.startControl.y };
            const p2 = { x: p3.x + element.endControl.x, y: p3.y + element.endControl.y };
            return [{ kind: 'bezier', curve: { p0, p1, p2, p3 } }];
        }
    }
}

function snapShape(elementId: Id, order: number, primitive: SnapPrimitive): SnapShape {
    const curve = parametricCurve(primitive);
    const pieces = pieceCount(primitive);
    const params = Array.from({ length: pieces + 1 }, (_, i) => i / pieces);
    const points = params.map((t) => curve.point(t));
    return { elementId, order, primitive, curve, points, params, bounds: boundsOf(points), snapPoints: snapPoints(primitive) };
}

/** Whether the arc is a whole circle. */
export function isFullCircle(primitive: { sweep: number }): boolean {
    return Math.abs(primitive.sweep) >= TAU - 1e-9;
}

function snapPoints(primitive: SnapPrimitive): SnapPoint[] {
    switch (primitive.kind) {
        case 'segment': {
            const { a, b } = primitive;
            return [
                { point: a, mode: 'END' },
                { point: b, mode: 'END' },
                { point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, mode: 'MID' },
            ];
        }
        case 'arc': {
            const { center, radius, startAngle, sweep } = primitive;
            const onArc = (angle: number) => ({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
            const points: SnapPoint[] = [{ point: center, mode: 'CEN' }];
            if (!isFullCircle(primitive)) {
                points.push(
                    { point: onArc(startAngle), mode: 'END' },
                    { point: onArc(startAngle + sweep), mode: 'END' },
                    { point: onArc(startAngle + sweep / 2), mode: 'MID' },
                );
            }
            // Only the quadrant points that lie on the arc
            for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
                if (angleOnArc(angle, startAngle, sweep)) {
                    points.push({ point: onArc(angle), mode: 'QUA' });
                }
            }
            return points;
        }
        case 'ellipse':
            return [
                { point: primitive.center, mode: 'CEN' },
                ...ellipseQuadrants(primitive).map((point): SnapPoint => ({ point, mode: 'QUA' })),
            ];
        case 'bezier':
            return [
                { point: primitive.curve.p0, mode: 'END' },
                { point: primitive.curve.p3, mode: 'END' },
                { point: bezierMidpoint(primitive.curve), mode: 'MID' },
            ];
    }
}

function parametricCurve(primitive: SnapPrimitive): ParametricCurve {
    switch (primitive.kind) {
        case 'segment': {
            const { a, b } = primitive;
            const d = { x: b.x - a.x, y: b.y - a.y };
            return { point: (t) => ({ x: a.x + t * d.x, y: a.y + t * d.y }), derivative: () => d };
        }
        case 'arc': {
            const { center, radius, startAngle, sweep } = primitive;
            return {
                point: (t) => {
                    const angle = startAngle + t * sweep;
                    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
                },
                derivative: (t) => {
                    const angle = startAngle + t * sweep;
                    return { x: -sweep * radius * Math.sin(angle), y: sweep * radius * Math.cos(angle) };
                },
            };
        }
        case 'ellipse':
            return {
                point: (t) => ellipsePoint(primitive, TAU * t),
                derivative: (t) => {
                    const { x, y } = ellipseTangent(primitive, TAU * t);
                    return { x: TAU * x, y: TAU * y };
                },
            };
        case 'bezier': {
            const { curve } = primitive;
            return { point: (t) => bezierPoint(curve, t), derivative: (t) => bezierDerivative(curve, t) };
        }
    }
}

/** Pieces of equal parameter step that keep the polyline within SAMPLE_TOLERANCE_MM. */
function pieceCount(primitive: SnapPrimitive): number {
    let pieces: number;
    switch (primitive.kind) {
        case 'segment':
            return 1;
        case 'arc':
            pieces = Math.abs(primitive.sweep) / arcStep(primitive.radius);
            break;
        case 'ellipse':
            pieces = TAU / arcStep(Math.max(primitive.radiusX, primitive.radiusY));
            break;
        case 'bezier': {
            // Linear interpolation over a step h deviates by at most M·h²/8 (see flattenCubic)
            const { p0, p1, p2, p3 } = primitive.curve;
            const dd1 = Math.hypot(p0.x - 2 * p1.x + p2.x, p0.y - 2 * p1.y + p2.y);
            const dd2 = Math.hypot(p1.x - 2 * p2.x + p3.x, p1.y - 2 * p2.y + p3.y);
            pieces = Math.sqrt((6 * Math.max(dd1, dd2)) / (8 * SAMPLE_TOLERANCE_MM));
            break;
        }
    }
    return Math.min(Math.max(Math.ceil(pieces), 1), MAX_PIECES);
}

/** Angle step whose chord stays within SAMPLE_TOLERANCE_MM of a circle of `radius`. */
function arcStep(radius: number): number {
    return radius <= SAMPLE_TOLERANCE_MM ? Math.PI / 2 : 2 * Math.acos(1 - SAMPLE_TOLERANCE_MM / radius);
}

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
import { flattenPathSpec } from '../../geometry/flatten';
import { bulgeArc, polylineSegments } from '../../geometry/polyline';
import { polylinePathSpec } from '../../renderer/PathSpec';

/** How closely (mm) the outline of a polyline with arcs is followed for its geometric centre. */
const GCE_FLATTEN_TOLERANCE_MM = 0.1;

const TAU = 2 * Math.PI;
/** Maximum deviation of the sampled polyline from the exact curve, in mm. */
export const SAMPLE_TOLERANCE_MM = 0.1;
/** Upper bound for the pieces of one primitive, so a huge curve cannot explode. */
const MAX_PIECES = 1024;
const QUADRANT_ANGLES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
/** How much wider an ellipse's computed bounds are than the ellipse (mm). */
const BOUNDS_MARGIN_MM = 1e-9;

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

/**
 * One snap primitive of an element with what the snap search needs. Derived, never persisted.
 * `points`, `params` and `snapPoints` are worked out on first use, so only the shapes the
 * cursor comes near pay for them.
 */
export interface SnapShape {
    readonly elementId: Id;
    /** Drawing order of the element; higher is drawn on top. */
    readonly order: number;
    readonly primitive: SnapPrimitive;
    /** The primitive over t ∈ [0, 1], for numeric intersections. */
    readonly curve: ParametricCurve;
    /** Polyline within SAMPLE_TOLERANCE_MM of the primitive, and the parameter t of each point. */
    readonly points: Point[];
    readonly params: number[];
    /** Bounding box of the primitive (of its control points for a Bézier); contains `points`. */
    readonly bounds: Rect;
    /** Endpoints, midpoint, centre and quadrants; intersections are found per query. */
    readonly snapPoints: SnapPoint[];
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
    // With arcs the area is that of the outline, taken along the arcs closely enough
    const outline = element.bulges.some((bulge) => bulge !== 0)
        ? flattenPathSpec(polylinePathSpec(points, element.bulges, true), GCE_FLATTEN_TOLERANCE_MM).slice(0, -1)
        : points;
    return [{ point: polygonCentroid(outline), mode: 'GCE' }];
}

export function elementPrimitives(element: CadElement, index: DocumentIndex): SnapPrimitive[] {
    const vertex = (id: Id): Point => {
        const { x, y } = requireVertex(index, id);
        return { x, y };
    };
    switch (element.type) {
        case 'line':
            return [{ kind: 'segment', a: vertex(element.startVertexId), b: vertex(element.endVertexId) }];
        case 'polyline':
            // A segment with a bulge snaps like an arc
            return polylineSegments(element.vertexIds.map(vertex), element.bulges, element.closed).map((segment): SnapPrimitive => {
                const arc = bulgeArc(segment);
                return arc
                    ? { kind: 'arc', center: arc.center, radius: arc.radius, startAngle: arc.startAngle, sweep: arc.sweep }
                    : { kind: 'segment', a: segment.from, b: segment.to };
            });
        case 'circle':
            return [{ kind: 'arc', center: vertex(element.centerVertexId), radius: element.radius, startAngle: 0, sweep: TAU }];
        case 'ellipse':
            return [
                {
                    kind: 'ellipse',
                    center: vertex(element.centerVertexId),
                    radiusX: element.radiusX,
                    radiusY: element.radiusY,
                    rotation: element.rotation,
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
    return new LazySnapShape(elementId, order, primitive);
}

class LazySnapShape implements SnapShape {
    readonly elementId: Id;
    readonly order: number;
    readonly primitive: SnapPrimitive;
    readonly curve: ParametricCurve;
    readonly bounds: Rect;
    private sampled: { points: Point[]; params: number[] } | null = null;
    private fixedPoints: SnapPoint[] | null = null;

    constructor(elementId: Id, order: number, primitive: SnapPrimitive) {
        this.elementId = elementId;
        this.order = order;
        this.primitive = primitive;
        this.curve = parametricCurve(primitive);
        this.bounds = primitiveBounds(primitive);
    }

    get points(): Point[] {
        return this.sample().points;
    }

    get params(): number[] {
        return this.sample().params;
    }

    get snapPoints(): SnapPoint[] {
        return (this.fixedPoints ??= snapPoints(this.primitive));
    }

    private sample(): { points: Point[]; params: number[] } {
        if (this.sampled === null) {
            const pieces = pieceCount(this.primitive);
            const params = Array.from({ length: pieces + 1 }, (_, i) => i / pieces);
            this.sampled = { points: params.map((t) => this.curve.point(t)), params };
        }
        return this.sampled;
    }
}

/** Bounding box of a primitive without sampling it; for a Bézier that of its control points. */
function primitiveBounds(primitive: SnapPrimitive): Rect {
    switch (primitive.kind) {
        case 'segment':
            return boundsOf([primitive.a, primitive.b]);
        case 'arc': {
            const { center, radius, startAngle, sweep } = primitive;
            const onArc = (angle: number) => ({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
            // The ends and the quadrant points on the arc are its extremes
            const extremes = [onArc(startAngle), onArc(startAngle + sweep)];
            for (const angle of QUADRANT_ANGLES) {
                if (angleOnArc(angle, startAngle, sweep)) {
                    extremes.push(onArc(angle));
                }
            }
            return boundsOf(extremes);
        }
        case 'ellipse': {
            const { center, radiusX, radiusY, rotation } = primitive;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            // A hair wider, so rounding never leaves a sampled point outside
            const halfWidth = Math.hypot(radiusX * cos, radiusY * sin) + BOUNDS_MARGIN_MM;
            const halfHeight = Math.hypot(radiusX * sin, radiusY * cos) + BOUNDS_MARGIN_MM;
            return { x: center.x - halfWidth, y: center.y - halfHeight, width: 2 * halfWidth, height: 2 * halfHeight };
        }
        case 'bezier': {
            const { p0, p1, p2, p3 } = primitive.curve;
            return boundsOf([p0, p1, p2, p3]);
        }
    }
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
            for (const angle of QUADRANT_ANGLES) {
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

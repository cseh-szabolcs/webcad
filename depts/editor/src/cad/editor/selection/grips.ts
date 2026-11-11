import { arcSweep } from '../../geometry/arc';
import { ellipseQuadrants } from '../../geometry/ellipse';
import type { CadElement } from '../../model/CadElement';
import { requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point } from '../../model/Point';

/** What of its element a grip changes when it is stretched (see grips/stretch). */
export type GripPart =
    /** A line or bezier end or a polyline vertex: moves this vertex. */
    | { kind: 'vertex'; vertexId: Id }
    /** A line's midpoint or the centre of a circle, ellipse or arc: moves the whole element. */
    | { kind: 'move' }
    /** Midpoint of the polyline segment from vertex `index` to the next: moves its two vertices. */
    | { kind: 'segment'; index: number }
    /** A circle's quadrant: changes the radius. */
    | { kind: 'radius' }
    /** An ellipse's axis end: changes `radiusX` (`x`) or `radiusY` (`y`). */
    | { kind: 'axis'; axis: 'x' | 'y' }
    /** An arc's start or end: the arc through the other end, its old middle and the new point. */
    | { kind: 'arcEnd'; end: 'start' | 'end' }
    /** An arc's middle: the arc through both ends and the new point. */
    | { kind: 'arcMid' }
    /** A bezier's control point at its start or end. */
    | { kind: 'control'; end: 'start' | 'end' };

export interface GripTarget {
    elementId: Id;
    part: GripPart;
}

/**
 * A grip of the pickfirst selection, like AutoCAD's: a square, or a bar along the segment
 * (`angle`, radians) at a polyline's segment midpoint. Selected elements with a grip at the
 * same position share it, so it has a target for each of them.
 */
export interface Grip {
    point: Point;
    shape: 'square' | 'bar';
    angle?: number;
    targets: readonly GripTarget[];
}

/**
 * Grips of an element, like AutoCAD shows them for a pickfirst selection:
 * line ends and midpoint, polyline vertices and segment midpoints, centre and quadrants of
 * circles and ellipses, centre, ends and midpoint of arcs, bezier ends and control points.
 */
export function elementGrips(element: CadElement, index: DocumentIndex): Grip[] {
    const vertex = (id: string): Point => {
        const { x, y } = requireVertex(index, id);
        return { x, y };
    };
    const grip = (point: Point, part: GripPart): Grip => ({
        point,
        shape: 'square',
        targets: [{ elementId: element.id, part }],
    });
    const atVertex = (vertexId: Id): Grip => grip(vertex(vertexId), { kind: 'vertex', vertexId });
    switch (element.type) {
        case 'line': {
            const start = atVertex(element.startVertexId);
            const end = atVertex(element.endVertexId);
            return [start, end, grip(midpoint(start.point, end.point), { kind: 'move' })];
        }
        case 'polyline': {
            const corners = element.vertexIds.map(atVertex);
            const count = element.closed ? corners.length : corners.length - 1;
            const midpoints: Grip[] = [];
            for (let i = 0; i < count; i++) {
                const from = corners[i].point;
                const to = corners[(i + 1) % corners.length].point;
                midpoints.push({
                    ...grip(midpoint(from, to), { kind: 'segment', index: i }),
                    shape: 'bar',
                    angle: Math.atan2(to.y - from.y, to.x - from.x),
                });
            }
            return [...corners, ...midpoints];
        }
        case 'circle': {
            const center = vertex(element.centerVertexId);
            const quadrants = ellipseQuadrants({ center, radiusX: element.radius, radiusY: element.radius, rotation: 0 });
            return [grip(center, { kind: 'move' }), ...quadrants.map((point) => grip(point, { kind: 'radius' }))];
        }
        case 'ellipse': {
            const center = vertex(element.centerVertexId);
            const { radiusX, radiusY, rotation } = element;
            // Counter-clockwise from the end of the `radiusX` axis
            const quadrants = ellipseQuadrants({ center, radiusX, radiusY, rotation });
            return [
                grip(center, { kind: 'move' }),
                ...quadrants.map((point, i) => grip(point, { kind: 'axis', axis: i % 2 === 0 ? 'x' : 'y' })),
            ];
        }
        case 'arc': {
            const center = vertex(element.centerVertexId);
            const { radius, startAngle, sweep } = arcSweep(
                center,
                vertex(element.startVertexId),
                vertex(element.endVertexId),
                element.clockwise,
            );
            // The end vertex only sets the end angle, so the end grip sits on the arc instead
            const onArc = (angle: number) => ({
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
            });
            return [
                grip(center, { kind: 'move' }),
                grip(onArc(startAngle), { kind: 'arcEnd', end: 'start' }),
                grip(onArc(startAngle + sweep), { kind: 'arcEnd', end: 'end' }),
                grip(onArc(startAngle + sweep / 2), { kind: 'arcMid' }),
            ];
        }
        case 'bezier': {
            const start = atVertex(element.startVertexId);
            const end = atVertex(element.endVertexId);
            const { startControl, endControl } = element;
            return [
                start,
                end,
                grip({ x: start.point.x + startControl.x, y: start.point.y + startControl.y }, { kind: 'control', end: 'start' }),
                grip({ x: end.point.x + endControl.x, y: end.point.y + endControl.y }, { kind: 'control', end: 'end' }),
            ];
        }
    }
}

/** Grips of several elements; a position shared by several of them gets a single grip with all their targets. */
export function selectionGrips(elements: Iterable<CadElement>, index: DocumentIndex): Grip[] {
    const grips = new Map<string, Grip>();
    for (const element of elements) {
        for (const grip of elementGrips(element, index)) {
            const key = `${grip.point.x.toFixed(6)},${grip.point.y.toFixed(6)}`;
            const shared = grips.get(key);
            if (!shared) {
                grips.set(key, grip);
                continue;
            }
            // A vertex gives the exact point; computed ones (an arc's end) may be off by rounding
            const exact = shared.targets[0].part.kind !== 'vertex' && grip.targets[0].part.kind === 'vertex';
            grips.set(key, { ...shared, point: exact ? grip.point : shared.point, targets: [...shared.targets, ...grip.targets] });
        }
    }
    return [...grips.values()];
}

/**
 * The grip whose box the pick box touches: at most `tolerance` from `point` along both axes
 * (half the grip side plus half the pick box side, in model units); the nearest of several.
 */
export function gripAt(grips: readonly Grip[], point: Point, tolerance: number): Grip | null {
    let best: Grip | null = null;
    let bestDistance = Infinity;
    for (const grip of grips) {
        const dx = Math.abs(grip.point.x - point.x);
        const dy = Math.abs(grip.point.y - point.y);
        if (dx > tolerance || dy > tolerance) {
            continue;
        }
        const distance = Math.hypot(dx, dy);
        if (distance < bestDistance) {
            best = grip;
            bestDistance = distance;
        }
    }
    return best;
}

/**
 * Control frame of the selected elements, drawn with their grips so the grips off a curve
 * make sense: for each bezier one line from each end to its control point. Other element
 * types have no control points and no frame.
 */
export function selectionControlFrames(elements: Iterable<CadElement>, index: DocumentIndex): [Point, Point][] {
    const frames: [Point, Point][] = [];
    for (const element of elements) {
        if (element.type !== 'bezier') {
            continue;
        }
        const [start, end, startControl, endControl] = elementGrips(element, index).map((grip) => grip.point);
        frames.push([start, startControl], [end, endControl]);
    }
    return frames;
}

function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

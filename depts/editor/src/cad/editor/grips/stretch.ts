import { arcSweep, arcThrough } from '../../geometry/arc';
import { bulgeThrough } from '../../geometry/polyline';
import { vertexRefs, type ArcElement, type CadElement } from '../../model/CadElement';
import { requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point, Vector2 } from '../../model/Point';
import type { ElementEdit } from '../commands/elementEdits';
import type { Grip, GripPart } from '../selection/grips';

/** A part of an element that goes with its grip, and where the grip goes. */
interface HotPart {
    part: GripPart;
    to: Point;
}

/**
 * Stretches the grips by `delta` (AutoCAD's grip mode STRETCH): each target changes its element
 * as its part says (see GripPart); several hot grips go together, so what lies between them
 * keeps its shape. An element whose `move` grip is hot goes as a whole, whatever else of it is
 * hot. Null if a target cannot go there: a radius of zero, or an arc whose three points lie on
 * one line.
 */
export function stretchTargets(index: DocumentIndex, grips: readonly Grip[], delta: Vector2): ElementEdit[] | null {
    const hot = new Map<Id, HotPart[]>();
    for (const grip of grips) {
        const to = { x: grip.point.x + delta.x, y: grip.point.y + delta.y };
        for (const { elementId, part } of grip.targets) {
            hot.set(elementId, [...(hot.get(elementId) ?? []), { part, to }]);
        }
    }
    const edits: ElementEdit[] = [];
    for (const [elementId, parts] of hot) {
        const original = index.elements.get(elementId);
        if (!original) {
            continue;
        }
        const vertices = new Map<Id, Point>();
        const position = (id: Id): Point => vertices.get(id) ?? pointOf(index, id);
        // From the original position, so a vertex two parts move goes once
        const shift = (id: Id) => {
            const { x, y } = pointOf(index, id);
            vertices.set(id, { x: x + delta.x, y: y + delta.y });
        };
        const place = (id: Id, point: Point) => vertices.set(id, point);
        let element: CadElement | null = original;
        if (parts.some(({ part }) => part.kind === 'move')) {
            vertexRefs(original).forEach(shift);
        } else if (original.type === 'arc') {
            element = stretchArc(original, parts, position, place);
        } else {
            for (const { part, to } of parts) {
                element = element && stretchPart(element, part, to, position, shift);
            }
        }
        if (element === null) {
            return null;
        }
        edits.push({ element, vertices });
    }
    return edits;
}

/**
 * The arc through its start, middle and end, each where its hot grip goes or where it was: one
 * end alone leaves the other end and the old middle, all three move the arc.
 */
function stretchArc(
    arc: ArcElement,
    parts: readonly HotPart[],
    position: (id: Id) => Point,
    place: (id: Id, point: Point) => void,
): CadElement | null {
    const { start, mid, end } = arcPoints(arc, position);
    const through: [Point, Point, Point] = [start, mid, end];
    for (const { part, to } of parts) {
        if (part.kind === 'arcMid') {
            through[1] = to;
        } else if (part.kind === 'arcEnd') {
            through[part.end === 'start' ? 0 : 2] = to;
        }
    }
    const next = arcThrough(...through);
    if (next === null) {
        return null;
    }
    place(arc.centerVertexId, next.center);
    place(arc.startVertexId, through[0]);
    place(arc.endVertexId, through[2]);
    return { ...arc, clockwise: next.clockwise };
}

/** The element (no arc) after one of its grips went to `to`; moves its vertices through `shift`. */
function stretchPart(
    element: CadElement,
    part: GripPart,
    to: Point,
    position: (id: Id) => Point,
    shift: (id: Id) => void,
): CadElement | null {
    switch (part.kind) {
        case 'vertex':
            shift(part.vertexId);
            return element;
        case 'move':
            vertexRefs(element).forEach(shift);
            return element;
        case 'segment': {
            if (element.type !== 'polyline') {
                return element;
            }
            const ids = element.vertexIds;
            const from = ids[part.index];
            const next = ids[(part.index + 1) % ids.length];
            if ((element.bulges[part.index] ?? 0) === 0) {
                shift(from);
                shift(next);
                return element;
            }
            // An arc keeps its ends and goes through the point; on their line it is straight
            const bulge = bulgeThrough(position(from), to, position(next)) ?? 0;
            return { ...element, bulges: element.bulges.with(part.index, bulge) };
        }
        case 'radius': {
            if (element.type !== 'circle') {
                return element;
            }
            const radius = distance(position(element.centerVertexId), to);
            return radius > 0 ? { ...element, radius } : null;
        }
        case 'axis': {
            if (element.type !== 'ellipse') {
                return element;
            }
            const radius = distance(position(element.centerVertexId), to);
            if (radius <= 0) {
                return null;
            }
            return part.axis === 'x' ? { ...element, radiusX: radius } : { ...element, radiusY: radius };
        }
        case 'arcEnd':
        case 'arcMid':
            return element;
        case 'control': {
            if (element.type !== 'bezier') {
                return element;
            }
            const key = part.end === 'start' ? 'startControl' : 'endControl';
            const centre = position(part.end === 'start' ? element.startVertexId : element.endVertexId);
            return { ...element, [key]: { x: to.x - centre.x, y: to.y - centre.y } };
        }
    }
}

/** Start, middle and end of an arc on the arc itself (its end vertex only sets the end angle). */
function arcPoints(arc: ArcElement, position: (id: Id) => Point): { start: Point; mid: Point; end: Point } {
    const center = position(arc.centerVertexId);
    const start = position(arc.startVertexId);
    const { radius, startAngle, sweep } = arcSweep(center, start, position(arc.endVertexId), arc.clockwise);
    const onArc = (angle: number) => ({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    return { start, mid: onArc(startAngle + sweep / 2), end: onArc(startAngle + sweep) };
}

function pointOf(index: DocumentIndex, id: Id): Point {
    const { x, y } = requireVertex(index, id);
    return { x, y };
}

function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

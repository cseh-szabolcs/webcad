import { arcSweep, arcThrough } from '../../geometry/arc';
import { vertexRefs, type ArcElement, type CadElement } from '../../model/CadElement';
import { requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point, Vector2 } from '../../model/Point';
import type { ElementEdit } from '../commands/elementEdits';
import type { Grip, GripPart } from '../selection/grips';

/**
 * Stretches the grips by `delta` (AutoCAD's grip mode STRETCH): each target changes its element
 * as its part says (see GripPart). Null if a target cannot go there: a radius of zero, or an
 * arc whose three points lie on one line.
 */
export function stretchTargets(index: DocumentIndex, grips: readonly Grip[], delta: Vector2): ElementEdit[] | null {
    const edits = new Map<Id, { element: CadElement; vertices: Map<Id, Point> }>();
    for (const grip of grips) {
        const to = { x: grip.point.x + delta.x, y: grip.point.y + delta.y };
        for (const { elementId, part } of grip.targets) {
            const original = index.elements.get(elementId);
            if (!original) {
                continue;
            }
            const edit = edits.get(elementId) ?? { element: original, vertices: new Map<Id, Point>() };
            edits.set(elementId, edit);
            const position = (id: Id): Point => edit.vertices.get(id) ?? pointOf(index, id);
            // From the original position, so a vertex two targets move goes once
            const shift = (id: Id) => {
                const { x, y } = pointOf(index, id);
                edit.vertices.set(id, { x: x + delta.x, y: y + delta.y });
            };
            const element = stretchPart(edit.element, part, to, position, shift, (id, point) => edit.vertices.set(id, point));
            if (element === null) {
                return null;
            }
            edit.element = element;
        }
    }
    return [...edits.values()];
}

/** The element after one of its grips went to `to`; moves its vertices through `shift` and `place`. */
function stretchPart(
    element: CadElement,
    part: GripPart,
    to: Point,
    position: (id: Id) => Point,
    shift: (id: Id) => void,
    place: (id: Id, point: Point) => void,
): CadElement | null {
    switch (part.kind) {
        case 'vertex':
            shift(part.vertexId);
            return element;
        case 'move':
            vertexRefs(element).forEach(shift);
            return element;
        case 'segment':
            if (element.type === 'polyline') {
                const ids = element.vertexIds;
                shift(ids[part.index]);
                shift(ids[(part.index + 1) % ids.length]);
            }
            return element;
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
        case 'arcMid': {
            if (element.type !== 'arc') {
                return element;
            }
            const { start, mid, end } = arcPoints(element, position);
            const through: [Point, Point, Point] =
                part.kind === 'arcMid' ? [start, to, end] : part.end === 'start' ? [to, mid, end] : [start, mid, to];
            const arc = arcThrough(...through);
            if (arc === null) {
                return null;
            }
            place(element.centerVertexId, arc.center);
            place(element.startVertexId, through[0]);
            place(element.endVertexId, through[2]);
            return { ...element, clockwise: arc.clockwise };
        }
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

import { arcSweep } from '../../geometry/arc';
import type { PolylineElement } from '../../model/CadElement';
import { requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point } from '../../model/Point';
import type { ElementEdit } from '../commands/elementEdits';
import type { Grip, GripPart } from '../selection/grips';

/**
 * What a grip can do besides being stretched (AutoCAD's multifunctional grips): `lengthen` moves
 * a line's or arc's end along it, `radius` changes an arc's radius about its centre, `addVertex`
 * and `removeVertex` change a polyline. `removeVertex` needs no point.
 */
export type GripAction = 'stretch' | 'lengthen' | 'radius' | 'addVertex' | 'removeVertex';

/** The actions of a grip, `stretch` first; only a grip of one element has more than that. */
export function gripActions(grip: Grip, index: DocumentIndex): GripAction[] {
    const target = grip.targets.length === 1 ? grip.targets[0] : null;
    const element = target && index.elements.get(target.elementId);
    const kind = target?.part.kind;
    switch (element?.type) {
        case 'line':
            return kind === 'vertex' ? ['stretch', 'lengthen'] : ['stretch'];
        case 'arc':
            return kind === 'arcEnd' ? ['stretch', 'lengthen'] : kind === 'arcMid' ? ['stretch', 'radius'] : ['stretch'];
        case 'polyline':
            if (kind === 'segment') {
                return ['stretch', 'addVertex'];
            }
            if (kind === 'vertex') {
                // What stays must still be a line, closed still an area
                const removable = element.vertexIds.length > (element.closed ? 3 : 2);
                return removable ? ['stretch', 'addVertex', 'removeVertex'] : ['stretch', 'addVertex'];
            }
            return ['stretch'];
        default:
            return ['stretch'];
    }
}

/**
 * `lengthen`: the end of the grip goes to where `to` lies along the element: on a line the foot
 * of `to` on it (beyond the other end there is no line), on an arc the point at the angle of
 * `to` about the centre. Null where that is nowhere.
 */
export function lengthenEdits(index: DocumentIndex, grip: Grip, to: Point): ElementEdit[] | null {
    const { elementId, part } = grip.targets[0];
    const element = index.elements.get(elementId);
    const at = (id: Id): Point => requireVertex(index, id);
    if (element?.type === 'line' && part.kind === 'vertex') {
        const moving = part.vertexId;
        const end = at(moving);
        const other = at(moving === element.startVertexId ? element.endVertexId : element.startVertexId);
        const dx = end.x - other.x;
        const dy = end.y - other.y;
        const along = ((to.x - other.x) * dx + (to.y - other.y) * dy) / (dx * dx + dy * dy);
        if (!(along > 0)) {
            return null;
        }
        return [{ element, vertices: new Map([[moving, { x: other.x + along * dx, y: other.y + along * dy }]]) }];
    }
    if (element?.type === 'arc' && part.kind === 'arcEnd') {
        const center = at(element.centerVertexId);
        const start = at(element.startVertexId);
        const distance = Math.hypot(to.x - center.x, to.y - center.y);
        if (distance === 0) {
            return null;
        }
        const radius = Math.hypot(start.x - center.x, start.y - center.y);
        const point = { x: center.x + ((to.x - center.x) * radius) / distance, y: center.y + ((to.y - center.y) * radius) / distance };
        const moving = part.end === 'start' ? element.startVertexId : element.endVertexId;
        return [{ element, vertices: new Map([[moving, point]]) }];
    }
    return null;
}

/** `radius`: the arc of the grip with this radius; its centre and angles stay. Null if it is not positive. */
export function radiusEdits(index: DocumentIndex, grip: Grip, radius: number): ElementEdit[] | null {
    const element = index.elements.get(grip.targets[0].elementId);
    if (element?.type !== 'arc' || !(radius > 0)) {
        return null;
    }
    const center = requireVertex(index, element.centerVertexId);
    const start = requireVertex(index, element.startVertexId);
    const end = requireVertex(index, element.endVertexId);
    const { startAngle, sweep } = arcSweep(center, start, end, element.clockwise);
    const onArc = (angle: number) => ({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    return [
        {
            element,
            vertices: new Map([
                [element.startVertexId, onArc(startAngle)],
                [element.endVertexId, onArc(startAngle + sweep)],
            ]),
        },
    ];
}

/** The centre of the arc whose radius the grip changes, to measure the radius from. */
export function radiusCenter(index: DocumentIndex, grip: Grip): Point | null {
    const element = index.elements.get(grip.targets[0].elementId);
    if (element?.type !== 'arc') {
        return null;
    }
    const { x, y } = requireVertex(index, element.centerVertexId);
    return { x, y };
}

/**
 * `addVertex`: the polyline of the grip and where in its `vertexIds` the new vertex goes: into
 * the segment of a midpoint grip; after a vertex grip, but before the first vertex of an open
 * polyline, so both its ends can grow.
 */
export function vertexInsertion(index: DocumentIndex, grip: Grip): { polyline: PolylineElement; at: number } | null {
    const found = polylinePart(index, grip);
    if (found === null) {
        return null;
    }
    const { polyline, part } = found;
    if (part.kind === 'segment') {
        return { polyline, at: part.index + 1 };
    }
    const at = part.kind === 'vertex' ? polyline.vertexIds.indexOf(part.vertexId) : -1;
    if (at < 0) {
        return null;
    }
    return { polyline, at: at === 0 && !polyline.closed ? 0 : at + 1 };
}

/** `removeVertex`: the polyline of the grip and the place of its vertex in `vertexIds`. */
export function vertexRemoval(index: DocumentIndex, grip: Grip): { polyline: PolylineElement; at: number } | null {
    const found = polylinePart(index, grip);
    const at = found?.part.kind === 'vertex' ? found.polyline.vertexIds.indexOf(found.part.vertexId) : -1;
    return found && at >= 0 ? { polyline: found.polyline, at } : null;
}

function polylinePart(index: DocumentIndex, grip: Grip): { polyline: PolylineElement; part: GripPart } | null {
    const { elementId, part } = grip.targets[0];
    const element = index.elements.get(elementId);
    return element?.type === 'polyline' ? { polyline: element, part } : null;
}

import { arcSweep } from '../../geometry/arc';
import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';

/**
 * What LINIE, PLINIE and BOGEN remember between runs: the line, polyline or arc drawn last, for
 * "continue" (Enter at the first point).
 */
export interface DrawingMemory {
    lastDrawn: Id | null;
}

/** Relative to the radius, within which an arc's end vertex counts as on the arc. */
const ON_ARC_TOLERANCE = 1e-9;

/** Where "continue" starts, and the direction the element drawn last arrives there in (radians from +X). */
export interface ContinueFrom {
    point: Point;
    direction: number;
    /** Whether it arrives on a curve, which a line then continues tangentially. */
    curved: boolean;
}

/**
 * The end of element `id` where it is now: a line's end, an open polyline's last vertex, a closed
 * one's first (where its closing segment ends), or the end of an arc on the arc itself; null if
 * it is gone or is none of these.
 */
export function continueFrom(doc: CadDocument, id: Id | null): ContinueFrom | null {
    const element = doc.elements.find((candidate) => candidate.id === id);
    const position = (vertexId: Id | undefined): Point | null => {
        const vertex = doc.vertices.find((candidate) => candidate.id === vertexId);
        return vertex ? { x: vertex.x, y: vertex.y } : null;
    };
    /** Arriving at `to` straight from `from`. */
    const straight = (from: Point | null, to: Point | null): ContinueFrom | null =>
        from && to ? { point: to, direction: Math.atan2(to.y - from.y, to.x - from.x), curved: false } : null;

    switch (element?.type) {
        case 'line':
            return straight(position(element.startVertexId), position(element.endVertexId));
        case 'polyline': {
            const ids = element.vertexIds;
            return element.closed ? straight(position(ids.at(-1)), position(ids[0])) : straight(position(ids.at(-2)), position(ids.at(-1)));
        }
        case 'arc': {
            const center = position(element.centerVertexId);
            const start = position(element.startVertexId);
            const end = position(element.endVertexId);
            if (!center || !start || !end) {
                return null;
            }
            // The end vertex only sets the end angle
            const { radius, startAngle, sweep } = arcSweep(center, start, end, element.clockwise);
            const angle = startAngle + sweep;
            const onArc = Math.abs(Math.hypot(end.x - center.x, end.y - center.y) - radius) <= ON_ARC_TOLERANCE * radius;
            return {
                // The end vertex itself where it lies on the arc, so the next element starts exactly there
                point: onArc ? end : { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) },
                // A quarter turn on from the radius, the way the arc runs
                direction: angle + (Math.sign(sweep) * Math.PI) / 2,
                curved: true,
            };
        }
        default:
            return null;
    }
}

/** Where "continue" starts (see `continueFrom`); null if there is nothing to continue. */
export function continuePoint(doc: CadDocument, id: Id | null): Point | null {
    return continueFrom(doc, id)?.point ?? null;
}

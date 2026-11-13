import { arcSweep } from '../../geometry/arc';
import { polylineSegments, segmentEndDirection } from '../../geometry/polyline';
import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';

/**
 * What the drawing commands remember between runs: the line, polyline or arc that LINIE, PLINIE
 * or BOGEN drew last, for "continue" (Enter at the first point); and the values given last that
 * Enter takes again as the default of their prompt, shown as `<25.0000>` (null until given once).
 */
export interface DrawingMemory {
    lastDrawn: Id | null;
    /** KREIS: the radius of the circle drawn last (AutoCAD's CIRCLERAD). */
    circleRadius: number | null;
    /** RECHTECK, option "Abmessungen": the length and the width given last. */
    rectangleLength: number | null;
    rectangleWidth: number | null;
    /**
     * RECHTECK: the modes that stay for the following rectangles, like AutoCAD: the angle of
     * their sides in degrees, and the chamfer distances along the two sides of each corner (0
     * for none).
     */
    rectangleRotation: number;
    rectangleChamfer: readonly [number, number];
}

export const emptyDrawingMemory = (): DrawingMemory => ({
    lastDrawn: null,
    circleRadius: null,
    rectangleLength: null,
    rectangleWidth: null,
    rectangleRotation: 0,
    rectangleChamfer: [0, 0],
});

/** Decimals of a default value in a prompt, like AutoCAD's `<25.0000>`. */
export const DEFAULT_VALUE_DECIMALS = 4;

/** A default value as its prompt shows it. */
export function formatDefault(value: number): string {
    return value.toFixed(DEFAULT_VALUE_DECIMALS);
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
            const points = element.vertexIds.map((vertexId) => position(vertexId));
            if (points.some((point) => point === null)) {
                return null;
            }
            // The last segment, of a closed one the closing one; along its arc if it has a bulge
            const last = polylineSegments(points as Point[], element.bulges, element.closed).at(-1);
            return last ? { point: last.to, direction: segmentEndDirection(last), curved: last.bulge !== 0 } : null;
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

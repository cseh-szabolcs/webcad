import { arcSweep } from '../../geometry/arc';
import { ellipseQuadrants } from '../../geometry/ellipse';
import type { CadElement } from '../../model/CadElement';
import { requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Point } from '../../model/Point';

/**
 * Grip positions of an element, like AutoCAD shows them for a pickfirst selection:
 * line ends and midpoint, polyline vertices and segment midpoints, centre and quadrants of
 * circles and ellipses, centre, ends and midpoint of arcs, bezier ends and control points.
 */
export function elementGrips(element: CadElement, index: DocumentIndex): Point[] {
    const vertex = (id: string): Point => {
        const { x, y } = requireVertex(index, id);
        return { x, y };
    };
    switch (element.type) {
        case 'line': {
            const start = vertex(element.startVertexId);
            const end = vertex(element.endVertexId);
            return [start, end, midpoint(start, end)];
        }
        case 'polyline': {
            const points = element.vertexIds.map(vertex);
            const count = element.closed ? points.length : points.length - 1;
            const midpoints = [];
            for (let i = 0; i < count; i++) {
                midpoints.push(midpoint(points[i], points[(i + 1) % points.length]));
            }
            return [...points, ...midpoints];
        }
        case 'circle':
            return centreAndQuadrants(vertex(element.centerVertexId), element.radius, element.radius);
        case 'ellipse':
            return centreAndQuadrants(vertex(element.centerVertexId), element.radiusX, element.radiusY, element.rotation);
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
            return [center, onArc(startAngle), onArc(startAngle + sweep), onArc(startAngle + sweep / 2)];
        }
        case 'bezier': {
            const start = vertex(element.startVertexId);
            const end = vertex(element.endVertexId);
            return [
                start,
                end,
                { x: start.x + element.startControl.x, y: start.y + element.startControl.y },
                { x: end.x + element.endControl.x, y: end.y + element.endControl.y },
            ];
        }
    }
}

/** Grips of several elements; a position shared by several of them gets a single grip. */
export function selectionGrips(elements: Iterable<CadElement>, index: DocumentIndex): Point[] {
    const grips = new Map<string, Point>();
    for (const element of elements) {
        for (const grip of elementGrips(element, index)) {
            grips.set(`${grip.x.toFixed(6)},${grip.y.toFixed(6)}`, grip);
        }
    }
    return [...grips.values()];
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
        const [start, end, startControl, endControl] = elementGrips(element, index);
        frames.push([start, startControl], [end, endControl]);
    }
    return frames;
}

function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function centreAndQuadrants(center: Point, radiusX: number, radiusY: number, rotation = 0): Point[] {
    return [center, ...ellipseQuadrants({ center, radiusX, radiusY, rotation })];
}

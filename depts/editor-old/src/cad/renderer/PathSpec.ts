import { arcSegments } from '../geometry/arc';
import type { CadElement } from '../model/CadElement';
import { requireVertex, type DocumentIndex } from '../model/DocumentIndex';
import type { Point, Vector2 } from '../model/Point';

/** Handle length for approximating a quarter circle with a cubic Bézier. */
const KAPPA = 0.5522847498307936;

export interface SegmentSpec {
    point: Point;
    handleIn?: Vector2;
    handleOut?: Vector2;
}

/** Renderer-neutral path description of an element, in model space. */
export interface PathSpec {
    segments: SegmentSpec[];
    closed: boolean;
}

export function buildPathSpec(element: CadElement, index: DocumentIndex): PathSpec {
    switch (element.type) {
        case 'line':
            return {
                segments: [
                    { point: requireVertex(index, element.startVertexId) },
                    { point: requireVertex(index, element.endVertexId) },
                ],
                closed: false,
            };
        case 'ellipse':
            return ellipse(requireVertex(index, element.centerVertexId), element.radiusX, element.radiusY);
        case 'circle':
            return ellipse(requireVertex(index, element.centerVertexId), element.radius, element.radius);
        case 'arc':
            return {
                segments: arcSegments(
                    requireVertex(index, element.centerVertexId),
                    requireVertex(index, element.startVertexId),
                    requireVertex(index, element.endVertexId),
                    element.clockwise,
                ),
                closed: false,
            };
        case 'bezier':
            return {
                segments: [
                    { point: requireVertex(index, element.startVertexId), handleOut: element.startControl },
                    { point: requireVertex(index, element.endVertexId), handleIn: element.endControl },
                ],
                closed: false,
            };
        case 'polyline':
            return {
                segments: element.vertexIds.map((id) => ({ point: requireVertex(index, id) })),
                closed: element.closed,
            };
    }
}

/** Closed four-segment path through the quadrant points, starting at +X, counter-clockwise. */
function ellipse(c: Point, rx: number, ry: number): PathSpec {
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;
    return {
        segments: [
            { point: { x: c.x + rx, y: c.y }, handleIn: { x: 0, y: -ky }, handleOut: { x: 0, y: ky } },
            { point: { x: c.x, y: c.y + ry }, handleIn: { x: kx, y: 0 }, handleOut: { x: -kx, y: 0 } },
            { point: { x: c.x - rx, y: c.y }, handleIn: { x: 0, y: ky }, handleOut: { x: 0, y: -ky } },
            { point: { x: c.x, y: c.y - ry }, handleIn: { x: -kx, y: 0 }, handleOut: { x: kx, y: 0 } },
        ],
        closed: true,
    };
}

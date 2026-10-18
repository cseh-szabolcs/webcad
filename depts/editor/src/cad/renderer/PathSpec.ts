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
        case 'circle': {
            const c = requireVertex(index, element.centerVertexId);
            const r = element.radius;
            const k = r * KAPPA;
            return {
                segments: [
                    { point: { x: c.x + r, y: c.y }, handleIn: { x: 0, y: -k }, handleOut: { x: 0, y: k } },
                    { point: { x: c.x, y: c.y + r }, handleIn: { x: k, y: 0 }, handleOut: { x: -k, y: 0 } },
                    { point: { x: c.x - r, y: c.y }, handleIn: { x: 0, y: k }, handleOut: { x: 0, y: -k } },
                    { point: { x: c.x, y: c.y - r }, handleIn: { x: -k, y: 0 }, handleOut: { x: k, y: 0 } },
                ],
                closed: true,
            };
        }
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

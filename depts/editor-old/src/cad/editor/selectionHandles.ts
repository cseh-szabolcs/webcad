import type { CadDocument } from '../model/CadDocument';
import { vertexRefs, type CircleElement, type EllipseElement } from '../model/CadElement';
import type { Id, Point } from '../model/Point';

/** Which quadrant point of an ellipse a radius handle sits on. */
export type RadiusSide = 'right' | 'top' | 'left' | 'bottom';

export type Handle =
    /** Moves a vertex; its id is the vertex id. */
    | { kind: 'vertex'; id: Id; vertexId: Id; x: number; y: number }
    /** Changes one radius of an ellipse around its fixed centre. */
    | { kind: 'radius'; id: string; elementId: Id; side: RadiusSide; x: number; y: number };

export const SIDES: readonly RadiusSide[] = ['right', 'top', 'left', 'bottom'];

/** Unique ids of all vertices referenced by the given elements, in document order. */
export function selectedVertexIds(doc: CadDocument, elementIds: ReadonlySet<Id>): Id[] {
    const ids = new Set<Id>();
    for (const element of doc.elements) {
        if (elementIds.has(element.id)) {
            vertexRefs(element).forEach((id) => ids.add(id));
        }
    }
    return [...ids];
}

/**
 * Handles of the selected elements: first their vertices (line and bezier endpoints,
 * polyline vertices, ellipse centres, arc centre and ends), then the four side handles
 * of each ellipse.
 */
export function selectionHandles(doc: CadDocument, selected: ReadonlySet<Id>): Handle[] {
    const wanted = new Set(selectedVertexIds(doc, selected));
    const handles: Handle[] = doc.vertices
        .filter((vertex) => wanted.has(vertex.id))
        .map((vertex) => ({ kind: 'vertex', id: vertex.id, vertexId: vertex.id, x: vertex.x, y: vertex.y }));

    const vertices = new Map(doc.vertices.map((vertex) => [vertex.id, vertex]));
    for (const element of doc.elements) {
        if (!selected.has(element.id) || element.type !== 'ellipse') {
            continue;
        }
        const center = vertices.get(element.centerVertexId);
        if (!center) {
            continue;
        }
        for (const side of SIDES) {
            const point = radiusHandlePoint(element, center, side);
            handles.push({ kind: 'radius', id: `${element.id}#${side}`, elementId: element.id, side, ...point });
        }
    }
    return handles;
}

/** Quadrant point of an ellipse or circle on the given side; also a snap point. */
export function radiusHandlePoint(element: EllipseElement | CircleElement, center: Point, side: RadiusSide): Point {
    const radiusX = element.type === 'circle' ? element.radius : element.radiusX;
    const radiusY = element.type === 'circle' ? element.radius : element.radiusY;
    switch (side) {
        case 'right':
            return { x: center.x + radiusX, y: center.y };
        case 'top':
            return { x: center.x, y: center.y + radiusY };
        case 'left':
            return { x: center.x - radiusX, y: center.y };
        case 'bottom':
            return { x: center.x, y: center.y - radiusY };
    }
}

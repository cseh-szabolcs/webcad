import type { CadDocument } from '../model/CadDocument';
import { vertexRefs } from '../model/CadElement';
import type { Id } from '../model/Point';
import type { Vertex } from '../model/Vertex';

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
 * Vertex handles of the selected elements: line and bezier endpoints, polyline
 * vertices, circle centres. Radius and control handles are not vertices.
 */
export function selectionHandles(doc: CadDocument, selected: ReadonlySet<Id>): Vertex[] {
    const wanted = new Set(selectedVertexIds(doc, selected));
    return doc.vertices.filter((vertex) => wanted.has(vertex.id));
}

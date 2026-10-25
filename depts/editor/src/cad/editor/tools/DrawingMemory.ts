import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';

/**
 * What LINIE and PLINIE remember between runs: the line or polyline drawn last, for "continue"
 * (Enter at the first point).
 */
export interface DrawingMemory {
    lastDrawn: Id | null;
}

/**
 * Where "continue" starts: the end point of element `id` where it is now (an open polyline's
 * last vertex, a closed one's first, where its closing segment ends); null if it is gone or is
 * no line or polyline.
 */
export function continuePoint(doc: CadDocument, id: Id | null): Point | null {
    const element = doc.elements.find((candidate) => candidate.id === id);
    const endId =
        element?.type === 'line'
            ? element.endVertexId
            : element?.type === 'polyline'
              ? element.closed
                  ? element.vertexIds[0]
                  : element.vertexIds.at(-1)
              : undefined;
    const end = doc.vertices.find((vertex) => vertex.id === endId);
    return end ? { x: end.x, y: end.y } : null;
}

import { arcMidpoint } from '../../geometry/arc';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import { indexDocument, requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point } from '../../model/Point';
import { radiusHandlePoint, SIDES, type RadiusSide } from '../selectionHandles';

/**
 * A point a dragged vertex can snap to. Vertices are real, stored points; midpoints and
 * quadrants are derived from an element and never persisted. Snapping only sets the
 * position; nothing is connected.
 */
export type SnapPoint =
    | { kind: 'vertex'; x: number; y: number; vertexId: Id }
    /** Middle of a line or polyline segment (`segment` is its index), or halfway along an arc. */
    | { kind: 'midpoint'; x: number; y: number; elementId: Id; segment: number }
    | { kind: 'quadrant'; x: number; y: number; elementId: Id; side: RadiusSide };

/**
 * All snap points of elements on visible, unlocked layers (elements without a layer count
 * as visible): every vertex once, in document order, followed by the derived points.
 */
export function snapPoints(doc: CadDocument): SnapPoint[] {
    const index = indexDocument(doc);
    const usable = doc.elements.filter(
        (element) => element.layerId === null || isUsableLayer(index, element.layerId),
    );

    const vertexIds = new Set(usable.flatMap(vertexRefs));
    const points: SnapPoint[] = doc.vertices
        .filter((vertex) => vertexIds.has(vertex.id))
        .map((vertex) => ({ kind: 'vertex', x: vertex.x, y: vertex.y, vertexId: vertex.id }));
    for (const element of usable) {
        points.push(...derivedPoints(element, index));
    }
    return points;
}

/**
 * Nearest snap point within `radius` (mm) of `point`; a vertex wins over a derived point at
 * the same distance. Skips the dragged vertex itself and the derived points of elements that
 * use it, because those move along with the drag.
 */
export function findSnap(doc: CadDocument, point: Point, radius: number, draggedVertexId: Id): SnapPoint | null {
    const moving = new Set(
        doc.elements.filter((element) => vertexRefs(element).includes(draggedVertexId)).map((element) => element.id),
    );
    let best: SnapPoint | null = null;
    let bestDistance = Infinity;
    for (const candidate of snapPoints(doc)) {
        const skip = candidate.kind === 'vertex' ? candidate.vertexId === draggedVertexId : moving.has(candidate.elementId);
        if (skip) {
            continue;
        }
        const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        if (distance <= radius && distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return best;
}

function isUsableLayer(index: DocumentIndex, layerId: Id): boolean {
    const layer = index.layers.get(layerId);
    return layer !== undefined && layer.visible && !layer.locked;
}

function derivedPoints(element: CadElement, index: DocumentIndex): SnapPoint[] {
    const at = (id: Id) => requireVertex(index, id);
    switch (element.type) {
        case 'line':
            return [{ kind: 'midpoint', ...middle(at(element.startVertexId), at(element.endVertexId)), elementId: element.id, segment: 0 }];
        case 'polyline': {
            const ids = element.vertexIds;
            const count = element.closed ? ids.length : ids.length - 1;
            return Array.from({ length: count }, (_, segment) => ({
                kind: 'midpoint' as const,
                ...middle(at(ids[segment]), at(ids[(segment + 1) % ids.length])),
                elementId: element.id,
                segment,
            }));
        }
        case 'arc': {
            const mid = arcMidpoint(at(element.centerVertexId), at(element.startVertexId), at(element.endVertexId), element.clockwise);
            return [{ kind: 'midpoint', ...mid, elementId: element.id, segment: 0 }];
        }
        case 'ellipse':
        case 'circle': {
            const center = at(element.centerVertexId);
            return SIDES.map((side) => ({
                kind: 'quadrant' as const,
                ...radiusHandlePoint(element, center, side),
                elementId: element.id,
                side,
            }));
        }
        case 'bezier':
            return [];
    }
}

function middle(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

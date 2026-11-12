import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** Adds a vertex at `point` to a polyline, at place `at` of its `vertexIds` (a grip's Add Vertex). */
export class AddPolylineVertexCommand implements DocumentCommand {
    readonly label = 'GRIP_ADD_VERTEX';
    private readonly elementId: Id;
    private readonly at: number;
    private readonly point: Point;
    readonly vertexId: Id;

    constructor(elementId: Id, at: number, point: Point, newId: () => Id = () => crypto.randomUUID()) {
        this.elementId = elementId;
        this.at = at;
        this.point = point;
        this.vertexId = newId();
    }

    execute(doc: CadDocument): DocumentChange {
        return {
            document: {
                ...doc,
                vertices: [...doc.vertices, { id: this.vertexId, x: this.point.x, y: this.point.y }],
                elements: doc.elements.map((element) =>
                    element.id === this.elementId && element.type === 'polyline'
                        ? { ...element, vertexIds: element.vertexIds.toSpliced(this.at, 0, this.vertexId) }
                        : element,
                ),
            },
            changedElementIds: [this.elementId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => vertex.id !== this.vertexId),
                elements: doc.elements.map((element) =>
                    element.id === this.elementId && element.type === 'polyline'
                        ? { ...element, vertexIds: element.vertexIds.filter((id) => id !== this.vertexId) }
                        : element,
                ),
            },
            changedElementIds: [this.elementId],
        };
    }
}

/**
 * Takes the vertex at place `at` out of a polyline's `vertexIds` (a grip's Remove Vertex). The
 * vertex itself goes too, unless something else still uses it.
 */
export class RemovePolylineVertexCommand implements DocumentCommand {
    readonly label = 'GRIP_REMOVE_VERTEX';
    private readonly elementId: Id;
    private readonly at: number;
    /** What undo puts back: the id, and the vertex with its place in the document if it was dropped. */
    private removed: { id: Id; vertex: { index: number; value: CadDocument['vertices'][number] } | null } | null = null;

    constructor(elementId: Id, at: number) {
        this.elementId = elementId;
        this.at = at;
    }

    execute(doc: CadDocument): DocumentChange {
        const polyline = doc.elements.find((element) => element.id === this.elementId);
        const id = polyline?.type === 'polyline' ? polyline.vertexIds[this.at] : undefined;
        if (polyline?.type !== 'polyline' || id === undefined) {
            this.removed = null;
            return { document: doc, changedElementIds: [] };
        }
        const vertexIds = polyline.vertexIds.toSpliced(this.at, 1);
        const elements = doc.elements.map((element) => (element === polyline ? { ...polyline, vertexIds } : element));
        const used = elements.some((element) => vertexRefs(element).includes(id));
        const index = used ? -1 : doc.vertices.findIndex((vertex) => vertex.id === id);
        this.removed = { id, vertex: index >= 0 ? { index, value: doc.vertices[index] } : null };
        return {
            document: { ...doc, vertices: index >= 0 ? doc.vertices.toSpliced(index, 1) : doc.vertices, elements },
            changedElementIds: [this.elementId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const removed = this.removed;
        if (removed === null) {
            return { document: doc, changedElementIds: [] };
        }
        const { id, vertex } = removed;
        return {
            document: {
                ...doc,
                vertices: vertex ? doc.vertices.toSpliced(vertex.index, 0, vertex.value) : doc.vertices,
                elements: doc.elements.map((element) =>
                    element.id === this.elementId && element.type === 'polyline'
                        ? { ...element, vertexIds: element.vertexIds.toSpliced(this.at, 0, id) }
                        : element,
                ),
            },
            changedElementIds: [this.elementId],
        };
    }
}

import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type PolylineElement } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** The polyline `id` of the document, changed by `change`; other elements stay. */
function withPolyline(doc: CadDocument, id: Id, change: (polyline: PolylineElement) => PolylineElement): CadDocument['elements'] {
    return doc.elements.map((element) => (element.id === id && element.type === 'polyline' ? change(element) : element));
}

/** The polyline with the vertex `id` at place `at`: the segment it lands in becomes two straight ones. */
export function withVertexAt(polyline: PolylineElement, at: number, id: Id): PolylineElement {
    // The segment before the new vertex ends there now
    const before = (at - 1 + polyline.bulges.length) % polyline.bulges.length;
    const split = at === 0 && !polyline.closed ? polyline.bulges : polyline.bulges.with(before, 0);
    return { ...polyline, vertexIds: polyline.vertexIds.toSpliced(at, 0, id), bulges: split.toSpliced(at, 0, 0) };
}

/**
 * Adds a vertex at `point` to a polyline, at place `at` of its `vertexIds` (a grip's Add Vertex).
 * The segment it lands in becomes two straight ones, also where it was an arc.
 */
export class AddPolylineVertexCommand implements DocumentCommand {
    readonly label = 'GRIP_ADD_VERTEX';
    private readonly elementId: Id;
    private readonly at: number;
    private readonly point: Point;
    readonly vertexId: Id;
    /** The bulges before, for undo. */
    private bulges: readonly number[] | null = null;

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
                elements: withPolyline(doc, this.elementId, (polyline) => {
                    this.bulges = polyline.bulges;
                    return withVertexAt(polyline, this.at, this.vertexId);
                }),
            },
            changedElementIds: [this.elementId],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => vertex.id !== this.vertexId),
                elements: withPolyline(doc, this.elementId, (polyline) => ({
                    ...polyline,
                    vertexIds: polyline.vertexIds.filter((id) => id !== this.vertexId),
                    bulges: [...(this.bulges ?? polyline.bulges.toSpliced(this.at, 1))],
                })),
            },
            changedElementIds: [this.elementId],
        };
    }
}

/**
 * Sets the bulge of one segment of a polyline (a grip's Convert to Arc and Convert to Line): 0
 * makes it straight.
 */
export class SetPolylineBulgeCommand implements DocumentCommand {
    readonly label: 'GRIP_CONVERT_ARC' | 'GRIP_CONVERT_LINE';
    private readonly elementId: Id;
    private readonly segment: number;
    private readonly bulge: number;
    private before: number | null = null;

    constructor(elementId: Id, segment: number, bulge: number) {
        this.label = bulge === 0 ? 'GRIP_CONVERT_LINE' : 'GRIP_CONVERT_ARC';
        this.elementId = elementId;
        this.segment = segment;
        this.bulge = bulge;
    }

    execute(doc: CadDocument): DocumentChange {
        const elements = withPolyline(doc, this.elementId, (polyline) => {
            this.before = polyline.bulges[this.segment] ?? null;
            return this.before === null ? polyline : { ...polyline, bulges: polyline.bulges.with(this.segment, this.bulge) };
        });
        return { document: { ...doc, elements }, changedElementIds: [this.elementId] };
    }

    undo(doc: CadDocument): DocumentChange {
        const before = this.before;
        if (before === null) {
            return { document: doc, changedElementIds: [] };
        }
        const elements = withPolyline(doc, this.elementId, (polyline) => ({ ...polyline, bulges: polyline.bulges.with(this.segment, before) }));
        return { document: { ...doc, elements }, changedElementIds: [this.elementId] };
    }
}

/**
 * Takes the vertex at place `at` out of a polyline's `vertexIds` (a grip's Remove Vertex). The
 * vertex itself goes too, unless something else still uses it. The segment that then joins its
 * neighbours is straight.
 */
export class RemovePolylineVertexCommand implements DocumentCommand {
    readonly label = 'GRIP_REMOVE_VERTEX';
    private readonly elementId: Id;
    private readonly at: number;
    /** What undo puts back: the id, and the vertex with its place in the document if it was dropped. */
    private removed: {
        id: Id;
        bulges: readonly number[];
        vertex: { index: number; value: CadDocument['vertices'][number] } | null;
    } | null = null;

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
        const before = (this.at - 1 + polyline.bulges.length) % polyline.bulges.length;
        const bulges = polyline.bulges.with(before, 0).toSpliced(this.at, 1);
        const elements = doc.elements.map((element) => (element === polyline ? { ...polyline, vertexIds, bulges } : element));
        const used = elements.some((element) => vertexRefs(element).includes(id));
        const index = used ? -1 : doc.vertices.findIndex((vertex) => vertex.id === id);
        this.removed = { id, bulges: polyline.bulges, vertex: index >= 0 ? { index, value: doc.vertices[index] } : null };
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
        const { id, vertex, bulges } = removed;
        return {
            document: {
                ...doc,
                vertices: vertex ? doc.vertices.toSpliced(vertex.index, 0, vertex.value) : doc.vertices,
                elements: withPolyline(doc, this.elementId, (polyline) => ({
                    ...polyline,
                    vertexIds: polyline.vertexIds.toSpliced(this.at, 0, id),
                    bulges: [...bulges],
                })),
            },
            changedElementIds: [this.elementId],
        };
    }
}

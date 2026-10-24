import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, withVertexRefs } from '../../model/CadElement';
import type { Id, Point, Vector2 } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * SCHIEBEN (AutoCAD MOVE): moves the elements by `delta` by moving each of their vertices
 * once, however many of them share it. Like AutoCAD, elements that are not moved never
 * change: where one of them shares a moved vertex, it is detached onto a copy of the vertex
 * at the old position (one copy per vertex, so those neighbours stay connected to each
 * other). The moved elements keep the original vertex ids.
 */
export class MoveCommand implements DocumentCommand {
    readonly label = 'SCHIEBEN';
    private readonly elementIds: ReadonlySet<Id>;
    private readonly delta: Vector2;
    private readonly newId: () => Id;
    /** Copy of each shared vertex for the neighbours; fixed on the first run, so redo repeats it. */
    private clones: Map<Id, Id> | null = null;
    /** Positions before the move, so undo restores them exactly instead of subtracting. */
    private original = new Map<Id, Point>();

    constructor(elementIds: Iterable<Id>, delta: Vector2, newId: () => Id = () => crypto.randomUUID()) {
        this.elementIds = new Set(elementIds);
        this.delta = delta;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const moved = this.movedVertices(doc);
        const neighbours = this.neighbours(doc, moved);
        if (this.clones === null) {
            const shared = new Set(neighbours.flatMap(vertexRefs).filter((id) => moved.has(id)));
            this.clones = new Map([...shared].map((id) => [id, this.newId()]));
        }
        const clones = this.clones;
        this.original = new Map();
        const vertices = doc.vertices.map((vertex) => {
            if (!moved.has(vertex.id)) {
                return vertex;
            }
            this.original.set(vertex.id, { x: vertex.x, y: vertex.y });
            return { ...vertex, x: vertex.x + this.delta.x, y: vertex.y + this.delta.y };
        });
        for (const [id, clone] of clones) {
            const { x, y } = this.original.get(id)!;
            vertices.push({ id: clone, x, y });
        }
        const detached = new Set(neighbours.map((element) => element.id));
        return {
            document: {
                ...doc,
                vertices,
                elements: doc.elements.map((element) => (detached.has(element.id) ? withVertexRefs(element, clones) : element)),
            },
            changedElementIds: [...this.elementIds, ...detached],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const clones = this.clones ?? new Map<Id, Id>();
        const reattach = new Map([...clones].map(([id, clone]) => [clone, id]));
        const cloneIds = new Set(reattach.keys());
        const detached = doc.elements.filter(
            (element) => !this.elementIds.has(element.id) && vertexRefs(element).some((id) => cloneIds.has(id)),
        );
        const detachedIds = new Set(detached.map((element) => element.id));
        return {
            document: {
                ...doc,
                vertices: doc.vertices
                    .filter((vertex) => !cloneIds.has(vertex.id))
                    .map((vertex) => {
                        const original = this.original.get(vertex.id);
                        return original ? { ...vertex, ...original } : vertex;
                    }),
                elements: doc.elements.map((element) =>
                    detachedIds.has(element.id) ? withVertexRefs(element, reattach) : element,
                ),
            },
            changedElementIds: [...this.elementIds, ...detachedIds],
        };
    }

    private movedVertices(doc: CadDocument): Set<Id> {
        return new Set(doc.elements.filter((element) => this.elementIds.has(element.id)).flatMap(vertexRefs));
    }

    /** Elements that are not moved but use a moved vertex. */
    private neighbours(doc: CadDocument, moved: ReadonlySet<Id>) {
        return doc.elements.filter(
            (element) => !this.elementIds.has(element.id) && vertexRefs(element).some((id) => moved.has(id)),
        );
    }
}

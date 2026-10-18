import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import type { Id } from '../../model/Point';
import type { Vertex } from '../../model/Vertex';
import type { Command, CommandResult } from './Command';

interface Removed<T> {
    index: number;
    item: T;
}

/**
 * Deletes elements together with the vertices no remaining element references.
 * Undo restores both at their original positions, so drawing order is preserved.
 */
export class DeleteElementsCommand implements Command {
    readonly label: string;
    private readonly ids: ReadonlySet<Id>;
    private removedElements: Removed<CadElement>[] = [];
    private removedVertices: Removed<Vertex>[] = [];

    constructor(ids: Iterable<Id>) {
        this.ids = new Set(ids);
        this.label = this.ids.size === 1 ? 'Delete element' : `Delete ${this.ids.size} elements`;
    }

    execute(doc: CadDocument): CommandResult {
        const [elements, removedElements] = partition(doc.elements, (element) => this.ids.has(element.id));
        const stillUsed = new Set(elements.flatMap(vertexRefs));
        const candidates = new Set(removedElements.flatMap(({ item }) => vertexRefs(item)));
        const [vertices, removedVertices] = partition(
            doc.vertices,
            (vertex) => candidates.has(vertex.id) && !stillUsed.has(vertex.id),
        );

        this.removedElements = removedElements;
        this.removedVertices = removedVertices;
        return { document: { ...doc, elements, vertices }, changedElementIds: this.changedElementIds() };
    }

    undo(doc: CadDocument): CommandResult {
        return {
            document: {
                ...doc,
                elements: restore(doc.elements, this.removedElements),
                vertices: restore(doc.vertices, this.removedVertices),
            },
            changedElementIds: this.changedElementIds(),
        };
    }

    private changedElementIds(): Id[] {
        return this.removedElements.map(({ item }) => item.id);
    }
}

function partition<T>(items: T[], remove: (item: T) => boolean): [T[], Removed<T>[]] {
    const kept: T[] = [];
    const removed: Removed<T>[] = [];
    items.forEach((item, index) => (remove(item) ? removed.push({ index, item }) : kept.push(item)));
    return [kept, removed];
}

/** Re-inserts removed items; `removed` is in ascending index order. */
function restore<T>(items: T[], removed: Removed<T>[]): T[] {
    const result = [...items];
    for (const { index, item } of removed) {
        result.splice(index, 0, item);
    }
    return result;
}

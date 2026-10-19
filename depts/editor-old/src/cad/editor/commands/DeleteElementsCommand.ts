import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import type { Group } from '../../model/Group';
import type { Id } from '../../model/Point';
import type { Vertex } from '../../model/Vertex';
import type { Command, CommandResult } from './Command';
import { partition, partitionEmptiedGroups, restore, type Removed } from './removal';

/**
 * Deletes elements together with the vertices no remaining element references and the
 * groups that lose their last member. Undo restores all of them at their original
 * positions, so drawing order is preserved.
 */
export class DeleteElementsCommand implements Command {
    readonly label: string;
    private readonly ids: ReadonlySet<Id>;
    private removedElements: Removed<CadElement>[] = [];
    private removedVertices: Removed<Vertex>[] = [];
    private removedGroups: Removed<Group>[] = [];

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
        const [groups, removedGroups] = partitionEmptiedGroups(
            doc.groups,
            elements,
            removedElements.map(({ item }) => item.groupId),
        );

        this.removedElements = removedElements;
        this.removedVertices = removedVertices;
        this.removedGroups = removedGroups;
        return { document: { ...doc, elements, vertices, groups }, changedElementIds: this.changedElementIds() };
    }

    undo(doc: CadDocument): CommandResult {
        return {
            document: {
                ...doc,
                elements: restore(doc.elements, this.removedElements),
                vertices: restore(doc.vertices, this.removedVertices),
                groups: restore(doc.groups, this.removedGroups),
            },
            changedElementIds: this.changedElementIds(),
        };
    }

    private changedElementIds(): Id[] {
        return this.removedElements.map(({ item }) => item.id);
    }
}

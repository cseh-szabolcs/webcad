import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { Id } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** What was taken out of a list, with the place it had there. */
type Removed<T> = readonly { at: number; item: T }[];

/**
 * LÖSCHEN (AutoCAD ERASE): takes the elements out of the document, with the vertices no other
 * element uses and the groups left empty. `undo` puts back only what it removed, each at its old
 * place, so what changed elsewhere meanwhile (a collaborator) stays.
 */
export class EraseCommand implements DocumentCommand {
    readonly label = 'ERASE';
    private readonly elementIds: ReadonlySet<Id>;
    private removed: {
        vertices: Removed<CadDocument['vertices'][number]>;
        elements: Removed<CadDocument['elements'][number]>;
        groups: Removed<CadDocument['groups'][number]>;
    } | null = null;

    constructor(elementIds: Iterable<Id>) {
        this.elementIds = new Set(elementIds);
    }

    execute(doc: CadDocument): DocumentChange {
        const erased = doc.elements.filter((element) => this.elementIds.has(element.id));
        if (erased.length === 0) {
            this.removed = null;
            return { document: doc, changedElementIds: [] };
        }
        const remaining = doc.elements.filter((element) => !this.elementIds.has(element.id));
        const usedVertices = new Set(remaining.flatMap(vertexRefs));
        const orphaned = new Set(erased.flatMap(vertexRefs).filter((id) => !usedVertices.has(id)));
        const usedGroups = new Set(remaining.map((element) => element.groupId));
        const emptied = new Set(erased.map((element) => element.groupId).filter((id) => id !== null && !usedGroups.has(id)));
        const vertices = take(doc.vertices, (vertex) => orphaned.has(vertex.id));
        const elements = take(doc.elements, (element) => this.elementIds.has(element.id));
        const groups = take(doc.groups, (group) => emptied.has(group.id));
        this.removed = { vertices: vertices.removed, elements: elements.removed, groups: groups.removed };
        return {
            document: { ...doc, vertices: vertices.kept, elements: elements.kept, groups: groups.kept },
            changedElementIds: erased.map((element) => element.id),
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const removed = this.removed;
        if (removed === null) {
            return { document: doc, changedElementIds: [] };
        }
        return {
            document: {
                ...doc,
                vertices: putBack(doc.vertices, removed.vertices),
                elements: putBack(doc.elements, removed.elements),
                groups: putBack(doc.groups, removed.groups),
            },
            changedElementIds: removed.elements.map(({ item }) => item.id),
        };
    }
}

/** Splits a list; the list itself is kept where nothing goes. */
function take<T>(list: T[], goes: (item: T) => boolean): { kept: T[]; removed: Removed<T> } {
    const removed = list.flatMap((item, at) => (goes(item) ? [{ at, item }] : []));
    return { kept: removed.length > 0 ? list.filter((item) => !goes(item)) : list, removed };
}

/** Each item back at its old index, or at the end of a list that got shorter since; none twice. */
function putBack<T extends { id: Id }>(list: T[], removed: Removed<T>): T[] {
    const present = new Set(list.map((item) => item.id));
    const missing = removed.filter(({ item }) => !present.has(item.id));
    if (missing.length === 0) {
        return list;
    }
    const result = [...list];
    for (const { at, item } of missing) {
        result.splice(Math.min(at, result.length), 0, item);
    }
    return result;
}

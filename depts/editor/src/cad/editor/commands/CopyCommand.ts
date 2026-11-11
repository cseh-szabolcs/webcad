import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, withVertexRefs, type CadElement } from '../../model/CadElement';
import { indexDocument, requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id, Point } from '../../model/Point';
import type { CommandLabel } from '../commandNames';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';
import { samePosition, type ElementEdit } from './elementEdits';

/**
 * Adds copies of elements as `edits` would leave them (e.g. a grip mode with its option Copy);
 * the originals stay as they are. Each copy gets its own vertices; copies that shared a vertex
 * share its copy where they agree on the position. Copies of grouped elements form a group of
 * their own (a copy of the original's), so a pick takes the copy, not the original with it.
 */
export class CopyCommand implements DocumentCommand {
    readonly label: CommandLabel;
    private readonly edits: (index: DocumentIndex) => readonly ElementEdit[];
    private readonly newId: () => Id;
    /** Ids of the copies by what they copy; fixed on the first run, so redo repeats them. */
    private readonly ids = new Map<string, Id>();

    constructor(
        label: CommandLabel,
        edits: (index: DocumentIndex) => readonly ElementEdit[],
        newId: () => Id = () => crypto.randomUUID(),
    ) {
        this.label = label;
        this.edits = edits;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const index = indexDocument(doc);
        const id = (key: string): Id => {
            const known = this.ids.get(key) ?? this.newId();
            this.ids.set(key, known);
            return known;
        };
        const vertices: CadDocument['vertices'] = [];
        const elements: CadElement[] = [];
        const groups: CadDocument['groups'] = [];
        /** Per original vertex: the copies made of it, one per position. */
        const placed = new Map<Id, { point: Point; id: Id }[]>();
        const groupCopies = new Map<Id, Id>();
        for (const { element, vertices: moved } of this.edits(index)) {
            const refs = new Map<Id, Id>();
            for (const original of vertexRefs(element)) {
                const { x, y } = moved.get(original) ?? requireVertex(index, original);
                const copies = placed.get(original) ?? [];
                placed.set(original, copies);
                let copy = copies.find((candidate) => samePosition(candidate.point, { x, y }));
                if (!copy) {
                    copy = { point: { x, y }, id: id(`vertex:${original}#${copies.length}`) };
                    copies.push(copy);
                    vertices.push({ id: copy.id, x, y });
                }
                refs.set(original, copy.id);
            }
            let groupId = element.groupId;
            const group = groupId !== null ? index.groups.get(groupId) : undefined;
            if (group) {
                groupId = groupCopies.get(group.id) ?? id(`group:${group.id}`);
                if (!groupCopies.has(group.id)) {
                    groupCopies.set(group.id, groupId);
                    groups.push({ ...group, id: groupId });
                }
            }
            elements.push({ ...withVertexRefs(element, refs), id: id(`element:${element.id}`), groupId });
        }
        return {
            document: {
                ...doc,
                vertices: [...doc.vertices, ...vertices],
                elements: [...doc.elements, ...elements],
                groups: groups.length > 0 ? [...doc.groups, ...groups] : doc.groups,
            },
            changedElementIds: elements.map((element) => element.id),
        };
    }

    undo(doc: CadDocument): DocumentChange {
        const added = new Set(this.ids.values());
        const removed = doc.elements.filter((element) => added.has(element.id)).map((element) => element.id);
        const groups = doc.groups.filter((group) => !added.has(group.id));
        return {
            document: {
                ...doc,
                vertices: doc.vertices.filter((vertex) => !added.has(vertex.id)),
                elements: doc.elements.filter((element) => !added.has(element.id)),
                groups: groups.length === doc.groups.length ? doc.groups : groups,
            },
            changedElementIds: removed,
        };
    }
}

import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import type { Group } from '../../model/Group';
import type { Id } from '../../model/Point';
import type { Vertex } from '../../model/Vertex';
import type { DocumentChange } from './DocumentCommand';

/**
 * What a document change did, as data: the vertices, elements and groups it added or changed (as
 * they are afterwards) and the ids of those it removed. It is how a change travels to the other
 * collaborators: commands are not sent, as they hold functions and what they found on their first
 * run; their effect is, which also covers undo and redo. Layers and styles are not in it, as no
 * command changes them yet.
 */
export interface DocumentPatch {
    /** The plan the change belongs to: a room holds every plan of a project. */
    planId: Id;
    vertices: Vertex[];
    removedVertexIds: Id[];
    elements: PatchedElement[];
    removedElementIds: Id[];
    groups: Group[];
    removedGroupIds: Id[];
    /** The elements to draw anew: also those whose vertices moved while they stayed as they are. */
    changedElementIds: Id[];
}

export interface PatchedElement {
    element: CadElement;
    /**
     * Only for an element new to the document: the element it follows in the drawing order, null
     * for the first. A changed element stays where it is.
     */
    after?: Id | null;
}

/** How many vertices, elements and groups a patch names; what the limit of a message counts. */
export function patchSize(patch: DocumentPatch): number {
    return (
        patch.vertices.length +
        patch.removedVertexIds.length +
        patch.elements.length +
        patch.removedElementIds.length +
        patch.groups.length +
        patch.removedGroupIds.length
    );
}

/** The patch that turns `before` into `after`, or null if they do not differ in what a patch holds. */
export function diffDocuments(before: CadDocument, after: CadDocument, changedElementIds: readonly Id[]): DocumentPatch | null {
    const vertices = diffById(before.vertices, after.vertices, (a, b) => a.x === b.x && a.y === b.y);
    const groups = diffById(before.groups, after.groups, sameJson);
    const elements = diffById(before.elements, after.elements, sameJson);
    const known = before.elements === after.elements ? null : new Set(before.elements.map(({ id }) => id));
    const added = new Set(elements.changed.filter(({ id }) => !known?.has(id)).map(({ id }) => id));
    const patched: PatchedElement[] = [];
    if (added.size > 0) {
        after.elements.forEach((element, index) => {
            if (added.has(element.id)) {
                patched.push({ element, after: index === 0 ? null : after.elements[index - 1].id });
            }
        });
    }
    patched.push(...elements.changed.filter(({ id }) => !added.has(id)).map((element) => ({ element })));
    const patch: DocumentPatch = {
        planId: after.id,
        vertices: vertices.changed,
        removedVertexIds: vertices.removed,
        elements: patched,
        removedElementIds: elements.removed,
        groups: groups.changed,
        removedGroupIds: groups.removed,
        changedElementIds: [...changedElementIds],
    };
    return patchSize(patch) === 0 ? null : patch;
}

/**
 * The document with the patch applied, or null where it does not fit: another plan, or a result in
 * which an element would use a vertex or a group that is not there (the documents have drifted
 * apart, e.g. the sender changed something before this editor joined). Never throws on what a peer
 * sent, and never returns a document the renderer could not draw.
 */
export function applyDocumentPatch(doc: CadDocument, patch: DocumentPatch): DocumentChange | null {
    if (patch.planId !== doc.id) {
        return null;
    }
    const vertices = patchById(doc.vertices, patch.vertices, patch.removedVertexIds);
    const groups = patchById(doc.groups, patch.groups, patch.removedGroupIds);
    const elements = patchElements(doc.elements, patch);
    const vertexIds = new Set(vertices.map(({ id }) => id));
    const groupIds = new Set(groups.map(({ id }) => id));
    const fits = (element: CadElement) =>
        vertexRefs(element).every((id) => vertexIds.has(id)) && (element.groupId === null || groupIds.has(element.groupId));
    // Removing can orphan any element, adding and changing only those of the patch
    const removes = patch.removedVertexIds.length > 0 || patch.removedGroupIds.length > 0;
    const toCheck = removes ? elements : patch.elements.map(({ element }) => element);
    if (!toCheck.every(fits)) {
        return null;
    }
    return { document: { ...doc, vertices, elements, groups }, changedElementIds: patch.changedElementIds };
}

function sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function diffById<T extends { id: Id }>(
    before: readonly T[],
    after: readonly T[],
    same: (a: T, b: T) => boolean,
): { changed: T[]; removed: Id[] } {
    if (before === after) {
        return { changed: [], removed: [] };
    }
    const old = new Map(before.map((item) => [item.id, item]));
    const changed = after.filter((item) => {
        const previous = old.get(item.id);
        return previous === undefined || (previous !== item && !same(previous, item));
    });
    const kept = new Set(after.map(({ id }) => id));
    return { changed, removed: before.filter(({ id }) => !kept.has(id)).map(({ id }) => id) };
}

/** Changed items in place, new ones at the end; for collections whose order says nothing. */
function patchById<T extends { id: Id }>(items: readonly T[], changed: readonly T[], removedIds: readonly Id[]): T[] {
    if (changed.length === 0 && removedIds.length === 0) {
        return items as T[];
    }
    const removed = new Set(removedIds);
    const next = new Map(changed.map((item) => [item.id, item]));
    const result: T[] = [];
    for (const item of items) {
        if (removed.has(item.id)) {
            continue;
        }
        result.push(next.get(item.id) ?? item);
        next.delete(item.id);
    }
    result.push(...next.values());
    return result;
}

/** Like patchById, but new elements go behind the element they follow (at the end if that is unknown). */
function patchElements(elements: readonly CadElement[], patch: DocumentPatch): CadElement[] {
    if (patch.elements.length === 0 && patch.removedElementIds.length === 0) {
        return elements as CadElement[];
    }
    const removed = new Set(patch.removedElementIds);
    const next = new Map(patch.elements.map(({ element }) => [element.id, element]));
    const result: CadElement[] = [];
    for (const element of elements) {
        if (!removed.has(element.id)) {
            result.push(next.get(element.id) ?? element);
            next.delete(element.id);
        }
    }
    // Where the element added last went: a run of new elements is one behind the other
    let last: { id: Id; index: number } | null = null;
    for (const { element, after } of patch.elements) {
        if (!next.has(element.id)) {
            continue;
        }
        let index = result.length;
        if (after === null) {
            index = 0;
        } else if (after !== undefined) {
            const found = last?.id === after ? last.index : result.findLastIndex(({ id }) => id === after);
            index = found < 0 ? result.length : found + 1;
        }
        result.splice(index, 0, element);
        last = { id: element.id, index };
    }
    return result;
}

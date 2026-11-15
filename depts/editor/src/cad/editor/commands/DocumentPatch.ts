import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import type { ElementStyle } from '../../model/ElementStyle';
import type { Group } from '../../model/Group';
import type { Layer } from '../../model/Layer';
import type { Id } from '../../model/Point';
import type { Vertex } from '../../model/Vertex';
import type { DocumentChange } from './DocumentCommand';

/**
 * What a document change did, as data: the vertices, elements, groups and layers it added or
 * changed (as they are afterwards) and the ids of those it removed. It is how a change travels to
 * the other collaborators: commands are not sent, as they hold functions and what they found on
 * their first run; their effect is, which also covers undo and redo. Floors are not in it, as no
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
    layers: PatchedLayer[];
    removedLayerIds: Id[];
    styles: ElementStyle[];
    removedStyleIds: Id[];
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

export interface PatchedLayer {
    layer: Layer;
    /**
     * Only for a layer new to the document: the layer it follows in the drawing order, null for
     * the first. A changed layer stays where it is.
     */
    after?: Id | null;
}

/** How many vertices, elements, groups and layers a patch names; what the limit of a message counts. */
export function patchSize(patch: DocumentPatch): number {
    return (
        patch.vertices.length +
        patch.removedVertexIds.length +
        patch.elements.length +
        patch.removedElementIds.length +
        patch.groups.length +
        patch.removedGroupIds.length +
        patch.layers.length +
        patch.removedLayerIds.length +
        patch.styles.length +
        patch.removedStyleIds.length
    );
}

/** The patch that turns `before` into `after`, or null if they do not differ in what a patch holds. */
export function diffDocuments(before: CadDocument, after: CadDocument, changedElementIds: readonly Id[]): DocumentPatch | null {
    const vertices = diffById(before.vertices, after.vertices, (a, b) => a.x === b.x && a.y === b.y);
    const groups = diffById(before.groups, after.groups, sameJson);
    const elements = diffOrdered(before.elements, after.elements);
    const layers = diffOrdered(before.layers, after.layers);
    const styles = diffById(before.styles, after.styles, sameJson);
    const patch: DocumentPatch = {
        planId: after.id,
        vertices: vertices.changed,
        removedVertexIds: vertices.removed,
        elements: elements.changed.map(({ item, after }) => (after === undefined ? { element: item } : { element: item, after })),
        removedElementIds: elements.removed,
        groups: groups.changed,
        removedGroupIds: groups.removed,
        layers: layers.changed.map(({ item, after }) => (after === undefined ? { layer: item } : { layer: item, after })),
        removedLayerIds: layers.removed,
        styles: styles.changed,
        removedStyleIds: styles.removed,
        changedElementIds: [...changedElementIds],
    };
    return patchSize(patch) === 0 ? null : patch;
}

/**
 * The document with the patch applied, or null where it does not fit: another plan, or a result in
 * which an element would use a vertex, a group, a layer or a style that is not there, or a layer a floor
 * that is not there (the documents have drifted
 * apart, e.g. the sender changed something before this editor joined). Never throws on what a peer
 * sent, and never returns a document the renderer could not draw.
 */
export function applyDocumentPatch(doc: CadDocument, patch: DocumentPatch): DocumentChange | null {
    if (patch.planId !== doc.id) {
        return null;
    }
    const vertices = patchById(doc.vertices, patch.vertices, patch.removedVertexIds);
    const groups = patchById(doc.groups, patch.groups, patch.removedGroupIds);
    const elements = patchOrdered(
        doc.elements,
        patch.elements.map(({ element, after }) => ({ item: element, after })),
        patch.removedElementIds,
    );
    const layers = patchOrdered(
        doc.layers,
        patch.layers.map(({ layer, after }) => ({ item: layer, after })),
        patch.removedLayerIds,
    );
    const vertexIds = new Set(vertices.map(({ id }) => id));
    const groupIds = new Set(groups.map(({ id }) => id));
    const layerIds = new Set(layers.map(({ id }) => id));
    const styles = patchById(doc.styles, patch.styles, patch.removedStyleIds);
    const styleIds = new Set(styles.map(({ id }) => id));
    const fits = (element: CadElement) =>
        vertexRefs(element).every((id) => vertexIds.has(id)) &&
        (element.groupId === null || groupIds.has(element.groupId)) &&
        layerIds.has(element.layerId) &&
        (element.styleId === null || styleIds.has(element.styleId));
    // Removing can orphan any element, adding and changing only those of the patch
    const removes = patch.removedVertexIds.length > 0 || patch.removedGroupIds.length > 0 || patch.removedLayerIds.length > 0 || patch.removedStyleIds.length > 0;
    const toCheck = removes ? elements : patch.elements.map(({ element }) => element);
    if (!toCheck.every(fits) || !patch.layers.every(({ layer }) => doc.floors.some((floor) => floor.id === layer.floorId))) {
        return null;
    }
    return { document: { ...doc, vertices, elements, groups, layers, styles }, changedElementIds: patch.changedElementIds };
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

/** An item of a list whose order counts, with the item a new one follows (null for the first). */
interface Placed<T> {
    item: T;
    after?: Id | null;
}

/** For such a list: the new items in their order, each with the item it follows, then the changed ones. */
function diffOrdered<T extends { id: Id }>(before: readonly T[], after: readonly T[]): { changed: Placed<T>[]; removed: Id[] } {
    const { changed, removed } = diffById(before, after, sameJson);
    if (changed.length === 0) {
        return { changed: [], removed };
    }
    const known = new Set(before.map(({ id }) => id));
    const added = new Set(changed.filter(({ id }) => !known.has(id)).map(({ id }) => id));
    const placed: Placed<T>[] = [];
    if (added.size > 0) {
        after.forEach((item, index) => {
            if (added.has(item.id)) {
                placed.push({ item, after: index === 0 ? null : after[index - 1].id });
            }
        });
    }
    placed.push(...changed.filter(({ id }) => !added.has(id)).map((item) => ({ item })));
    return { changed: placed, removed };
}

/** Like patchById, but new items go behind the item they follow (at the end if that is unknown). */
function patchOrdered<T extends { id: Id }>(items: readonly T[], changed: readonly Placed<T>[], removedIds: readonly Id[]): T[] {
    if (changed.length === 0 && removedIds.length === 0) {
        return items as T[];
    }
    const removed = new Set(removedIds);
    const next = new Map(changed.map(({ item }) => [item.id, item]));
    const result: T[] = [];
    for (const item of items) {
        if (!removed.has(item.id)) {
            result.push(next.get(item.id) ?? item);
            next.delete(item.id);
        }
    }
    // Where the item added last went: a run of new items is one behind the other
    let last: { id: Id; index: number } | null = null;
    for (const { item, after } of changed) {
        if (!next.has(item.id)) {
            continue;
        }
        let index = result.length;
        if (after === null) {
            index = 0;
        } else if (after !== undefined) {
            const found = last?.id === after ? last.index : result.findLastIndex(({ id }) => id === after);
            index = found < 0 ? result.length : found + 1;
        }
        result.splice(index, 0, item);
        last = { id: item.id, index };
    }
    return result;
}

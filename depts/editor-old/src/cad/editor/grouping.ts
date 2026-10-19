import type { CadDocument } from '../model/CadDocument';
import type { Id } from '../model/Point';

/**
 * Elements that are selected together with the given one: all members of its group in
 * document order, or just the element itself if it is not grouped.
 */
export function selectionUnit(doc: CadDocument, elementId: Id): Id[] {
    const groupId = doc.elements.find((element) => element.id === elementId)?.groupId ?? null;
    if (groupId === null) {
        return [elementId];
    }
    return doc.elements.filter((element) => element.groupId === groupId).map((element) => element.id);
}

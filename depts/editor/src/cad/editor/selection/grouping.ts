import type { CadDocument } from '../../model/CadDocument';
import type { Id } from '../../model/Point';

/**
 * What a pick of each selectable element selects, like AutoCAD with group selection on
 * (PICKSTYLE 1): all selectable members of its group, or just the element itself.
 * `selectable` lists the selectable elements in drawing order; members on hidden or
 * locked layers are not in it and are left out of their group.
 */
export function buildSelectionUnits(doc: CadDocument, selectable: readonly Id[]): ReadonlyMap<Id, readonly Id[]> {
    const groupOf = new Map(doc.elements.map((element) => [element.id, element.groupId]));
    const members = new Map<Id, Id[]>();
    for (const id of selectable) {
        const groupId = groupOf.get(id) ?? null;
        if (groupId !== null) {
            members.set(groupId, [...(members.get(groupId) ?? []), id]);
        }
    }
    return new Map(
        selectable.map((id) => {
            const groupId = groupOf.get(id) ?? null;
            return [id, groupId === null ? [id] : members.get(groupId)!];
        }),
    );
}

/** The picked elements together with their group members, without duplicates. */
export function expandToUnits(picked: readonly Id[], units: ReadonlyMap<Id, readonly Id[]>): Id[] {
    const ids = new Set<Id>();
    for (const id of picked) {
        for (const member of units.get(id) ?? [id]) {
            ids.add(member);
        }
    }
    return [...ids];
}

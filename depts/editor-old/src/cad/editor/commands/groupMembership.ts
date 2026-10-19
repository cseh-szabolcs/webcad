import type { CadDocument } from '../../model/CadDocument';
import type { Group } from '../../model/Group';
import type { Id } from '../../model/Point';
import { partitionEmptiedGroups, restore, type Removed } from './removal';

/** What `assignGroup` changed, so `revertGroupAssignment` can undo it exactly. */
export interface GroupAssignment {
    previousGroupIds: ReadonlyMap<Id, Id | null>;
    removedGroups: Removed<Group>[];
}

/**
 * Moves the elements into `groupId` (or out of any group for null) and removes the groups
 * that lose their last member by it.
 */
export function assignGroup(
    doc: CadDocument,
    elementIds: ReadonlySet<Id>,
    groupId: Id | null,
): { document: CadDocument; assignment: GroupAssignment } {
    const previousGroupIds = new Map<Id, Id | null>();
    const elements = doc.elements.map((element) => {
        if (!elementIds.has(element.id)) {
            return element;
        }
        previousGroupIds.set(element.id, element.groupId);
        return { ...element, groupId };
    });
    const [groups, removedGroups] = partitionEmptiedGroups(doc.groups, elements, previousGroupIds.values());
    return { document: { ...doc, elements, groups }, assignment: { previousGroupIds, removedGroups } };
}

export function revertGroupAssignment(doc: CadDocument, { previousGroupIds, removedGroups }: GroupAssignment): CadDocument {
    const elements = doc.elements.map((element) => {
        const groupId = previousGroupIds.get(element.id);
        return groupId === undefined ? element : { ...element, groupId };
    });
    return { ...doc, elements, groups: restore(doc.groups, removedGroups) };
}

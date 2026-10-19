import type { CadElement } from '../../model/CadElement';
import type { Group } from '../../model/Group';
import type { Id } from '../../model/Point';

/** An item a command removed, with its index so undo can put it back in place. */
export interface Removed<T> {
    index: number;
    item: T;
}

export function partition<T>(items: T[], remove: (item: T) => boolean): [T[], Removed<T>[]] {
    const kept: T[] = [];
    const removed: Removed<T>[] = [];
    items.forEach((item, index) => (remove(item) ? removed.push({ index, item }) : kept.push(item)));
    return [kept, removed];
}

/** Re-inserts removed items; `removed` is in ascending index order. */
export function restore<T>(items: T[], removed: Removed<T>[]): T[] {
    const result = [...items];
    for (const { index, item } of removed) {
        result.splice(index, 0, item);
    }
    return result;
}

/**
 * Removes the groups among `candidates` that no element references any more. Groups that
 * were already empty before the command are left alone.
 */
export function partitionEmptiedGroups(
    groups: Group[],
    elements: CadElement[],
    candidates: Iterable<Id | null>,
): [Group[], Removed<Group>[]] {
    const candidateIds = new Set(candidates);
    const stillUsed = new Set(elements.map((element) => element.groupId));
    return partition(groups, (group) => candidateIds.has(group.id) && !stillUsed.has(group.id));
}

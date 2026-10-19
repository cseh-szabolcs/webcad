import type { CadDocument } from '../../model/CadDocument';
import type { Id } from '../../model/Point';
import type { Command, CommandResult } from './Command';
import { assignGroup, revertGroupAssignment, type GroupAssignment } from './groupMembership';

/**
 * Dissolves every group one of the given elements belongs to: all its members become
 * ungrouped, not just the given ones, and the group is removed. Undo restores both.
 */
export class UngroupCommand implements Command {
    readonly label = 'Ungroup';
    private readonly ids: ReadonlySet<Id>;
    private assignment: GroupAssignment = { previousGroupIds: new Map(), removedGroups: [] };

    constructor(ids: Iterable<Id>) {
        this.ids = new Set(ids);
    }

    execute(doc: CadDocument): CommandResult {
        const groupIds = new Set(
            doc.elements.filter((element) => this.ids.has(element.id)).map((element) => element.groupId),
        );
        groupIds.delete(null);
        const members = new Set(
            doc.elements.filter((element) => groupIds.has(element.groupId)).map((element) => element.id),
        );
        const { document, assignment } = assignGroup(doc, members, null);
        this.assignment = assignment;
        return { document, changedElementIds: [...members] };
    }

    undo(doc: CadDocument): CommandResult {
        return {
            document: revertGroupAssignment(doc, this.assignment),
            changedElementIds: [...this.assignment.previousGroupIds.keys()],
        };
    }
}

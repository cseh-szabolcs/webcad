import type { CadDocument } from '../../model/CadDocument';
import type { Group } from '../../model/Group';
import type { Id } from '../../model/Point';
import type { Command, CommandResult } from './Command';
import { assignGroup, revertGroupAssignment, type GroupAssignment } from './groupMembership';

/**
 * Puts elements into a new group, appended to the document's groups. Elements that were in
 * another group leave it, and groups left without members are removed (so grouping two
 * groups merges them). Undo restores the previous memberships and groups.
 */
export class GroupElementsCommand implements Command {
    readonly label = 'Group';
    private readonly ids: ReadonlySet<Id>;
    private readonly group: Group;
    private assignment: GroupAssignment = { previousGroupIds: new Map(), removedGroups: [] };

    constructor(ids: Iterable<Id>, group: Group) {
        this.ids = new Set(ids);
        this.group = group;
    }

    execute(doc: CadDocument): CommandResult {
        const { document, assignment } = assignGroup(doc, this.ids, this.group.id);
        this.assignment = assignment;
        return {
            document: { ...document, groups: [...document.groups, this.group] },
            changedElementIds: [...assignment.previousGroupIds.keys()],
        };
    }

    undo(doc: CadDocument): CommandResult {
        const withoutGroup = { ...doc, groups: doc.groups.filter((group) => group.id !== this.group.id) };
        return {
            document: revertGroupAssignment(withoutGroup, this.assignment),
            changedElementIds: [...this.assignment.previousGroupIds.keys()],
        };
    }
}

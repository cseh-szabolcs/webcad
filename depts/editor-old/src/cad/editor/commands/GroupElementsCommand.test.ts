import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { parseDocument } from '../../persistence/CadSerializer';
import { GroupElementsCommand } from './GroupElementsCommand';

const { element: E, group: G } = sampleIds;

const doc = parseDocument(samplePlan);
const group = { id: '00000000-0000-7000-8000-000000000302', name: 'Group 1' };
const groupOf = (d: typeof doc, id: string) => d.elements.find((e) => e.id === id)!.groupId;

describe('GroupElementsCommand', () => {
    it('puts the elements into a new group appended to the groups', () => {
        const { document, changedElementIds } = new GroupElementsCommand([E.table, E.sofa], group).execute(doc);

        expect(groupOf(document, E.table)).toBe(group.id);
        expect(groupOf(document, E.sofa)).toBe(group.id);
        expect(groupOf(document, E.window)).toBeNull();
        expect(document.groups).toEqual([...doc.groups, group]);
        expect(changedElementIds).toEqual([E.table, E.sofa]);
        expect(() => parseDocument(document)).not.toThrow();
    });

    it('merges an existing group and removes it once it has no members left', () => {
        const ids = [E['door-leaf'], E['door-swing'], E.window];
        const { document } = new GroupElementsCommand(ids, group).execute(doc);

        expect(ids.map((id) => groupOf(document, id))).toEqual([group.id, group.id, group.id]);
        expect(document.groups).toEqual([group]);
    });

    it('keeps a group that still has members outside the new group', () => {
        const { document } = new GroupElementsCommand([E['door-swing'], E.window], group).execute(doc);

        expect(groupOf(document, E['door-leaf'])).toBe(G['door-d1']);
        expect(document.groups.map((g) => g.id)).toEqual([G['door-d1'], group.id]);
    });

    it('restores the exact document on undo and does not mutate its input', () => {
        const before = structuredClone(doc);
        const command = new GroupElementsCommand([E['door-leaf'], E['door-swing'], E.table], group);
        const grouped = command.execute(doc).document;

        expect(doc).toEqual(before);
        expect(command.undo(grouped).document).toEqual(doc);
    });
});

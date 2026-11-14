import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { applyDocumentPatch, diffDocuments } from './DocumentPatch';
import { EraseCommand } from './EraseCommand';
import { MoveCommand } from './MoveCommand';

const { element: E, vertex: V, group: G } = sampleIds;
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe('EraseCommand', () => {
    it('removes the elements with the vertices only they use', () => {
        const before = parseDocument(samplePlan);
        const { document, changedElementIds } = new EraseCommand([E.sofa]).execute(before);
        expect(changedElementIds).toEqual([E.sofa]);
        expect(ids(document.elements)).toEqual(ids(before.elements).filter((id) => id !== E.sofa));
        const gone = [V['s-1'], V['s-2'], V['s-3'], V['s-4']];
        expect(ids(document.vertices)).toEqual(ids(before.vertices).filter((id) => !gone.includes(id as never)));
        expect(document.groups).toBe(before.groups);
    });

    it('keeps a vertex another element still uses', () => {
        // The table and the rug share their centre
        const before = parseDocument(samplePlan);
        const { document } = new EraseCommand([E.table]).execute(before);
        expect(document.vertices).toBe(before.vertices);
        expect(ids(new EraseCommand([E.table, E.rug]).execute(before).document.vertices)).not.toContain(V['t-center']);
    });

    it('removes a group only once it is empty', () => {
        const before = parseDocument(samplePlan);
        const leaf = new EraseCommand([E['door-leaf']]).execute(before).document;
        expect(ids(leaf.groups)).toContain(G['door-d1']);
        // The hinge and the open end stay with the swing
        expect(ids(leaf.vertices)).toEqual(ids(before.vertices));
        const door = new EraseCommand([E['door-leaf'], E['door-swing']]).execute(before).document;
        expect(ids(door.groups)).not.toContain(G['door-d1']);
    });

    it('undo puts everything back where it was', () => {
        const before = parseDocument(samplePlan);
        const command = new EraseCommand([E.sofa, E['door-leaf'], E['door-swing'], E['wall-outer']]);
        const { document } = command.execute(before);
        const undone = command.undo(document);
        expect(undone.document).toEqual(before);
        expect(new Set(undone.changedElementIds)).toEqual(new Set([E.sofa, E['door-leaf'], E['door-swing'], E['wall-outer']]));
        expect(command.execute(undone.document).document).toEqual(document);
    });

    it('undo keeps what changed elsewhere meanwhile', () => {
        const before = parseDocument(samplePlan);
        const command = new EraseCommand([E.sofa]);
        const erased = command.execute(before).document;
        const moved = new MoveCommand([E.window], { x: 0, y: 100 }).execute(erased).document;
        const undone = command.undo(moved).document;
        expect(ids(undone.elements)).toEqual(ids(before.elements));
        expect(undone.vertices.find((vertex) => vertex.id === V['win-1'])).toMatchObject({ y: 3980 });
    });

    it('changes nothing without any of the elements', () => {
        const before = parseDocument(samplePlan);
        const command = new EraseCommand(['unknown']);
        expect(command.execute(before)).toEqual({ document: before, changedElementIds: [] });
        expect(command.undo(before).document).toBe(before);
    });

    it('travels as a patch, and so does its undo', () => {
        const before = parseDocument(samplePlan);
        const command = new EraseCommand([E['door-leaf'], E['door-swing']]);
        const erased = command.execute(before);
        const patch = diffDocuments(before, erased.document, erased.changedElementIds)!;
        expect(applyDocumentPatch(before, patch)!.document).toEqual(erased.document);
        const undone = command.undo(erased.document);
        const back = diffDocuments(erased.document, undone.document, undone.changedElementIds)!;
        const received = applyDocumentPatch(erased.document, back)!.document;
        expect(received.elements).toEqual(before.elements);
        // A patch keeps the order of the elements only; vertices and groups come back at the end
        expect(new Set(received.groups)).toEqual(new Set(before.groups));
        expect(new Set(received.vertices)).toEqual(new Set(before.vertices));
    });
});

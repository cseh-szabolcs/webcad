import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { parseDocument } from '../../persistence/CadSerializer';
import { UngroupCommand } from './UngroupCommand';

const { element: E } = sampleIds;

const doc = parseDocument(samplePlan);
const groupOf = (d: typeof doc, id: string) => d.elements.find((e) => e.id === id)!.groupId;

describe('UngroupCommand', () => {
    it('dissolves the whole group, even if only one member is given', () => {
        const { document, changedElementIds } = new UngroupCommand([E['door-swing']]).execute(doc);

        expect(groupOf(document, E['door-leaf'])).toBeNull();
        expect(groupOf(document, E['door-swing'])).toBeNull();
        expect(document.groups).toEqual([]);
        expect(changedElementIds).toEqual([E['door-leaf'], E['door-swing']]);
    });

    it('changes nothing for ungrouped elements', () => {
        const { document, changedElementIds } = new UngroupCommand([E.table]).execute(doc);

        expect(document).toEqual(doc);
        expect(changedElementIds).toEqual([]);
    });

    it('restores the exact document on undo and does not mutate its input', () => {
        const before = structuredClone(doc);
        const command = new UngroupCommand([E['door-leaf'], E.table]);
        const ungrouped = command.execute(doc).document;

        expect(doc).toEqual(before);
        expect(command.undo(ungrouped).document).toEqual(doc);
    });
});

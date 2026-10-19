import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { parseDocument } from '../../persistence/CadSerializer';
import { DeleteElementsCommand } from './DeleteElementsCommand';

const { vertex: V, element: E } = sampleIds;

const doc = parseDocument(samplePlan);
const vertexIds = (d: typeof doc) => d.vertices.map((v) => v.id);
const elementIds = (d: typeof doc) => d.elements.map((e) => e.id);

describe('DeleteElementsCommand', () => {
    it('removes the element and its orphaned vertices but keeps shared ones', () => {
        const { document, changedElementIds } = new DeleteElementsCommand([E['door-leaf'], E.table]).execute(doc);

        expect(elementIds(document)).not.toContain(E['door-leaf']);
        expect(vertexIds(document)).not.toContain(V['t-center']);
        // still used by door-swing
        expect(vertexIds(document)).toContain(V['d-hinge']);
        expect(vertexIds(document)).toContain(V['d-open']);
        expect(changedElementIds).toEqual([E['door-leaf'], E.table]);
    });

    it('removes a shared vertex once no element uses it', () => {
        const { document } = new DeleteElementsCommand([E['door-leaf'], E['door-swing']]).execute(doc);

        expect(vertexIds(document)).not.toContain(V['d-open']);
        expect(vertexIds(document)).not.toContain(V['d-closed']);
        expect(vertexIds(document)).not.toContain(V['d-hinge']);
    });

    it('removes a group with its last member and keeps it while members remain', () => {
        expect(new DeleteElementsCommand([E['door-leaf']]).execute(doc).document.groups).toEqual(doc.groups);

        const command = new DeleteElementsCommand([E['door-leaf'], E['door-swing']]);
        const deleted = command.execute(doc).document;
        expect(deleted.groups).toEqual([]);
        expect(command.undo(deleted).document).toEqual(doc);
    });

    it('does not mutate the input document', () => {
        const before = structuredClone(doc);
        new DeleteElementsCommand([E.table, E.sofa]).execute(doc);
        expect(doc).toEqual(before);
    });

    it('restores the exact document on undo, including order', () => {
        const command = new DeleteElementsCommand([E['wall-inner'], E['door-swing'], E.axis]);
        const deleted = command.execute(doc).document;
        const restored = command.undo(deleted);

        expect(restored.document).toEqual(doc);
        expect(restored.changedElementIds).toEqual([E['wall-inner'], E['door-swing'], E.axis]);
    });

    it('labels single and multiple deletions', () => {
        expect(new DeleteElementsCommand(['a']).label).toBe('Delete element');
        expect(new DeleteElementsCommand(['a', 'b']).label).toBe('Delete 2 elements');
    });
});

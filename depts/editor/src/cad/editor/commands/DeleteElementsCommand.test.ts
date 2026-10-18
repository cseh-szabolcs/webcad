import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { parseDocument } from '../../persistence/CadSerializer';
import { DeleteElementsCommand } from './DeleteElementsCommand';

const doc = parseDocument(samplePlan);
const vertexIds = (d: typeof doc) => d.vertices.map((v) => v.id);
const elementIds = (d: typeof doc) => d.elements.map((e) => e.id);

describe('DeleteElementsCommand', () => {
    it('removes the element and its orphaned vertices but keeps shared ones', () => {
        const { document, changedElementIds } = new DeleteElementsCommand(['door-leaf']).execute(doc);

        expect(elementIds(document)).not.toContain('door-leaf');
        expect(vertexIds(document)).not.toContain('d-hinge');
        expect(vertexIds(document)).toContain('d-open'); // still used by door-swing
        expect(changedElementIds).toEqual(['door-leaf']);
    });

    it('removes a shared vertex once no element uses it', () => {
        const { document } = new DeleteElementsCommand(['door-leaf', 'door-swing']).execute(doc);

        expect(vertexIds(document)).not.toContain('d-open');
        expect(vertexIds(document)).not.toContain('d-closed');
        expect(vertexIds(document)).not.toContain('d-hinge');
    });

    it('does not mutate the input document', () => {
        const before = structuredClone(doc);
        new DeleteElementsCommand(['table', 'sofa']).execute(doc);
        expect(doc).toEqual(before);
    });

    it('restores the exact document on undo, including order', () => {
        const command = new DeleteElementsCommand(['wall-inner', 'door-swing', 'axis']);
        const deleted = command.execute(doc).document;
        const restored = command.undo(deleted);

        expect(restored.document).toEqual(doc);
        expect(restored.changedElementIds).toEqual(['wall-inner', 'door-swing', 'axis']);
    });

    it('labels single and multiple deletions', () => {
        expect(new DeleteElementsCommand(['a']).label).toBe('Delete element');
        expect(new DeleteElementsCommand(['a', 'b']).label).toBe('Delete 2 elements');
    });
});

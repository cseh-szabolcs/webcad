import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { parseDocument } from '../../persistence/CadSerializer';
import { MoveVerticesCommand } from './MoveVerticesCommand';

const { vertex: V, element: E } = sampleIds;

const doc = parseDocument(samplePlan);

describe('MoveVerticesCommand', () => {
    it('translates the vertices', () => {
        const { document } = new MoveVerticesCommand([V['t-center']], { x: 100, y: -50 }).execute(doc);
        expect(document.vertices.find((v) => v.id === V['t-center'])).toEqual({ id: V['t-center'], x: 4100, y: 1750 });
    });

    it('reports every element that references a moved vertex', () => {
        const { changedElementIds } = new MoveVerticesCommand([V['d-open']], { x: 10, y: 0 }).execute(doc);
        expect(changedElementIds).toEqual([E['door-leaf'], E['door-swing']]);
    });

    it('restores the exact document on undo without mutating its input', () => {
        const before = structuredClone(doc);
        const command = new MoveVerticesCommand([V['w-o1'], V['w-o2'], V['d-open']], { x: 12.5, y: -7 });
        const moved = command.execute(doc).document;

        expect(doc).toEqual(before);
        expect(command.undo(moved).document).toEqual(doc);
    });

    it('uses the given label', () => {
        expect(new MoveVerticesCommand([], { x: 0, y: 0 }).label).toBe('Move');
        expect(new MoveVerticesCommand([], { x: 0, y: 0 }, 'Move vertex').label).toBe('Move vertex');
    });
});

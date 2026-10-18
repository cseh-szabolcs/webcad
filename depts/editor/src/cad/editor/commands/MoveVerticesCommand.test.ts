import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { parseDocument } from '../../persistence/CadSerializer';
import { MoveVerticesCommand } from './MoveVerticesCommand';

const doc = parseDocument(samplePlan);

describe('MoveVerticesCommand', () => {
    it('translates the vertices', () => {
        const { document } = new MoveVerticesCommand(['t-center'], { x: 100, y: -50 }).execute(doc);
        expect(document.vertices.find((v) => v.id === 't-center')).toEqual({ id: 't-center', x: 4100, y: 1750 });
    });

    it('reports every element that references a moved vertex', () => {
        const { changedElementIds } = new MoveVerticesCommand(['d-open'], { x: 10, y: 0 }).execute(doc);
        expect(changedElementIds).toEqual(['door-leaf', 'door-swing']);
    });

    it('restores the exact document on undo without mutating its input', () => {
        const before = structuredClone(doc);
        const command = new MoveVerticesCommand(['w-o1', 'w-o2', 'd-open'], { x: 12.5, y: -7 });
        const moved = command.execute(doc).document;

        expect(doc).toEqual(before);
        expect(command.undo(moved).document).toEqual(doc);
    });

    it('uses the given label', () => {
        expect(new MoveVerticesCommand([], { x: 0, y: 0 }).label).toBe('Move');
        expect(new MoveVerticesCommand([], { x: 0, y: 0 }, 'Move vertex').label).toBe('Move vertex');
    });
});

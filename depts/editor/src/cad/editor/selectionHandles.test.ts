import { describe, expect, it } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { parseDocument } from '../persistence/CadSerializer';
import { selectionHandles } from './selectionHandles';

const doc = parseDocument(samplePlan);
const handleIds = (...ids: string[]) => selectionHandles(doc, new Set(ids)).map((v) => v.id);

describe('selectionHandles', () => {
    it('returns the vertices of each element type', () => {
        expect(handleIds('door-leaf')).toEqual(['d-hinge', 'd-open']);
        expect(handleIds('door-swing')).toEqual(['d-closed', 'd-open']);
        expect(handleIds('table')).toEqual(['t-center']);
        expect(handleIds('sofa')).toEqual(['s-1', 's-2', 's-3', 's-4']);
    });

    it('lists shared vertices once', () => {
        expect(handleIds('door-leaf', 'door-swing')).toEqual(['d-hinge', 'd-closed', 'd-open']);
    });

    it('returns nothing for an empty selection', () => {
        expect(handleIds()).toEqual([]);
    });
});

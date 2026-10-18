import { describe, expect, it } from 'vitest';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { indexDocument, requireVertex } from './DocumentIndex';

describe('indexDocument', () => {
    const index = indexDocument(parseDocument(samplePlan));

    it('resolves every collection by id', () => {
        expect(index.vertices.get('d-open')).toEqual({ id: 'd-open', x: 1000, y: 1140 });
        expect(index.elements.get('table')?.type).toBe('circle');
        expect(index.layers.get('walls')?.name).toBe('Walls');
        expect(index.groups.get('door-d1')?.name).toBe('Door D1');
        expect(index.styles.get('hidden')?.dashPattern).toEqual([8, 4]);
    });

    it('throws for an unknown vertex', () => {
        expect(() => requireVertex(index, 'missing')).toThrow('Unknown vertex "missing"');
    });
});

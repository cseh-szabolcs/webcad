import { describe, expect, it } from 'vitest';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { indexDocument, requireVertex } from './DocumentIndex';

const { vertex: V, element: E, layer: L, group: G, style: S } = sampleIds;

describe('indexDocument', () => {
    const index = indexDocument(parseDocument(samplePlan));

    it('resolves every collection by id', () => {
        expect(index.vertices.get(V['d-open'])).toEqual({ id: V['d-open'], x: 1000, y: 1140 });
        expect(index.elements.get(E.table)?.type).toBe('ellipse');
        expect(index.layers.get(L.walls)?.name).toBe('Walls');
        expect(index.groups.get(G['door-d1'])?.name).toBe('Door D1');
        expect(index.styles.get(S.hidden)?.dashPattern).toEqual([8, 4]);
    });

    it('throws for an unknown vertex', () => {
        expect(() => requireVertex(index, 'missing')).toThrow('Unknown vertex "missing"');
    });
});

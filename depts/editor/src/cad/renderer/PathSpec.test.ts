import { describe, expect, it } from 'vitest';
import { indexDocument } from '../model/DocumentIndex';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { buildPathSpec } from './PathSpec';

const doc = parseDocument(samplePlan);
const index = indexDocument(doc);
const element = (id: string) => index.elements.get(id)!;

describe('buildPathSpec', () => {
    it('builds a line from its vertices', () => {
        const spec = buildPathSpec(element('door-leaf'), index);
        expect(spec.closed).toBe(false);
        expect(spec.segments.map((s) => s.point)).toMatchObject([{ x: 1000, y: 240 }, { x: 1000, y: 1140 }]);
    });

    it('keeps bezier controls relative to their end vertices', () => {
        const spec = buildPathSpec(element('door-swing'), index);
        expect(spec.segments[0]).toMatchObject({ point: { x: 1900, y: 240 }, handleOut: { x: 0, y: 497.056 } });
        expect(spec.segments[1]).toMatchObject({ point: { x: 1000, y: 1140 }, handleIn: { x: 497.056, y: 0 } });
    });

    it('builds a closed four-segment circle through its quadrants', () => {
        const spec = buildPathSpec(element('table'), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments.map((s) => s.point)).toEqual([
            { x: 4600, y: 1800 },
            { x: 4000, y: 2400 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1200 },
        ]);
    });

    it('builds a polyline in vertex order', () => {
        const spec = buildPathSpec(element('wall-outer'), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments).toHaveLength(4);
    });
});

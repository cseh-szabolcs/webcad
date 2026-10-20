import { describe, expect, it } from 'vitest';
import type { CircleElement, EllipseElement } from '../model/CadElement';
import { indexDocument } from '../model/DocumentIndex';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { buildPathSpec } from './PathSpec';

const { element: E } = sampleIds;

const doc = parseDocument(samplePlan);
const index = indexDocument(doc);
const element = (id: string) => index.elements.get(id)!;

describe('buildPathSpec', () => {
    it('builds a line from its vertices', () => {
        const spec = buildPathSpec(element(E['door-leaf']), index);
        expect(spec.closed).toBe(false);
        expect(spec.segments.map((s) => s.point)).toMatchObject([{ x: 1000, y: 240 }, { x: 1000, y: 1140 }]);
    });

    it('keeps bezier controls relative to their end vertices', () => {
        const spec = buildPathSpec(element(E.curtain), index);
        expect(spec.closed).toBe(false);
        expect(spec.segments[0]).toMatchObject({ point: { x: 3500, y: 3700 }, handleOut: { x: 500, y: -200 } });
        expect(spec.segments[1]).toMatchObject({ point: { x: 5000, y: 3700 }, handleIn: { x: -500, y: -200 } });
    });

    it('builds an open arc from start to end', () => {
        const spec = buildPathSpec(element(E['door-swing']), index);
        expect(spec.closed).toBe(false);
        expect(spec.segments).toHaveLength(2);
        expect(spec.segments[0].point).toEqual({ x: 1900, y: 240 });
        expect(spec.segments[1].point.x).toBeCloseTo(1000, 6);
        expect(spec.segments[1].point.y).toBeCloseTo(1140, 6);
    });

    it('builds a closed four-segment circle through its quadrants', () => {
        const spec = buildPathSpec(element(E.table), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments.map((s) => s.point)).toEqual([
            { x: 4600, y: 1800 },
            { x: 4000, y: 2400 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1200 },
        ]);
    });

    it('builds a circle like an ellipse with equal radii', () => {
        const { radius: _radius, ...rest } = element(E.table) as CircleElement;
        const ellipse: EllipseElement = { ...rest, type: 'ellipse', radiusX: 600, radiusY: 600 };
        expect(buildPathSpec(ellipse, index)).toEqual(buildPathSpec(element(E.table), index));
    });

    it('scales the bezier handles per axis for unequal radii', () => {
        const spec = buildPathSpec(element(E.rug), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments.map((s) => s.point)).toEqual([
            { x: 5000, y: 1800 },
            { x: 4000, y: 2500 },
            { x: 3000, y: 1800 },
            { x: 4000, y: 1100 },
        ]);
        expect(spec.segments[0].handleOut!.y).toBeCloseTo(386.599, 3);
        expect(spec.segments[1].handleOut!.x).toBeCloseTo(-552.285, 3);
    });

    it('builds a polyline in vertex order', () => {
        const spec = buildPathSpec(element(E['wall-outer']), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments).toHaveLength(4);
    });
});

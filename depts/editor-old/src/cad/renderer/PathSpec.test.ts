import { describe, expect, it } from 'vitest';
import type { CubicBezierElement, EllipseElement } from '../model/CadElement';
import { indexDocument } from '../model/DocumentIndex';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { buildPathSpec } from './PathSpec';

const { vertex: V, element: E } = sampleIds;

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
        const bezier: CubicBezierElement = {
            ...element(E['door-leaf']),
            type: 'bezier',
            startVertexId: V['d-closed'],
            endVertexId: V['d-open'],
            startControl: { x: 0, y: 497 },
            endControl: { x: 497, y: 0 },
        } as CubicBezierElement;
        const spec = buildPathSpec(bezier, index);
        expect(spec.segments[0]).toMatchObject({ point: { x: 1900, y: 240 }, handleOut: { x: 0, y: 497 } });
        expect(spec.segments[1]).toMatchObject({ point: { x: 1000, y: 1140 }, handleIn: { x: 497, y: 0 } });
    });

    it('builds an open arc from start to end', () => {
        const spec = buildPathSpec(element(E['door-swing']), index);
        expect(spec.closed).toBe(false);
        expect(spec.segments).toHaveLength(2);
        expect(spec.segments[0].point).toEqual({ x: 1900, y: 240 });
        expect(spec.segments[1].point.x).toBeCloseTo(1000, 6);
        expect(spec.segments[1].point.y).toBeCloseTo(1140, 6);
    });

    it('builds a closed four-segment ellipse through its quadrants', () => {
        const spec = buildPathSpec(element(E.table), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments.map((s) => s.point)).toEqual([
            { x: 4600, y: 1800 },
            { x: 4000, y: 2400 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1200 },
        ]);
    });

    it('scales the bezier handles per axis for unequal radii', () => {
        const ellipse: EllipseElement = { ...(element(E.table) as EllipseElement), radiusY: 300 };
        const spec = buildPathSpec(ellipse, index);
        expect(spec.closed).toBe(true);
        expect(spec.segments.map((s) => s.point)).toEqual([
            { x: 4600, y: 1800 },
            { x: 4000, y: 2100 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1500 },
        ]);
        expect(spec.segments[0].handleOut!.y).toBeCloseTo(165.685, 3);
        expect(spec.segments[1].handleOut!.x).toBeCloseTo(-331.371, 3);
    });

    it('builds a polyline in vertex order', () => {
        const spec = buildPathSpec(element(E['wall-outer']), index);
        expect(spec.closed).toBe(true);
        expect(spec.segments).toHaveLength(4);
    });
});

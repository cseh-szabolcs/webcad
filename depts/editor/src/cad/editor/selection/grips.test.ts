import { describe, expect, it } from 'vitest';
import { indexDocument } from '../../model/DocumentIndex';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { elementGrips, selectionGrips } from './grips';

const { element: E } = sampleIds;

const index = indexDocument(parseDocument(samplePlan));
const element = (id: string) => index.elements.get(id)!;
const round = (points: Point[]) => points.map((p) => ({ x: Math.round(p.x * 1000) / 1000 + 0, y: Math.round(p.y * 1000) / 1000 + 0 }));

describe('elementGrips', () => {
    it('gives a line its ends and midpoint', () => {
        expect(elementGrips(element(E['door-leaf']), index)).toEqual([
            { x: 1000, y: 240 },
            { x: 1000, y: 1140 },
            { x: 1000, y: 690 },
        ]);
    });

    it('gives a closed polyline its vertices and all segment midpoints', () => {
        expect(elementGrips(element(E['wall-outer']), index)).toEqual([
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
            { x: 3000, y: 0 },
            { x: 6000, y: 2000 },
            { x: 3000, y: 4000 },
            { x: 0, y: 2000 },
        ]);
    });

    it('gives an open polyline no closing midpoint', () => {
        const sofa = element(E.sofa);
        const open = { ...sofa, closed: false } as typeof sofa;
        expect(elementGrips(open, index)).toHaveLength(4 + 3);
    });

    it('gives a circle its centre and quadrants', () => {
        expect(elementGrips(element(E.table), index)).toEqual([
            { x: 4000, y: 1800 },
            { x: 4600, y: 1800 },
            { x: 4000, y: 2400 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1200 },
        ]);
    });

    it('gives an ellipse its centre and axis ends', () => {
        expect(elementGrips(element(E.rug), index)).toEqual([
            { x: 4000, y: 1800 },
            { x: 5000, y: 1800 },
            { x: 4000, y: 2500 },
            { x: 3000, y: 1800 },
            { x: 4000, y: 1100 },
        ]);
    });

    it('puts the arc grips on the arc: centre, start, end and middle', () => {
        const r = 900 / Math.SQRT2;
        expect(round(elementGrips(element(E['door-swing']), index))).toEqual(
            round([
                { x: 1000, y: 240 },
                { x: 1900, y: 240 },
                { x: 1000, y: 1140 },
                { x: 1000 + r, y: 240 + r },
            ]),
        );
    });

    it('takes only the angle from an arc end vertex that lies off the arc', () => {
        const swing = element(E['door-swing']);
        const moved = indexDocument({
            ...parseDocument(samplePlan),
            vertices: parseDocument(samplePlan).vertices.map((v) =>
                v.id === sampleIds.vertex['d-open'] ? { ...v, y: 3000 } : v,
            ),
        });
        expect(round(elementGrips(swing, moved))[2]).toEqual({ x: 1000, y: 1140 });
    });

    it('gives a bezier its ends and absolute control points', () => {
        expect(elementGrips(element(E.curtain), index)).toEqual([
            { x: 3500, y: 3700 },
            { x: 5000, y: 3700 },
            { x: 4000, y: 3500 },
            { x: 4500, y: 3500 },
        ]);
    });
});

describe('selectionGrips', () => {
    it('shows a shared position only once', () => {
        // Door leaf and swing share the hinge (1000, 240) and the open end (1000, 1140)
        const grips = selectionGrips([element(E['door-leaf']), element(E['door-swing'])], index);
        expect(grips).toHaveLength(3 + 4 - 2);
    });
});

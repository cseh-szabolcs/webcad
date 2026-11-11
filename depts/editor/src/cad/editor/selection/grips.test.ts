import { describe, expect, it } from 'vitest';
import { indexDocument } from '../../model/DocumentIndex';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { elementGrips, gripAt, selectionControlFrames, selectionGrips } from './grips';

const { element: E } = sampleIds;

const index = indexDocument(parseDocument(samplePlan));
const element = (id: string) => index.elements.get(id)!;
/** Grip positions only. */
const points = (...args: Parameters<typeof elementGrips>) => elementGrips(...args).map((grip) => grip.point);
const parts = (...args: Parameters<typeof elementGrips>) => elementGrips(...args).map((grip) => grip.targets[0].part);
const round = (points: Point[]) => points.map((p) => ({ x: Math.round(p.x * 1000) / 1000 + 0, y: Math.round(p.y * 1000) / 1000 + 0 }));

describe('elementGrips', () => {
    it('gives a line its ends and midpoint', () => {
        expect(points(element(E['door-leaf']), index)).toEqual([
            { x: 1000, y: 240 },
            { x: 1000, y: 1140 },
            { x: 1000, y: 690 },
        ]);
    });

    it('gives a closed polyline its vertices and all segment midpoints', () => {
        expect(points(element(E['wall-outer']), index)).toEqual([
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
        expect(points(open, index)).toHaveLength(4 + 3);
    });

    it('gives a circle its centre and quadrants', () => {
        expect(points(element(E.table), index)).toEqual([
            { x: 4000, y: 1800 },
            { x: 4600, y: 1800 },
            { x: 4000, y: 2400 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1200 },
        ]);
    });

    it('gives an ellipse its centre and axis ends', () => {
        expect(points(element(E.rug), index)).toEqual([
            { x: 4000, y: 1800 },
            { x: 5000, y: 1800 },
            { x: 4000, y: 2500 },
            { x: 3000, y: 1800 },
            { x: 4000, y: 1100 },
        ]);
    });

    it('turns the axis ends of a rotated ellipse', () => {
        const rug = element(E.rug);
        const c = Math.cos(Math.PI / 6);
        const s = Math.sin(Math.PI / 6);
        expect(round(points({ ...rug, rotation: Math.PI / 6 } as typeof rug, index))).toEqual(
            round([
                { x: 4000, y: 1800 },
                { x: 4000 + 1000 * c, y: 1800 + 1000 * s },
                { x: 4000 - 700 * s, y: 1800 + 700 * c },
                { x: 4000 - 1000 * c, y: 1800 - 1000 * s },
                { x: 4000 + 700 * s, y: 1800 - 700 * c },
            ]),
        );
    });

    it('puts the arc grips on the arc: centre, start, end and middle', () => {
        const r = 900 / Math.SQRT2;
        expect(round(points(element(E['door-swing']), index))).toEqual(
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
        expect(round(points(swing, moved))[2]).toEqual({ x: 1000, y: 1140 });
    });

    it('gives a bezier its ends and absolute control points', () => {
        expect(points(element(E.curtain), index)).toEqual([
            { x: 3500, y: 3700 },
            { x: 5000, y: 3700 },
            { x: 4000, y: 3500 },
            { x: 4500, y: 3500 },
        ]);
    });

    it('says what each grip changes', () => {
        const V = sampleIds.vertex;
        expect(parts(element(E['door-leaf']), index)).toEqual([
            { kind: 'vertex', vertexId: V['d-hinge'] },
            { kind: 'vertex', vertexId: V['d-open'] },
            { kind: 'move' },
        ]);
        expect(parts(element(E.table), index).map((part) => part.kind)).toEqual(['move', 'radius', 'radius', 'radius', 'radius']);
        expect(parts(element(E.rug), index)).toEqual([
            { kind: 'move' },
            { kind: 'axis', axis: 'x' },
            { kind: 'axis', axis: 'y' },
            { kind: 'axis', axis: 'x' },
            { kind: 'axis', axis: 'y' },
        ]);
        expect(parts(element(E['door-swing']), index)).toEqual([
            { kind: 'move' },
            { kind: 'arcEnd', end: 'start' },
            { kind: 'arcEnd', end: 'end' },
            { kind: 'arcMid' },
        ]);
        expect(parts(element(E.curtain), index).slice(2)).toEqual([
            { kind: 'control', end: 'start' },
            { kind: 'control', end: 'end' },
        ]);
    });

    it('draws the segment midpoints of a polyline as bars along the segment', () => {
        const grips = elementGrips(element(E['wall-outer']), index);
        expect(grips.slice(0, 4).every((grip) => grip.shape === 'square')).toBe(true);
        expect(grips.slice(4).map(({ shape, angle, targets }) => [shape, angle, targets[0].part])).toEqual([
            ['bar', 0, { kind: 'segment', index: 0 }],
            ['bar', Math.PI / 2, { kind: 'segment', index: 1 }],
            ['bar', Math.PI, { kind: 'segment', index: 2 }],
            ['bar', -Math.PI / 2, { kind: 'segment', index: 3 }],
        ]);
    });
});

describe('selectionGrips', () => {
    it('shows a shared position only once', () => {
        // Door leaf and swing share the hinge (1000, 240) and the open end (1000, 1140)
        const grips = selectionGrips([element(E['door-leaf']), element(E['door-swing'])], index);
        expect(grips).toHaveLength(3 + 4 - 2);
    });

    it('gives a shared grip a target for each element', () => {
        const grips = selectionGrips([element(E['door-leaf']), element(E['door-swing'])], index);
        const hinge = grips.find((grip) => grip.point.x === 1000 && grip.point.y === 240)!;
        expect(hinge.targets).toEqual([
            { elementId: E['door-leaf'], part: { kind: 'vertex', vertexId: sampleIds.vertex['d-hinge'] } },
            { elementId: E['door-swing'], part: { kind: 'move' } },
        ]);
    });
});

describe('gripAt', () => {
    const grips = selectionGrips([element(E.table)], index);

    it('finds the grip whose box the pick box touches', () => {
        expect(gripAt(grips, { x: 4610, y: 1790 }, 10)?.point).toEqual({ x: 4600, y: 1800 });
        expect(gripAt(grips, { x: 4611, y: 1800 }, 10)).toBeNull();
    });

    it('takes the nearest of several', () => {
        const close = selectionGrips([element(E.table), element(E.rug)], index);
        // Table centre (4000, 1800) is shared; table top (4000, 2400) and rug top (4000, 2500) are 100 apart
        expect(gripAt(close, { x: 4000, y: 2440 }, 60)?.point).toEqual({ x: 4000, y: 2400 });
        expect(gripAt(close, { x: 4000, y: 2460 }, 60)?.point).toEqual({ x: 4000, y: 2500 });
    });
});

describe('selectionControlFrames', () => {
    it('connects each bezier end with its control point', () => {
        expect(selectionControlFrames([element(E.curtain)], index)).toEqual([
            [
                { x: 3500, y: 3700 },
                { x: 4000, y: 3500 },
            ],
            [
                { x: 5000, y: 3700 },
                { x: 4500, y: 3500 },
            ],
        ]);
    });

    it('gives other element types no frame', () => {
        const others = [E['door-leaf'], E['door-swing'], E.table, E.rug, E['wall-outer']].map(element);
        expect(selectionControlFrames(others, index)).toEqual([]);
    });
});

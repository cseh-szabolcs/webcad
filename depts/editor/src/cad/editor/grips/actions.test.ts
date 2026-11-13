import { describe, expect, it } from 'vitest';
import type { PolylineElement } from '../../model/CadElement';
import { indexDocument } from '../../model/DocumentIndex';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { elementGrips, selectionGrips, type Grip } from '../selection/grips';
import { gripActions, lengthenEdits, radiusCenter, radiusEdits, vertexInsertion, vertexRemoval } from './actions';

const { element: E, vertex: V } = sampleIds;

const doc = parseDocument(samplePlan);
const index = indexDocument(doc);
const element = (id: string) => index.elements.get(id)!;
const grip = (id: string, point: Point): Grip =>
    elementGrips(element(id), index).find((g) => Math.hypot(g.point.x - point.x, g.point.y - point.y) < 1e-6)!;
const round = ({ x, y }: Point) => ({ x: Math.round(x * 1000) / 1000 + 0, y: Math.round(y * 1000) / 1000 + 0 });
const MID = { x: 1000 + 900 / Math.SQRT2, y: 240 + 900 / Math.SQRT2 };
/** The sample plan with the sofa open: (600,2600) (2600,2600) (2600,3500) (600,3500). */
const open = indexDocument({
    ...doc,
    elements: doc.elements.map((e) => (e.id === E.sofa ? ({ ...e, closed: false } as PolylineElement) : e)),
});
const openGrip = (point: Point): Grip =>
    elementGrips(open.elements.get(E.sofa)!, open).find((g) => g.point.x === point.x && g.point.y === point.y)!;

describe('gripActions', () => {
    it('lets the end of a line or arc lengthen and the middle of an arc change its radius', () => {
        expect(gripActions(grip(E.window, { x: 5000, y: 3880 }), index)).toEqual(['stretch', 'lengthen']);
        expect(gripActions(grip(E.window, { x: 4250, y: 3880 }), index)).toEqual(['stretch']);
        expect(gripActions(grip(E['door-swing'], { x: 1900, y: 240 }), index)).toEqual(['stretch', 'lengthen']);
        expect(gripActions(grip(E['door-swing'], MID), index)).toEqual(['stretch', 'radius']);
        expect(gripActions(grip(E['door-swing'], { x: 1000, y: 240 }), index)).toEqual(['stretch']);
    });

    it('lets a polyline add a vertex, and remove one while enough are left', () => {
        expect(gripActions(grip(E.sofa, { x: 1600, y: 2600 }), index)).toEqual(['stretch', 'addVertex', 'convertToArc']);
        expect(gripActions(grip(E.sofa, { x: 600, y: 2600 }), index)).toEqual(['stretch', 'addVertex', 'removeVertex']);
        const triangle = { ...element(E.sofa), vertexIds: [V['s-1'], V['s-2'], V['s-3']] } as PolylineElement;
        const small = indexDocument({ ...doc, elements: doc.elements.map((e) => (e.id === E.sofa ? triangle : e)) });
        expect(gripActions(elementGrips(triangle, small)[0], small)).toEqual(['stretch', 'addVertex']);
    });

    it('only stretches circles, ellipses, beziers and grips that several elements share', () => {
        expect(gripActions(grip(E.table, { x: 4600, y: 1800 }), index)).toEqual(['stretch']);
        expect(gripActions(grip(E.rug, { x: 5000, y: 1800 }), index)).toEqual(['stretch']);
        expect(gripActions(grip(E.curtain, { x: 3500, y: 3700 }), index)).toEqual(['stretch']);
        const [hinge] = selectionGrips([element(E['door-leaf']), element(E['door-swing'])], index);
        expect(gripActions(hinge, index)).toEqual(['stretch']);
    });
});

describe('lengthenEdits', () => {
    it('moves the end of a line along it to the foot of the point', () => {
        const [edit] = lengthenEdits(index, grip(E.window, { x: 5000, y: 3880 }), { x: 5400, y: 3000 })!;
        expect([...edit.vertices]).toEqual([[V['win-2'], { x: 5400, y: 3880 }]]);
        const [shorter] = lengthenEdits(index, grip(E.window, { x: 3500, y: 3880 }), { x: 4000, y: 9000 })!;
        expect([...shorter.vertices]).toEqual([[V['win-1'], { x: 4000, y: 3880 }]]);
    });

    it('has no line at or beyond its other end', () => {
        expect(lengthenEdits(index, grip(E.window, { x: 5000, y: 3880 }), { x: 3500, y: 3000 })).toBeNull();
        expect(lengthenEdits(index, grip(E.window, { x: 5000, y: 3880 }), { x: 3000, y: 3880 })).toBeNull();
    });

    it('moves the end of an arc along its circle to the angle of the point', () => {
        const [edit] = lengthenEdits(index, grip(E['door-swing'], { x: 1000, y: 1140 }), { x: 500, y: 240 })!;
        expect([...edit.vertices].map(([id, point]) => [id, round(point)])).toEqual([[V['d-open'], { x: 100, y: 240 }]]);
        const [start] = lengthenEdits(index, grip(E['door-swing'], { x: 1900, y: 240 }), { x: 1000, y: -5 })!;
        expect([...start.vertices].map(([id, point]) => [id, round(point)])).toEqual([[V['d-closed'], { x: 1000, y: -660 }]]);
        expect(lengthenEdits(index, grip(E['door-swing'], { x: 1000, y: 1140 }), { x: 1000, y: 240 })).toBeNull();
    });
});

describe('radiusEdits', () => {
    it('gives the arc another radius about its centre, at the same angles', () => {
        const mid = grip(E['door-swing'], MID);
        expect(radiusCenter(index, mid)).toEqual({ x: 1000, y: 240 });
        const [edit] = radiusEdits(index, mid, 500)!;
        expect([...edit.vertices].map(([id, point]) => [id, round(point)])).toEqual([
            [V['d-closed'], { x: 1500, y: 240 }],
            [V['d-open'], { x: 1000, y: 740 }],
        ]);
        expect(radiusEdits(index, mid, 0)).toBeNull();
    });
});

describe('vertexInsertion and vertexRemoval', () => {
    it('puts a new vertex into the segment of a midpoint grip', () => {
        expect(vertexInsertion(index, grip(E.sofa, { x: 2600, y: 3050 }))?.at).toBe(2);
        // The closing segment: after the last vertex
        expect(vertexInsertion(index, grip(E.sofa, { x: 600, y: 3050 }))?.at).toBe(4);
    });

    it('puts it after a vertex grip, but before the first vertex of an open polyline', () => {
        expect(vertexInsertion(index, grip(E.sofa, { x: 600, y: 2600 }))?.at).toBe(1);
        expect(vertexInsertion(open, openGrip({ x: 600, y: 2600 }))?.at).toBe(0);
        expect(vertexInsertion(open, openGrip({ x: 2600, y: 2600 }))?.at).toBe(2);
        expect(vertexInsertion(open, openGrip({ x: 600, y: 3500 }))?.at).toBe(4);
    });

    it('finds the place of the vertex to remove', () => {
        expect(vertexRemoval(index, grip(E.sofa, { x: 2600, y: 3500 }))).toMatchObject({ polyline: { id: E.sofa }, at: 2 });
        expect(vertexRemoval(index, grip(E.sofa, { x: 1600, y: 2600 }))).toBeNull();
        expect(vertexRemoval(index, grip(E.window, { x: 5000, y: 3880 }))).toBeNull();
    });
});

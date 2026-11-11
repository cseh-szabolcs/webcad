import { describe, expect, it } from 'vitest';
import type { ArcElement, CubicBezierElement } from '../../model/CadElement';
import { indexDocument } from '../../model/DocumentIndex';
import type { Point, Vector2 } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { elementGrips, selectionGrips, type Grip } from '../selection/grips';
import { stretchTargets } from './stretch';

const { element: E, vertex: V } = sampleIds;

const index = indexDocument(parseDocument(samplePlan));
const element = (id: string) => index.elements.get(id)!;
/** The grip of the element at `point`. */
const grip = (id: string, point: Point): Grip =>
    elementGrips(element(id), index).find((g) => Math.hypot(g.point.x - point.x, g.point.y - point.y) < 1e-6)!;
const round = ({ x, y }: Point) => ({ x: Math.round(x * 1000) / 1000 + 0, y: Math.round(y * 1000) / 1000 + 0 });
/** The one edit of a stretch, its vertex positions rounded by id. */
const stretch = (grips: Grip[], delta: Vector2) => {
    const edits = stretchTargets(index, grips, delta)!;
    expect(edits).toHaveLength(1);
    return {
        element: edits[0].element,
        vertices: Object.fromEntries([...edits[0].vertices].map(([id, point]) => [id, round(point)])),
    };
};

describe('stretchTargets', () => {
    it('moves the end of a line and leaves the other', () => {
        const { element: line, vertices } = stretch([grip(E['door-leaf'], { x: 1000, y: 1140 })], { x: 100, y: -40 });
        expect(vertices).toEqual({ [V['d-open']]: { x: 1100, y: 1100 } });
        expect(line).toBe(element(E['door-leaf']));
    });

    it('moves the whole line by its midpoint', () => {
        const { vertices } = stretch([grip(E['door-leaf'], { x: 1000, y: 690 })], { x: 100, y: 0 });
        expect(vertices).toEqual({ [V['d-hinge']]: { x: 1100, y: 240 }, [V['d-open']]: { x: 1100, y: 1140 } });
    });

    it('moves a polyline vertex, or both ends of a segment by its midpoint', () => {
        expect(stretch([grip(E['wall-outer'], { x: 6000, y: 0 })], { x: 500, y: 0 }).vertices).toEqual({
            [V['w-o2']]: { x: 6500, y: 0 },
        });
        expect(stretch([grip(E['wall-outer'], { x: 3000, y: 0 })], { x: 0, y: -300 }).vertices).toEqual({
            [V['w-o1']]: { x: 0, y: -300 },
            [V['w-o2']]: { x: 6000, y: -300 },
        });
        // The closing segment runs from the last vertex to the first
        expect(stretch([grip(E['wall-outer'], { x: 0, y: 2000 })], { x: -300, y: 0 }).vertices).toEqual({
            [V['w-o4']]: { x: -300, y: 4000 },
            [V['w-o1']]: { x: -300, y: 0 },
        });
    });

    it('moves a circle by its centre and changes its radius by a quadrant', () => {
        expect(stretch([grip(E.table, { x: 4000, y: 1800 })], { x: 10, y: 20 }).vertices).toEqual({
            [V['t-center']]: { x: 4010, y: 1820 },
        });
        const { element: circle, vertices } = stretch([grip(E.table, { x: 4600, y: 1800 })], { x: -200, y: 300 });
        expect(circle).toMatchObject({ radius: 500 });
        expect(vertices).toEqual({});
    });

    it('changes one radius of an ellipse by an axis end and keeps the rotation', () => {
        expect(stretch([grip(E.rug, { x: 5000, y: 1800 })], { x: 500, y: 0 }).element).toMatchObject({
            radiusX: 1500,
            radiusY: 700,
        });
        expect(stretch([grip(E.rug, { x: 4000, y: 1100 })], { x: 0, y: 200 }).element).toMatchObject({
            radiusX: 1000,
            radiusY: 500,
        });
    });

    it('has nowhere to go for a radius of zero', () => {
        expect(stretchTargets(index, [grip(E.table, { x: 4600, y: 1800 })], { x: -600, y: 0 })).toBeNull();
        expect(stretchTargets(index, [grip(E.rug, { x: 4000, y: 2500 })], { x: 0, y: -700 })).toBeNull();
    });

    it('puts the arc through its other end, its old middle and the new end', () => {
        // Along the same circle to 180°: the centre stays
        const { element: arc, vertices } = stretch([grip(E['door-swing'], { x: 1000, y: 1140 })], { x: -900, y: -900 });
        expect((arc as ArcElement).clockwise).toBe(false);
        expect(vertices[V['d-hinge']]).toEqual({ x: 1000, y: 240 });
        expect(vertices[V['d-closed']]).toEqual({ x: 1900, y: 240 });
        expect(vertices[V['d-open']]).toEqual({ x: 100, y: 240 });
    });

    it('puts the arc through both ends and the new middle', () => {
        const r = 900 / Math.SQRT2;
        const mid = { x: 1000 + r, y: 240 + r };
        const { element: arc, vertices } = stretch([grip(E['door-swing'], mid)], { x: 1900 - mid.x, y: 1140 - mid.y });
        expect((arc as ArcElement).clockwise).toBe(false);
        expect(vertices[V['d-hinge']]).toEqual({ x: 1450, y: 690 });
        expect(vertices[V['d-closed']]).toEqual({ x: 1900, y: 240 });
        expect(vertices[V['d-open']]).toEqual({ x: 1000, y: 1140 });
    });

    it('turns the arc round when its middle crosses the chord, and has none on it', () => {
        const r = 900 / Math.SQRT2;
        const mid = { x: 1000 + r, y: 240 + r };
        const across = stretch([grip(E['door-swing'], mid)], { x: 1000 - mid.x, y: 240 - mid.y });
        expect((across.element as ArcElement).clockwise).toBe(true);
        expect(stretchTargets(index, [grip(E['door-swing'], mid)], { x: 1450 - mid.x, y: 690 - mid.y })).toBeNull();
    });

    it('moves a bezier control point, and its end with both control points', () => {
        const control = stretch([grip(E.curtain, { x: 4000, y: 3500 })], { x: 0, y: 100 });
        expect((control.element as CubicBezierElement).startControl).toEqual({ x: 500, y: -100 });
        expect((control.element as CubicBezierElement).endControl).toEqual({ x: -500, y: -200 });
        expect(control.vertices).toEqual({});
        const end = stretch([grip(E.curtain, { x: 5000, y: 3700 })], { x: 0, y: 100 });
        expect(end.vertices).toEqual({ [V['c-2']]: { x: 5000, y: 3800 } });
        expect(end.element).toBe(element(E.curtain));
    });

    it('moves both ends of a line when both are hot, and the circle with a hot quadrant along with its centre', () => {
        const ends = [grip(E['door-leaf'], { x: 1000, y: 240 }), grip(E['door-leaf'], { x: 1000, y: 1140 })];
        expect(stretch(ends, { x: 30, y: 0 }).vertices).toEqual({
            [V['d-hinge']]: { x: 1030, y: 240 },
            [V['d-open']]: { x: 1030, y: 1140 },
        });
        const table = [grip(E.table, { x: 4600, y: 1800 }), grip(E.table, { x: 4000, y: 1800 })];
        const moved = stretch(table, { x: 500, y: 0 });
        expect(moved.element).toBe(element(E.table));
        expect(moved.vertices).toEqual({ [V['t-center']]: { x: 4500, y: 1800 } });
    });

    it('moves an arc whose ends and middle are all hot, and keeps the middle where only the ends are', () => {
        const r = 900 / Math.SQRT2;
        const start = grip(E['door-swing'], { x: 1900, y: 240 });
        const end = grip(E['door-swing'], { x: 1000, y: 1140 });
        const mid = grip(E['door-swing'], { x: 1000 + r, y: 240 + r });
        const all = stretch([start, end, mid], { x: 100, y: 50 });
        expect(all.vertices).toEqual({
            [V['d-hinge']]: { x: 1100, y: 290 },
            [V['d-closed']]: { x: 2000, y: 290 },
            [V['d-open']]: { x: 1100, y: 1190 },
        });
        // Both ends outwards by the same step along the diagonal: the old middle stays on the arc
        const ends = stretchTargets(index, [start, end], { x: 100, y: 100 })!;
        const centre = ends[0].vertices.get(V['d-hinge'])!;
        const radius = Math.hypot(2000 - centre.x, 340 - centre.y);
        expect(Math.hypot(1000 + r - centre.x, 240 + r - centre.y)).toBeCloseTo(radius);
        expect(Math.hypot(1100 - centre.x, 1240 - centre.y)).toBeCloseTo(radius);
    });

    it('keeps a bezier control point at its end when both are hot', () => {
        const both = [grip(E.curtain, { x: 3500, y: 3700 }), grip(E.curtain, { x: 4000, y: 3500 })];
        const moved = stretch(both, { x: 0, y: 100 });
        expect(moved.vertices).toEqual({ [V['c-1']]: { x: 3500, y: 3800 } });
        expect((moved.element as CubicBezierElement).startControl).toEqual({ x: 500, y: -200 });
    });

    it('stretches every element that has a grip at the position', () => {
        // The hinge is the leaf's start and the swing's centre
        const [hinge] = selectionGrips([element(E['door-leaf']), element(E['door-swing'])], index);
        const edits = stretchTargets(index, [hinge], { x: 50, y: 0 })!;
        expect(edits.map((edit) => [edit.element.id, [...edit.vertices.keys()]])).toEqual([
            [E['door-leaf'], [V['d-hinge']]],
            [E['door-swing'], [V['d-hinge'], V['d-closed'], V['d-open']]],
        ]);
    });
});

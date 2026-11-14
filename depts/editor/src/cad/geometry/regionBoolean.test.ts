import { describe, expect, it } from 'vitest';
import type { Point } from '../model/Point';
import { closedShapeArea, subtractShapes, unionShapes, type ClosedShape } from './regionBoolean';

const rect = (x1: number, y1: number, x2: number, y2: number): ClosedShape => ({
    kind: 'polyline',
    points: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
    ],
    bulges: [0, 0, 0, 0],
});
const circle = (x: number, y: number, radius: number): ClosedShape => ({ kind: 'circle', center: { x, y }, radius });
const SQUARE = rect(0, 0, 100, 100);
const points = (shape: ClosedShape): readonly Point[] => (shape.kind === 'polyline' ? shape.points : []);
const area = (shapes: readonly ClosedShape[]) => shapes.reduce((sum, shape) => sum + closedShapeArea(shape), 0);
/** Rounded, so points worked out from crossings compare. */
const rounded = (shape: ClosedShape) => points(shape).map(({ x, y }) => ({ x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 }));

describe('subtractShapes', () => {
    it('cuts an overlapping rectangle out of a corner', () => {
        const [shape, ...rest] = subtractShapes([SQUARE], [rect(50, 50, 150, 150)]);
        expect(rest).toEqual([]);
        expect(shape).toEqual({
            kind: 'polyline',
            points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 50 },
                { x: 50, y: 50 },
                { x: 50, y: 100 },
                { x: 0, y: 100 },
            ],
            bulges: [0, 0, 0, 0, 0, 0],
        });
    });

    it('leaves a circle inside as a hole: the outline as it was, and the circle', () => {
        const shapes = subtractShapes([SQUARE], [circle(50, 50, 20)]);
        expect(shapes).toEqual([SQUARE, circle(50, 50, 20)]);
    });

    it('cuts a circle on the edge out as an arc that bulges into the area', () => {
        const [shape, ...rest] = subtractShapes([SQUARE], [circle(100, 50, 20)]);
        expect(rest).toEqual([]);
        expect(rounded(shape)).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 30 },
            { x: 100, y: 70 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ]);
        // Half a circle, clockwise on the way up
        const bulges = shape.kind === 'polyline' ? shape.bulges : [];
        expect(bulges.map((bulge) => Math.round(bulge * 1e9) / 1e9)).toEqual([0, 0, -1, 0, 0, 0]);
        expect(closedShapeArea(shape)).toBeCloseTo(10000 - (Math.PI * 400) / 2);
    });

    it('takes edges both outlines share as cut', () => {
        expect(subtractShapes([SQUARE], [rect(60, 0, 140, 100)])).toEqual([rect(0, 0, 60, 100)]);
        // Only touching along an edge takes nothing away
        expect(subtractShapes([SQUARE], [rect(100, 20, 140, 80)])).toEqual([SQUARE]);
    });

    it('gives two pieces when a bar goes right through', () => {
        expect(subtractShapes([SQUARE], [rect(40, -10, 60, 110)])).toEqual([rect(0, 0, 40, 100), rect(60, 0, 100, 100)]);
    });

    it('keeps what nothing touches, and nothing of what is covered', () => {
        expect(subtractShapes([SQUARE, circle(300, 0, 10)], [rect(200, 200, 250, 250)])).toEqual([SQUARE, circle(300, 0, 10)]);
        expect(subtractShapes([SQUARE], [rect(-10, -10, 110, 110)])).toEqual([]);
        expect(subtractShapes([SQUARE], [SQUARE])).toEqual([]);
    });

    it('takes the first shapes together before it cuts', () => {
        expect(subtractShapes([SQUARE, rect(50, 0, 150, 100)], [])).toEqual([rect(0, 0, 150, 100)]);
        const shapes = subtractShapes([SQUARE, rect(50, 50, 150, 150)], [circle(75, 75, 10)]);
        expect(shapes).toHaveLength(2);
        expect(points(shapes[0])).toHaveLength(8);
        expect(shapes[1]).toEqual(circle(75, 75, 10));
    });

    it('takes several shapes away, also where they overlap each other', () => {
        const shapes = subtractShapes([SQUARE], [rect(-10, 40, 60, 60), rect(40, -10, 60, 60)]);
        expect(shapes).toHaveLength(2);
        expect(area(shapes)).toBeCloseTo(10000 - 60 * 20 - 60 * 20 + 20 * 20);
    });

    it('cuts a circle by a circle into a crescent of three points', () => {
        const [shape, ...rest] = subtractShapes([circle(0, 0, 50)], [circle(50, 0, 50)]);
        expect(rest).toEqual([]);
        expect(points(shape)).toHaveLength(3);
        const lens = 2 * 2500 * (Math.PI / 3) - 25 * Math.sqrt(7500);
        expect(closedShapeArea(shape)).toBeCloseTo(Math.PI * 2500 - lens);
    });

    it('cuts a circle by a rectangle into half a circle, its arc in one piece', () => {
        const [shape] = subtractShapes([circle(0, 0, 50)], [rect(0, -60, 60, 60)]);
        // Top, the middle of the arc and bottom: no point where the circle was given as two halves
        expect(rounded(shape)).toEqual([
            { x: 0, y: 50 },
            { x: -50, y: 0 },
            { x: 0, y: -50 },
        ]);
        expect(closedShapeArea(shape)).toBeCloseTo((Math.PI * 2500) / 2);
    });

    it('cuts outlines with arcs', () => {
        // A slot: 100 long between two half circles of radius 20
        const slot: ClosedShape = {
            kind: 'polyline',
            points: [
                { x: 0, y: -20 },
                { x: 100, y: -20 },
                { x: 100, y: 20 },
                { x: 0, y: 20 },
            ],
            bulges: [0, 1, 0, 1],
        };
        expect(closedShapeArea(slot)).toBeCloseTo(4000 + Math.PI * 400);
        expect(subtractShapes([slot], [])).toEqual([slot]);
        const shapes = subtractShapes([slot], [rect(40, -30, 60, 30)]);
        expect(shapes).toHaveLength(2);
        expect(area(shapes)).toBeCloseTo(4000 + Math.PI * 400 - 800);
        // A hole cut into a rectangle is the slot the other way round
        const [outline, hole] = subtractShapes([rect(-50, -50, 150, 50)], [slot]);
        expect(outline).toEqual(rect(-50, -50, 150, 50));
        expect(closedShapeArea(hole)).toBeCloseTo(-(4000 + Math.PI * 400));
    });

    it('cuts where an edge runs through the middle of a circle, on the chord of its arcs', () => {
        // The edge between the cuts lies in the circle: no part of the outline
        const shapes = subtractShapes([SQUARE, circle(100, 50, 20)], [circle(100, 50, 20)]);
        expect(shapes).toHaveLength(1);
        expect(closedShapeArea(shapes[0])).toBeCloseTo(10000 - (Math.PI * 400) / 2);
        expect(subtractShapes([circle(100, 50, 20)], [SQUARE]).map(closedShapeArea)[0]).toBeCloseTo((Math.PI * 400) / 2);
    });

    it('keeps the points of an outline that lie on a straight run', () => {
        const withMiddle: ClosedShape = { kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, ...points(SQUARE).slice(1)], bulges: [0, 0, 0, 0, 0] };
        expect(subtractShapes([withMiddle], [circle(500, 500, 10)])).toEqual([withMiddle]);
    });
});

describe('unionShapes', () => {
    it('joins overlapping shapes to one outline', () => {
        const [shape, ...rest] = unionShapes([SQUARE, rect(50, 50, 150, 150)]);
        expect(rest).toEqual([]);
        expect(points(shape)).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 },
            { x: 150, y: 50 },
            { x: 150, y: 150 },
            { x: 50, y: 150 },
            { x: 50, y: 100 },
            { x: 0, y: 100 },
        ]);
    });

    it('joins shapes that share an edge, without a point left on a straight run', () => {
        expect(unionShapes([SQUARE, rect(100, 0, 150, 100)])).toEqual([rect(0, 0, 150, 100)]);
        // A shorter neighbour leaves the corners where the outline turns
        const [shape] = unionShapes([SQUARE, rect(100, 20, 150, 80)]);
        expect(points(shape)).toHaveLength(8);
        expect(closedShapeArea(shape)).toBeCloseTo(10000 + 50 * 60);
    });

    it('keeps shapes apart as they are, and drops one that lies inside another', () => {
        expect(unionShapes([SQUARE, circle(300, 0, 10)])).toEqual([SQUARE, circle(300, 0, 10)]);
        expect(unionShapes([SQUARE, circle(50, 50, 20), rect(10, 10, 20, 20)])).toEqual([SQUARE]);
        expect(unionShapes([SQUARE, SQUARE])).toEqual([SQUARE]);
        expect(unionShapes([SQUARE])).toEqual([SQUARE]);
    });

    it('joins a circle on the edge as an arc that bulges out', () => {
        const [shape, ...rest] = unionShapes([SQUARE, circle(100, 50, 20)]);
        expect(rest).toEqual([]);
        const bulges = shape.kind === 'polyline' ? shape.bulges : [];
        // Half a circle, counter-clockwise on the way up
        expect(bulges.map((bulge) => Math.round(bulge * 1e9) / 1e9)).toEqual([0, 0, 1, 0, 0, 0]);
        expect(closedShapeArea(shape)).toBeCloseTo(10000 + (Math.PI * 400) / 2);
    });

    it('leaves the hole a ring of shapes encloses', () => {
        // Four bars around a square of 60
        const shapes = unionShapes([rect(0, 0, 100, 20), rect(80, 0, 100, 100), rect(0, 80, 100, 100), rect(0, 0, 20, 100)]);
        expect(shapes).toHaveLength(2);
        expect(closedShapeArea(shapes[0])).toBeCloseTo(10000);
        expect(closedShapeArea(shapes[1])).toBeCloseTo(-3600);
    });

    it('joins two circles into one outline of two arcs', () => {
        const [shape, ...rest] = unionShapes([circle(0, 0, 50), circle(50, 0, 50)]);
        expect(rest).toEqual([]);
        expect(points(shape)).toHaveLength(3);
        const lens = 2 * 2500 * (Math.PI / 3) - 25 * Math.sqrt(7500);
        expect(closedShapeArea(shape)).toBeCloseTo(2 * Math.PI * 2500 - lens);
    });
});

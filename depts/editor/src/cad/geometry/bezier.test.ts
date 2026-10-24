import { describe, expect, it } from 'vitest';
import { bezierLength, bezierMidpoint, bezierPoint, type CubicBezier } from './bezier';

const line: CubicBezier = { p0: { x: 0, y: 0 }, p1: { x: 100, y: 0 }, p2: { x: 200, y: 0 }, p3: { x: 300, y: 0 } };
/** Sample plan's curtain: symmetric, sagging downwards. */
const curtain: CubicBezier = {
    p0: { x: 3500, y: 3700 },
    p1: { x: 4000, y: 3500 },
    p2: { x: 4500, y: 3500 },
    p3: { x: 5000, y: 3700 },
};
/** Strongly asymmetric: the parameter middle is far from the length middle. */
const skewed: CubicBezier = { p0: { x: 0, y: 0 }, p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, p3: { x: 1000, y: 0 } };

describe('bezierLength', () => {
    it('measures a straight curve exactly', () => {
        expect(bezierLength(line)).toBeCloseTo(300, 9);
        expect(bezierLength(line, 0.5)).toBeCloseTo(150, 9);
    });

    it('measures a quarter circle approximation close to its arc', () => {
        const k = 0.5522847498307936 * 900;
        const quarter = { p0: { x: 900, y: 0 }, p1: { x: 900, y: k }, p2: { x: k, y: 900 }, p3: { x: 0, y: 900 } };
        expect(bezierLength(quarter)).toBeCloseTo((Math.PI / 2) * 900, 0);
    });
});

describe('bezierMidpoint', () => {
    it('lies at t = 0.5 on a symmetric curve', () => {
        const mid = bezierMidpoint(curtain);
        expect(mid.x).toBeCloseTo(4250, 6);
        expect(mid.y).toBeCloseTo(bezierPoint(curtain, 0.5).y, 6);
    });

    it('halves the arc length, not the parameter, on an asymmetric curve', () => {
        // All but the last control point coincide: x(t) = 1000 t³, so the length middle is at x = 500
        expect(bezierMidpoint(skewed).x).toBeCloseTo(500, 6);
        expect(bezierPoint(skewed, 0.5).x).toBeCloseTo(125, 9);
    });
});

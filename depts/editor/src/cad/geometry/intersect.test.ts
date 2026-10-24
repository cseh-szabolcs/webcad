import { describe, expect, it } from 'vitest';
import type { Point } from '../model/Point';
import { angleOnArc } from './arc';
import {
    circleIntersections,
    refineIntersection,
    segmentCircleIntersections,
    segmentIntersections,
    type ParametricCurve,
} from './intersect';

const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
const rounded = (points: Point[]) =>
    points.map((p) => ({ x: round3(p.x), y: round3(p.y) })).sort((a, b) => a.x - b.x || a.y - b.y);

describe('segmentIntersections', () => {
    it('finds a crossing and a T-junction at an end', () => {
        expect(rounded(segmentIntersections({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }))).toEqual([
            { x: 5, y: 5 },
        ]);
        expect(rounded(segmentIntersections({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 7 }))).toEqual([
            { x: 4, y: 0 },
        ]);
    });

    it('gives nothing for separate, parallel or collinear segments', () => {
        expect(segmentIntersections({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual([]);
        expect(segmentIntersections({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toEqual([]);
        expect(segmentIntersections({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toEqual([]);
    });
});

describe('segmentCircleIntersections', () => {
    const center = { x: 0, y: 0 };

    it('finds both points of a secant and the one point of a tangent', () => {
        expect(rounded(segmentCircleIntersections({ x: -20, y: 0 }, { x: 20, y: 0 }, center, 10))).toEqual([
            { x: -10, y: 0 },
            { x: 10, y: 0 },
        ]);
        expect(rounded(segmentCircleIntersections({ x: -20, y: 10 }, { x: 20, y: 10 }, center, 10))).toEqual([
            { x: 0, y: 10 },
        ]);
    });

    it('only keeps points on the segment', () => {
        expect(rounded(segmentCircleIntersections({ x: 0, y: 0 }, { x: 20, y: 0 }, center, 10))).toEqual([{ x: 10, y: 0 }]);
        expect(segmentCircleIntersections({ x: -5, y: 0 }, { x: 5, y: 0 }, center, 10)).toEqual([]);
    });
});

describe('circleIntersections', () => {
    it('finds two, one or no points', () => {
        expect(rounded(circleIntersections({ x: 0, y: 0 }, 5, { x: 8, y: 0 }, 5))).toEqual([
            { x: 4, y: -3 },
            { x: 4, y: 3 },
        ]);
        expect(rounded(circleIntersections({ x: 0, y: 0 }, 5, { x: 10, y: 0 }, 5))).toEqual([{ x: 5, y: 0 }]);
        expect(circleIntersections({ x: 0, y: 0 }, 5, { x: 20, y: 0 }, 5)).toEqual([]);
        expect(circleIntersections({ x: 0, y: 0 }, 5, { x: 1, y: 0 }, 1)).toEqual([]);
        expect(circleIntersections({ x: 0, y: 0 }, 5, { x: 0, y: 0 }, 5)).toEqual([]);
    });
});

describe('refineIntersection', () => {
    const parabola: ParametricCurve = {
        point: (t) => ({ x: t, y: t * t }),
        derivative: (t) => ({ x: 1, y: 2 * t }),
    };
    const horizontal: ParametricCurve = { point: (s) => ({ x: s, y: 0.25 }), derivative: () => ({ x: 1, y: 0 }) };

    it('converges from a rough start', () => {
        const result = refineIntersection(parabola, horizontal, 0.7, 0.3)!;
        expect(result.t).toBeCloseTo(0.5, 9);
        expect(result.s).toBeCloseTo(0.5, 9);
    });

    it('rejects results outside [0, 1]', () => {
        const low: ParametricCurve = { point: (s) => ({ x: s * 4 - 2, y: 2.25 }), derivative: () => ({ x: 4, y: 0 }) };
        // The parabola meets y = 2.25 at t = 1.5 only
        expect(refineIntersection(parabola, low, 0.9, 0.9)).toBeNull();
    });
});

describe('angleOnArc', () => {
    it('handles both directions and the wrap at ±π', () => {
        expect(angleOnArc(Math.PI / 4, 0, Math.PI / 2)).toBe(true);
        expect(angleOnArc(Math.PI / 2, 0, Math.PI / 2)).toBe(true);
        expect(angleOnArc(Math.PI, 0, Math.PI / 2)).toBe(false);
        expect(angleOnArc(-Math.PI / 4, 0, -Math.PI / 2)).toBe(true);
        expect(angleOnArc(Math.PI / 4, 0, -Math.PI / 2)).toBe(false);
        expect(angleOnArc(-Math.PI + 0.1, Math.PI - 0.1, 0.3)).toBe(true);
        expect(angleOnArc(1.23, 0, 2 * Math.PI)).toBe(true);
    });
});

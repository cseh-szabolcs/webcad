import { describe, expect, it } from 'vitest';
import { bulgeArc, bulgeThrough, polylineSegments, segmentEndDirection, segmentMidpoint } from './polyline';

const A = { x: 0, y: 0 };
const B = { x: 200, y: 0 };
const C = { x: 200, y: 100 };
const QUARTER = Math.tan(Math.PI / 8);

describe('polylineSegments', () => {
    it('joins the points in order, a closed one back to the first, each with its bulge', () => {
        expect(polylineSegments([A, B, C], [0, 1, 5], false)).toEqual([
            { from: A, to: B, bulge: 0 },
            { from: B, to: C, bulge: 1 },
        ]);
        expect(polylineSegments([A, B, C], [0, 1, -1], true).at(-1)).toEqual({ from: C, to: A, bulge: -1 });
        // Missing bulges count as straight; two points have no closing segment
        expect(polylineSegments([A, B], [], true)).toEqual([{ from: A, to: B, bulge: 0 }]);
    });
});

describe('bulgeArc', () => {
    it('gives half a circle for a bulge of 1, counter-clockwise below the chord', () => {
        const arc = bulgeArc({ from: A, to: B, bulge: 1 })!;
        expect(arc.center).toEqual({ x: 100, y: 0 });
        expect(arc.radius).toBe(100);
        expect(arc.sweep).toBeCloseTo(Math.PI);
        expect(arc.clockwise).toBe(false);
        expect(segmentMidpoint({ from: A, to: B, bulge: 1 })).toEqual({ x: 100, y: -100 });
    });

    it('gives a quarter for tan(22.5°), clockwise for a negative bulge', () => {
        const arc = bulgeArc({ from: A, to: B, bulge: -QUARTER })!;
        expect(arc.center.x).toBeCloseTo(100);
        expect(arc.center.y).toBeCloseTo(-100);
        expect(arc.sweep).toBeCloseTo(-Math.PI / 2);
        expect(arc.clockwise).toBe(true);
        // Over the chord, as high as the circle rises above it
        const mid = segmentMidpoint({ from: A, to: B, bulge: -QUARTER });
        expect(mid.x).toBeCloseTo(100);
        expect(mid.y).toBeCloseTo(100 * Math.SQRT2 - 100);
    });

    it('gives none for a straight segment or one of no length', () => {
        expect(bulgeArc({ from: A, to: B, bulge: 0 })).toBeNull();
        expect(bulgeArc({ from: A, to: A, bulge: 1 })).toBeNull();
        expect(segmentMidpoint({ from: A, to: B, bulge: 0 })).toEqual({ x: 100, y: 0 });
    });
});

describe('bulgeThrough', () => {
    it('is the bulge of the arc through three points, with its direction', () => {
        expect(bulgeThrough(A, { x: 100, y: -100 }, B)).toBeCloseTo(1);
        expect(bulgeThrough(A, { x: 100, y: 100 }, B)).toBeCloseTo(-1);
        expect(bulgeThrough(A, segmentMidpoint({ from: A, to: B, bulge: 0.3 }), B)).toBeCloseTo(0.3);
        // More than half a circle
        expect(bulgeThrough(A, segmentMidpoint({ from: A, to: B, bulge: -2.5 }), B)).toBeCloseTo(-2.5);
    });

    it('is none for points on one line', () => {
        expect(bulgeThrough(A, { x: 100, y: 0 }, B)).toBeNull();
        expect(bulgeThrough(A, A, B)).toBeNull();
    });
});

describe('segmentEndDirection', () => {
    it('is the direction of the chord, turned by half the angle of the arc', () => {
        expect(segmentEndDirection({ from: A, to: B, bulge: 0 })).toBe(0);
        // Half a circle below the chord arrives heading up
        expect(segmentEndDirection({ from: A, to: B, bulge: 1 })).toBeCloseTo(Math.PI / 2);
        expect(segmentEndDirection({ from: A, to: B, bulge: -QUARTER })).toBeCloseTo(-Math.PI / 4);
    });
});

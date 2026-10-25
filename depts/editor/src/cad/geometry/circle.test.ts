import { describe, expect, it } from 'vitest';
import { circleOnDiameter, circleThrough } from './circle';

describe('circleOnDiameter', () => {
    it('takes the middle and half the distance', () => {
        expect(circleOnDiameter({ x: 0, y: 0 }, { x: 60, y: 80 })).toEqual({ center: { x: 30, y: 40 }, radius: 50 });
    });

    it('gives none for one point', () => {
        expect(circleOnDiameter({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
    });
});

describe('circleThrough', () => {
    it('finds the circle through three points', () => {
        const circle = circleThrough({ x: 1010, y: 2000 }, { x: 1000, y: 2010 }, { x: 990, y: 2000 })!;
        expect(circle.center.x).toBeCloseTo(1000, 9);
        expect(circle.center.y).toBeCloseTo(2000, 9);
        expect(circle.radius).toBeCloseTo(10, 9);
    });

    it('gives none for points on one line or coinciding ones', () => {
        expect(circleThrough({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 25, y: 25 })).toBeNull();
        expect(circleThrough({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 25, y: 5 })).toBeNull();
        expect(circleThrough({ x: 0, y: 0 }, { x: 25, y: 5 }, { x: 0, y: 0 })).toBeNull();
    });
});

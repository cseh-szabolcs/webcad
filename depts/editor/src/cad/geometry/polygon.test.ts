import { describe, expect, it } from 'vitest';
import { polygonCentroid } from './polygon';

describe('polygonCentroid', () => {
    it('gives the middle of a rectangle in either direction', () => {
        const rectangle = [
            { x: 600, y: 2600 },
            { x: 2600, y: 2600 },
            { x: 2600, y: 3500 },
            { x: 600, y: 3500 },
        ];
        expect(polygonCentroid(rectangle)).toEqual({ x: 1600, y: 3050 });
        expect(polygonCentroid([...rectangle].reverse())).toEqual({ x: 1600, y: 3050 });
    });

    it('weights by area, not by vertices', () => {
        // Triangle with an extra vertex on its long edge: the vertex average (125, 100) moves, the centroid does not
        const centroid = polygonCentroid([
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 200, y: 100 },
            { x: 0, y: 300 },
        ]);
        expect(centroid.x).toBeCloseTo(100, 9);
        expect(centroid.y).toBeCloseTo(100, 9);
    });

    it('keeps its precision far from the origin', () => {
        const far = 1e9;
        const centroid = polygonCentroid([
            { x: far, y: far },
            { x: far + 2, y: far },
            { x: far + 2, y: far + 1 },
            { x: far, y: far + 1 },
        ]);
        expect(centroid).toEqual({ x: far + 1, y: far + 0.5 });
    });

    it('takes the middle of the bounds for a polygon without area', () => {
        expect(polygonCentroid([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 40, y: 40 }])).toEqual({ x: 20, y: 20 });
    });
});

import { describe, expect, it } from 'vitest';
import { indexDocument } from '../model/DocumentIndex';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import { buildPathSpec } from '../renderer/PathSpec';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { flattenPathSpec } from './flatten';
import { distanceToPolyline } from './selectionGeometry';

const { element: E } = sampleIds;

const index = indexDocument(parseDocument(samplePlan));
const flatten = (id: string, tolerance = 0.5) => flattenPathSpec(buildPathSpec(index.elements.get(id)!, index), tolerance);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

describe('flattenPathSpec', () => {
    it('keeps a line as its two end points', () => {
        expect(flatten(E['door-leaf'])).toEqual([{ x: 1000, y: 240 }, { x: 1000, y: 1140 }]);
    });

    it('closes a closed polyline with its first point', () => {
        expect(flatten(E['wall-outer'])).toEqual([
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
            { x: 0, y: 0 },
        ]);
    });

    it('keeps a circle within the tolerance of its radius', () => {
        const points = flatten(E.table, 0.5);
        const center = { x: 4000, y: 1800 };
        expect(points[0]).toEqual(points.at(-1));
        for (const p of points) {
            // Includes the error of the four-segment Bézier circle itself (about 0.03 % of r)
            expect(Math.abs(distance(p, center) - 600)).toBeLessThan(0.5 + 0.2);
        }
    });

    it('uses more points for a finer tolerance', () => {
        expect(flatten(E.table, 0.05).length).toBeGreaterThan(flatten(E.table, 5).length);
    });

    it('follows an arc from start to end', () => {
        const points = flatten(E['door-swing']);
        expect(points[0]).toEqual({ x: 1900, y: 240 });
        expect(points.at(-1)!.x).toBeCloseTo(1000, 6);
        expect(points.at(-1)!.y).toBeCloseTo(1140, 6);
        for (const p of points) {
            expect(Math.abs(distance(p, { x: 1000, y: 240 }) - 900)).toBeLessThan(0.7);
        }
    });

    it('stays close to a bezier curve', () => {
        const points = flatten(E.curtain, 0.5);
        expect(points[0]).toEqual({ x: 3500, y: 3700 });
        expect(points.at(-1)).toEqual({ x: 5000, y: 3700 });
        // B(0.5) of the curtain's control points (3500,3700) (4000,3500) (4500,3500) (5000,3700)
        expect(distanceToPolyline({ x: 4250, y: 3550 }, points)).toBeLessThanOrEqual(0.5);
    });

    it('returns nothing for an empty path', () => {
        expect(flattenPathSpec({ segments: [], closed: true }, 1)).toEqual([]);
    });
});

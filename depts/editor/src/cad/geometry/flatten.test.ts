import { describe, expect, it } from 'vitest';
import { indexDocument } from '../model/DocumentIndex';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import { buildPathSpec } from '../renderer/PathSpec';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { ellipsePathSpec } from '../renderer/PathSpec';
import { flattenPathSpec, pathSpecBounds } from './flatten';
import { boundsOf } from './selectionGeometry';
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

describe('pathSpecBounds', () => {
    it('reaches the turning point of a bezier, which no segment end marks', () => {
        // The curtain dips to y = 3550 at t = 0.5 between its ends at y = 3700
        const bounds = pathSpecBounds(buildPathSpec(index.elements.get(E.curtain)!, index));
        expect(bounds).toEqual({ x: 3500, y: 3550, width: 1500, height: 150 });
    });

    it('is the box of a rotated ellipse', () => {
        const bounds = pathSpecBounds(ellipsePathSpec({ x: 10, y: 20 }, 40, 20, Math.PI / 2));
        expect(bounds.x).toBeCloseTo(-10);
        expect(bounds.y).toBeCloseTo(-20);
        expect(bounds.width).toBeCloseTo(40);
        expect(bounds.height).toBeCloseTo(80);
    });

    it('contains the flattened outline of every sample element and is no wider than the tolerance allows', () => {
        for (const element of index.elements.values()) {
            const spec = buildPathSpec(element, index);
            const exact = pathSpecBounds(spec);
            const sampled = boundsOf(flattenPathSpec(spec, 0.1));
            expect(sampled.x).toBeGreaterThanOrEqual(exact.x - 1e-9);
            expect(sampled.y).toBeGreaterThanOrEqual(exact.y - 1e-9);
            expect(sampled.x + sampled.width).toBeLessThanOrEqual(exact.x + exact.width + 1e-9);
            expect(sampled.y + sampled.height).toBeLessThanOrEqual(exact.y + exact.height + 1e-9);
            expect(Math.abs(exact.width - sampled.width)).toBeLessThanOrEqual(0.2);
            expect(Math.abs(exact.height - sampled.height)).toBeLessThanOrEqual(0.2);
        }
    });
});

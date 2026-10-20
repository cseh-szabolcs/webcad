import { describe, expect, it } from 'vitest';
import { indexDocument } from '../model/DocumentIndex';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import { buildPathSpec } from '../renderer/PathSpec';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { flattenPathSpec } from './flatten';
import {
    distanceToPolyline,
    pointInPolygon,
    polylineInsidePolygon,
    polylineInsideRect,
    polylineTouchesPolygon,
    polylineTouchesRect,
    rectFromCorners,
    segmentsIntersect,
} from './selectionGeometry';

const { element: E } = sampleIds;

const index = indexDocument(parseDocument(samplePlan));
/** Table: circle around (4000, 1800) with radius 600. */
const table = flattenPathSpec(buildPathSpec(index.elements.get(E.table)!, index), 0.5);
const rect = (x1: number, y1: number, x2: number, y2: number) => rectFromCorners({ x: x1, y: y1 }, { x: x2, y: y2 });

/** U shape opening upwards: two arms (x 0–10 and 20–30) joined by a bar at y 0–10. */
const u: Point[] = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 30 },
    { x: 20, y: 30 },
    { x: 20, y: 10 },
    { x: 10, y: 10 },
    { x: 10, y: 30 },
    { x: 0, y: 30 },
];
const line = (x1: number, y1: number, x2: number, y2: number): Point[] => [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
];

describe('rectFromCorners', () => {
    it('normalises corners given in any order', () => {
        expect(rectFromCorners({ x: 10, y: 5 }, { x: 2, y: 8 })).toEqual({ x: 2, y: 5, width: 8, height: 3 });
    });
});

describe('distanceToPolyline', () => {
    it('measures to the outline, not to the inside', () => {
        expect(distanceToPolyline({ x: 4600, y: 1800 }, table)).toBeLessThan(0.5);
        expect(distanceToPolyline({ x: 4000, y: 1800 }, table)).toBeCloseTo(600, 0);
    });

    it('measures to the nearest point of a segment', () => {
        expect(distanceToPolyline({ x: 5, y: 3 }, line(0, 0, 10, 0))).toBe(3);
        expect(distanceToPolyline({ x: 13, y: 4 }, line(0, 0, 10, 0))).toBe(5);
    });
});

describe('window and crossing rectangles', () => {
    it('selects a circle that lies completely inside the window', () => {
        expect(polylineInsideRect(table, rect(3300, 1100, 4700, 2500))).toBe(true);
    });

    it('does not window-select a circle that is only cut, but crossing does', () => {
        const half = rect(3300, 1100, 4000, 2500);
        expect(polylineInsideRect(table, half)).toBe(false);
        expect(polylineTouchesRect(table, half)).toBe(true);
    });

    it('does not cross-select a circle whose outline surrounds the rectangle', () => {
        expect(polylineTouchesRect(table, rect(3900, 1700, 4100, 1900))).toBe(false);
    });

    it('does not cross-select a circle away from the rectangle', () => {
        expect(polylineTouchesRect(table, rect(0, 0, 100, 100))).toBe(false);
    });

    it('cross-selects a line that passes through without an end point inside', () => {
        expect(polylineTouchesRect(line(-10, 5, 20, 5), rect(0, 0, 10, 10))).toBe(true);
    });
});

describe('lasso polygons', () => {
    it('tests points against a concave polygon', () => {
        expect(pointInPolygon({ x: 5, y: 20 }, u)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 20 }, u)).toBe(false);
    });

    it('window-selects a line inside the polygon', () => {
        expect(polylineInsidePolygon(line(2, 5, 28, 5), u)).toBe(true);
    });

    it('does not window-select a line that leaves the polygon through its notch', () => {
        const bridge = line(5, 20, 25, 20);
        expect(polylineInsidePolygon(bridge, u)).toBe(false);
        expect(polylineTouchesPolygon(bridge, u)).toBe(true);
    });

    it('does not cross-select a line inside the notch', () => {
        expect(polylineTouchesPolygon(line(12, 20, 18, 20), u)).toBe(false);
    });

    it('ignores degenerate polygons', () => {
        expect(polylineTouchesPolygon(line(0, 0, 1, 1), u.slice(0, 2))).toBe(false);
        expect(polylineInsidePolygon(line(0, 0, 1, 1), u.slice(0, 2))).toBe(false);
    });
});

describe('segmentsIntersect', () => {
    it('counts touching end points and collinear overlap', () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })).toBe(true);
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 })).toBe(true);
    });

    it('rejects parallel and separate segments', () => {
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBe(false);
        expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 15, y: 0 })).toBe(false);
    });
});

import { describe, expect, it } from 'vitest';
import type { Point } from '../model/Point';
import { arcMidpoint, arcSegments } from './arc';

const center = { x: 1000, y: 240 };
const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
const round = (p: Point | undefined) => p && { x: round3(p.x), y: round3(p.y) };
const points = (segments: ReturnType<typeof arcSegments>) => segments.map((s) => round(s.point));

describe('arcSegments', () => {
    it('builds a counter-clockwise quarter circle as one Bézier segment', () => {
        const segments = arcSegments(center, { x: 1900, y: 240 }, { x: 1000, y: 1140 }, false);
        expect(points(segments)).toEqual([{ x: 1900, y: 240 }, { x: 1000, y: 1140 }]);
        expect(round(segments[0].handleOut)).toEqual({ x: 0, y: 497.056 });
        expect(round(segments[1].handleIn)).toEqual({ x: 497.056, y: 0 });
        expect(segments[0].handleIn).toBeUndefined();
        expect(segments[1].handleOut).toBeUndefined();
    });

    it('goes the other way round when clockwise', () => {
        const segments = arcSegments(center, { x: 1900, y: 240 }, { x: 1000, y: 1140 }, true);
        // 270° clockwise: right → bottom → left → top
        expect(points(segments)).toEqual([
            { x: 1900, y: 240 },
            { x: 1000, y: -660 },
            { x: 100, y: 240 },
            { x: 1000, y: 1140 },
        ]);
        expect(round(segments[0].handleOut)).toEqual({ x: 0, y: -497.056 });
    });

    it('splits a half circle into two segments', () => {
        const segments = arcSegments(center, { x: 1900, y: 240 }, { x: 100, y: 240 }, false);
        expect(points(segments)).toEqual([
            { x: 1900, y: 240 },
            { x: 1000, y: 1140 },
            { x: 100, y: 240 },
        ]);
    });

    it('takes the radius from the start and only the angle from the end', () => {
        const segments = arcSegments(center, { x: 1900, y: 240 }, { x: 1000, y: 3000 }, false);
        expect(points(segments).at(-1)).toEqual({ x: 1000, y: 1140 });
    });

    it('draws a full circle when start and end share the angle', () => {
        const segments = arcSegments(center, { x: 1900, y: 240 }, { x: 2500, y: 240 }, false);
        expect(segments).toHaveLength(5);
        expect(points(segments).at(-1)).toEqual({ x: 1900, y: 240 });
    });
});

describe('arcMidpoint', () => {
    it('lies halfway along the arc in its direction', () => {
        const start = { x: 1900, y: 240 };
        const end = { x: 1000, y: 1140 };
        expect(round(arcMidpoint(center, start, end, false))).toEqual({ x: 1636.396, y: 876.396 });
        // 270° clockwise: halfway is at -135°
        expect(round(arcMidpoint(center, start, end, true))).toEqual({ x: 363.604, y: -396.396 });
    });

    it('is opposite the start on a full circle', () => {
        expect(round(arcMidpoint(center, { x: 1900, y: 240 }, { x: 2500, y: 240 }, false))).toEqual({ x: 100, y: 240 });
    });
});

import { describe, expect, it } from 'vitest';
import type { Point } from '../../model/Point';
import { DEFAULT_OBJECT_TRACKING_SETTINGS, DEFAULT_POLAR_SETTINGS } from '../../../settings/editorSettings';
import {
    findObjectTrack,
    MAX_ACQUIRED_POINTS,
    polarWins,
    toggleAcquired,
    trackingAngles,
    type AcquiredPoint,
    type TrackingOptions,
} from './ObjectSnapTracking';

const A: AcquiredPoint = { point: { x: 100, y: 200 }, mode: 'END' };
const B: AcquiredPoint = { point: { x: 500, y: 600 }, mode: 'MID' };
const ORTHOGONAL = [0, 90, 180, 270];
/** One screen pixel is 1 mm: 10 px tolerance, 10 px half aperture. */
const find = (cursor: Point, acquired: readonly AcquiredPoint[], options: TrackingOptions = {}, angles = ORTHOGONAL) =>
    findObjectTrack({ cursor, pixelSize: 1, tolerance: 10, aperture: 10 }, acquired, angles, options);

describe('toggleAcquired', () => {
    it('adds a point and drops it again when dwelt on once more', () => {
        const once = toggleAcquired([], A);
        expect(once).toEqual([A]);
        expect(toggleAcquired(once, { point: { x: 100, y: 200 + 1e-9 }, mode: 'INT' })).toEqual([]);
    });

    it('keeps at most MAX_ACQUIRED_POINTS, dropping the oldest', () => {
        let points: AcquiredPoint[] = [];
        for (let i = 0; i <= MAX_ACQUIRED_POINTS; i++) {
            points = toggleAcquired(points, { point: { x: i, y: 0 }, mode: 'END' });
        }
        expect(points).toHaveLength(MAX_ACQUIRED_POINTS);
        expect(points[0].point).toEqual({ x: 1, y: 0 });
        expect(points[MAX_ACQUIRED_POINTS - 1].point).toEqual({ x: MAX_ACQUIRED_POINTS, y: 0 });
    });
});

describe('trackingAngles', () => {
    it('tracks orthogonally, or at all polar angles whether polar tracking is on or not', () => {
        expect(trackingAngles(DEFAULT_OBJECT_TRACKING_SETTINGS, DEFAULT_POLAR_SETTINGS)).toEqual(ORTHOGONAL);
        const polar = { enabled: false, incrementAngle: 45, additionalAngles: [30] };
        expect(trackingAngles({ enabled: true, allPolarAngles: true }, polar)).toEqual([0, 30, 45, 90, 135, 180, 225, 270, 315]);
    });
});

describe('findObjectTrack', () => {
    it('finds nothing without acquired points', () => {
        expect(find({ x: 300, y: 205 }, [])).toBeNull();
    });

    it('puts the cursor onto the horizontal or vertical path of an acquired point', () => {
        expect(find({ x: 300, y: 207 }, [A])).toEqual({
            point: { x: 300, y: 200 },
            paths: [{ origin: A.point, angle: 0, distance: 200, source: 'END' }],
        });
        expect(find({ x: 96, y: -100 }, [A])).toMatchObject({ point: { x: 100, y: -100 }, paths: [{ angle: 270 }] });
        expect(find({ x: 300, y: 215 }, [A])).toBeNull();
    });

    it('takes the nearest path of all acquired points and keeps the previous one by hysteresis', () => {
        const C: AcquiredPoint = { point: { x: 500, y: 211 }, mode: 'MID' };
        // 6 px off A's horizontal, 5 px off C's
        expect(find({ x: 300, y: 206 }, [A, C])?.paths[0]).toMatchObject({ origin: C.point, angle: 180 });
        const previous = find({ x: 300, y: 203 }, [A, C]);
        expect(previous?.paths[0]).toMatchObject({ origin: A.point, angle: 0 });
        expect(find({ x: 300, y: 206 }, [A, C], { previous })?.paths[0]).toMatchObject({ origin: A.point, angle: 0 });
        expect(find({ x: 300, y: 208 }, [A, C], { previous })?.paths[0]).toMatchObject({ origin: C.point });
    });

    it('snaps to where paths of two acquired points cross in the aperture box', () => {
        // A's horizontal (y 200) crosses B's vertical (x 500)
        expect(find({ x: 508, y: 193 }, [A, B])).toEqual({
            point: { x: 500, y: 200 },
            paths: [
                { origin: A.point, angle: 0, distance: 400, source: 'END' },
                { origin: B.point, angle: 270, distance: 400, source: 'MID' },
            ],
        });
        // Outside the box only the nearer single path remains
        expect(find({ x: 512, y: 203 }, [A, B])?.paths).toHaveLength(1);
    });

    it('does not cross paths from the same point', () => {
        expect(find({ x: 104, y: 205 }, [A, { ...A, mode: 'INT' }])).toBeNull();
    });

    it('crosses a path with the polar paths of the base point, and only those with Ortho', () => {
        const base = { origin: { x: 0, y: 0 }, angles: [45], source: 'polar' as const };
        const crossing = find({ x: 197, y: 205 }, [A], { base });
        expect(crossing?.paths).toMatchObject([{ origin: A.point, angle: 0 }, { source: 'polar', angle: 45 }]);
        expect(crossing!.point.x).toBeCloseTo(200);
        expect(crossing!.point.y).toBe(200);
        const ortho = { origin: { x: 0, y: 0 }, angles: [0, 180], source: 'ortho' as const };
        expect(find({ x: 105, y: 0 }, [A], { base: ortho, single: false })).toMatchObject({ point: { x: 100, y: 0 } });
        expect(find({ x: 300, y: 205 }, [A], { base: ortho, single: false })).toBeNull();
    });

    it('follows polar angles from the acquired point', () => {
        const track = find({ x: 200, y: 305 }, [A], {}, [45]);
        expect(track?.paths[0]).toMatchObject({ angle: 45 });
        expect(track!.point.x).toBeCloseTo(202.5);
        expect(track!.point.y).toBeCloseTo(302.5);
    });
});

describe('polarWins', () => {
    const polar = { angle: 90, point: { x: 0, y: 100 }, distance: 100 };
    const track = { point: { x: 4, y: 100 }, paths: [] };

    it('takes the nearer path, keeping the one shown before within the hysteresis', () => {
        expect(polarWins(polar, track, { x: 0.5, y: 100 }, 1, false)).toBe(true);
        expect(polarWins(polar, track, { x: 1, y: 100 }, 1, false)).toBe(false);
        expect(polarWins(polar, track, { x: 2.5, y: 100 }, 1, false)).toBe(false);
        expect(polarWins(polar, track, { x: 2.5, y: 100 }, 1, true)).toBe(true);
        expect(polarWins(polar, track, { x: 3.5, y: 100 }, 1, true)).toBe(false);
    });
});

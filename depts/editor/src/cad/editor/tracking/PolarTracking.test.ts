import { describe, expect, it } from 'vitest';
import type { Point } from '../../model/Point';
import { DEFAULT_POLAR_SETTINGS, type PolarSettings } from '../../../settings/editorSettings';
import {
    findPolarTrack,
    formatAngleList,
    MAX_ADDITIONAL_ANGLES,
    parseAngleList,
    polarAngles,
    type PolarQuery,
} from './PolarTracking';

const ORIGIN = { x: 100, y: 200 };
/** One screen pixel is 1 mm, so the 10 px tolerance reaches 10 mm from a path. */
const query = (cursor: Point, change: Partial<PolarQuery> = {}): PolarQuery => ({
    reference: ORIGIN,
    cursor,
    pixelSize: 1,
    tolerance: 10,
    ...change,
});
const settings = (change: Partial<PolarSettings> = {}): PolarSettings => ({ ...DEFAULT_POLAR_SETTINGS, ...change });
const round3 = (n: number) => Math.round(n * 1000) / 1000 + 0;
const track = (cursor: Point, polar = settings(), change: Partial<PolarQuery> = {}) => {
    const found = findPolarTrack(query(cursor, change), polar);
    return found && { angle: found.angle, x: round3(found.point.x), y: round3(found.point.y), distance: round3(found.distance) };
};

describe('polarAngles', () => {
    it('gives every multiple of the increment', () => {
        expect(polarAngles(settings())).toEqual([0, 90, 180, 270]);
        expect(polarAngles(settings({ incrementAngle: 22.5 }))).toHaveLength(16);
        expect(polarAngles(settings({ incrementAngle: 22.5 }))[3]).toBe(67.5);
    });

    it('adds the additional angles, normalized and without duplicates', () => {
        expect(polarAngles(settings({ additionalAngles: [30, -60, 90, 390] }))).toEqual([0, 30, 90, 180, 270, 300]);
    });

    it('gives only the additional angles without a valid increment', () => {
        expect(polarAngles(settings({ incrementAngle: 0, additionalAngles: [15] }))).toEqual([15]);
    });
});

describe('findPolarTrack', () => {
    it('projects the cursor onto the horizontal and vertical paths, exactly', () => {
        expect(track({ x: 300, y: 207 })).toEqual({ angle: 0, x: 300, y: 200, distance: 200 });
        expect(track({ x: 95, y: 350 })).toEqual({ angle: 90, x: 100, y: 350, distance: 150 });
        expect(track({ x: -50, y: 193 })).toEqual({ angle: 180, x: -50, y: 200, distance: 150 });
        expect(track({ x: 104, y: 50 })).toEqual({ angle: 270, x: 100, y: 50, distance: 150 });
        expect(findPolarTrack(query({ x: 300, y: 207.3 }), settings())!.point.y).toBe(200);
    });

    it('finds no path beyond the tolerance', () => {
        expect(track({ x: 300, y: 211 })).toBeNull();
    });

    it('measures the tolerance in screen px, whatever the zoom', () => {
        expect(track({ x: 300, y: 215 }, settings(), { pixelSize: 2 })).toEqual({ angle: 0, x: 300, y: 200, distance: 200 });
        expect(track({ x: 300, y: 205 }, settings(), { pixelSize: 0.25 })).toBeNull();
    });

    it('finds the diagonals only with a 45° increment', () => {
        expect(track({ x: 200, y: 305 })).toBeNull();
        expect(track({ x: 200, y: 305 }, settings({ incrementAngle: 45 }))).toEqual({
            angle: 45,
            x: 202.5,
            y: 302.5,
            distance: round3(102.5 * Math.SQRT2),
        });
    });

    it('finds an additional angle', () => {
        const direction = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
        const cursor = { x: ORIGIN.x + 200 * direction.x, y: ORIGIN.y + 200 * direction.y + 3 };
        expect(track(cursor, settings({ additionalAngles: [30] }))?.angle).toBe(30);
    });

    it('finds nothing behind the reference point or right at it', () => {
        expect(track({ x: 100, y: 200 })).toBeNull();
        expect(track({ x: 108, y: 201 })).toBeNull();
        expect(track({ x: 112, y: 201 })?.angle).toBe(0);
    });

    it('takes the nearest path', () => {
        expect(track({ x: 130, y: 225 }, settings({ incrementAngle: 45 }))?.angle).toBe(45);
        expect(track({ x: 140, y: 205 }, settings({ incrementAngle: 45 }))?.angle).toBe(0);
    });

    it('keeps the previous path unless another is more than 2 px nearer', () => {
        const polar = settings({ incrementAngle: 45 });
        // 8 px from 0°, about 8.5 px from 45°
        const cursor = { x: 120, y: 208 };
        const zero = findPolarTrack(query(cursor), polar)!;
        expect(zero.angle).toBe(0);
        const diagonal = findPolarTrack(query({ x: 130, y: 225 }), polar)!;
        expect(findPolarTrack(query(cursor), polar, diagonal)!.angle).toBe(45);
        // 4 px from 0°, about 8.5 px from 45°
        expect(findPolarTrack(query({ x: 116, y: 204 }), polar, diagonal)!.angle).toBe(0);
    });

    it('finds nothing while polar tracking is off', () => {
        expect(track({ x: 300, y: 200 }, settings({ enabled: false }))).toBeNull();
    });
});

describe('parseAngleList', () => {
    it('reads angles separated by commas, semicolons or spaces', () => {
        expect(parseAngleList('30, 60')).toEqual([30, 60]);
        expect(parseAngleList('30;60 22.5')).toEqual([30, 60, 22.5]);
        expect(parseAngleList(' -15°, .5 ')).toEqual([-15, 0.5]);
    });

    it('gives no angles for empty text and drops duplicates', () => {
        expect(parseAngleList('  ')).toEqual([]);
        expect(parseAngleList('30, 30')).toEqual([30]);
    });

    it('rejects text that is no angle and too many angles', () => {
        expect(parseAngleList('30, abc')).toBeNull();
        expect(parseAngleList('30°°')).toBeNull();
        expect(parseAngleList(Array.from({ length: MAX_ADDITIONAL_ANGLES + 1 }, (_, i) => i).join(','))).toBeNull();
    });

    it('formats the angles the way they are typed', () => {
        expect(formatAngleList([30, 22.5])).toBe('30, 22.5');
        expect(parseAngleList(formatAngleList([30, 22.5]))).toEqual([30, 22.5]);
    });
});

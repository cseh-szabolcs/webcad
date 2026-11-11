import { describe, expect, it } from 'vitest';
import type { Point } from '../model/Point';
import { reflectionAcross, rotationAbout, scalingAbout, transformAngle, transformPoint, transformVector } from './similarity';

const round = ({ x, y }: Point) => ({ x: Math.round(x * 1000) / 1000 + 0, y: Math.round(y * 1000) / 1000 + 0 });

describe('similarity', () => {
    it('rotates about a point, a quarter turn exactly', () => {
        const quarter = rotationAbout({ x: 100, y: 50 }, 90);
        expect(transformPoint(quarter, { x: 300, y: 50 })).toEqual({ x: 100, y: 250 });
        expect(transformPoint(rotationAbout({ x: 100, y: 50 }, -270), { x: 300, y: 50 })).toEqual({ x: 100, y: 250 });
        expect(transformVector(quarter, { x: 0, y: 10 })).toEqual({ x: -10, y: 0 });
        expect(round(transformPoint(rotationAbout({ x: 0, y: 0 }, 45), { x: Math.SQRT2, y: 0 }))).toEqual({ x: 1, y: 1 });
    });

    it('scales from a point', () => {
        const double = scalingAbout({ x: 100, y: 50 }, 2);
        expect(transformPoint(double, { x: 150, y: 40 })).toEqual({ x: 200, y: 30 });
        expect(transformVector(double, { x: 3, y: -4 })).toEqual({ x: 6, y: -8 });
        expect(double.scale).toBe(2);
    });

    it('mirrors across a line and turns the sense of rotation', () => {
        const vertical = reflectionAcross({ x: 100, y: 0 }, { x: 100, y: 10 })!;
        expect(transformPoint(vertical, { x: 70, y: 5 })).toEqual({ x: 130, y: 5 });
        expect(vertical.mirrored).toBe(true);
        const diagonal = reflectionAcross({ x: 0, y: 0 }, { x: 5, y: 5 })!;
        expect(round(transformPoint(diagonal, { x: 3, y: 0 }))).toEqual({ x: 0, y: 3 });
        expect(reflectionAcross({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
    });

    it('turns a direction, mirrored the other way round', () => {
        expect(transformAngle(rotationAbout({ x: 0, y: 0 }, 90), Math.PI / 6)).toBeCloseTo((2 * Math.PI) / 3);
        expect(transformAngle(scalingAbout({ x: 0, y: 0 }, 3), Math.PI / 6)).toBe(Math.PI / 6);
        expect(transformAngle(reflectionAcross({ x: 0, y: 0 }, { x: 1, y: 0 })!, Math.PI / 6)).toBeCloseTo(-Math.PI / 6);
        // Kept in (-π, π]
        expect(transformAngle(rotationAbout({ x: 0, y: 0 }, 270), Math.PI / 2)).toBeCloseTo(0);
        expect(Object.is(transformAngle(scalingAbout({ x: 0, y: 0 }, 2), 0), 0)).toBe(true);
    });
});

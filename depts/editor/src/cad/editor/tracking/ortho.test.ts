import { describe, expect, it } from 'vitest';
import { orthoPoint } from './ortho';

const REFERENCE = { x: 100, y: 200 };

describe('orthoPoint', () => {
    it('keeps the reference y where the cursor is more to the side', () => {
        expect(orthoPoint(REFERENCE, { x: 300, y: 350 })).toEqual({ x: 300, y: 200 });
        expect(orthoPoint(REFERENCE, { x: -100, y: 50 })).toEqual({ x: -100, y: 200 });
    });

    it('keeps the reference x where the cursor is more above or below', () => {
        expect(orthoPoint(REFERENCE, { x: 250, y: 400 })).toEqual({ x: 100, y: 400 });
        expect(orthoPoint(REFERENCE, { x: 50, y: -100 })).toEqual({ x: 100, y: -100 });
    });

    it('takes the horizontal on the diagonal and at the reference point', () => {
        expect(orthoPoint(REFERENCE, { x: 200, y: 300 })).toEqual({ x: 200, y: 200 });
        expect(orthoPoint(REFERENCE, REFERENCE)).toEqual(REFERENCE);
    });
});

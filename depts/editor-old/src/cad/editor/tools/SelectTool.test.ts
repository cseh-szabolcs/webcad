import { describe, expect, it } from 'vitest';
import { resizedRadii } from './SelectTool';

const r = { x: 600, y: 300 };

describe('resizedRadii', () => {
    it('changes only the radius of the dragged axis, around the centre', () => {
        expect(resizedRadii(r, 'right', { x: 100, y: 50 }, false, 1)).toEqual({ x: 700, y: 300 });
        expect(resizedRadii(r, 'left', { x: 100, y: 50 }, false, 1)).toEqual({ x: 500, y: 300 });
        expect(resizedRadii(r, 'top', { x: 100, y: 50 }, false, 1)).toEqual({ x: 600, y: 350 });
        expect(resizedRadii(r, 'bottom', { x: 100, y: 50 }, false, 1)).toEqual({ x: 600, y: 250 });
    });

    it('scales both radii by the same factor when uniform', () => {
        expect(resizedRadii(r, 'right', { x: 300, y: 0 }, true, 1)).toEqual({ x: 900, y: 450 });
        expect(resizedRadii({ x: 500, y: 500 }, 'top', { x: 0, y: -100 }, true, 1)).toEqual({ x: 400, y: 400 });
    });

    it('mirrors when dragged past the centre and never goes below the minimum', () => {
        expect(resizedRadii(r, 'right', { x: -700, y: 0 }, false, 1)).toEqual({ x: 100, y: 300 });
        expect(resizedRadii(r, 'right', { x: -600, y: 0 }, false, 2)).toEqual({ x: 2, y: 300 });
    });
});

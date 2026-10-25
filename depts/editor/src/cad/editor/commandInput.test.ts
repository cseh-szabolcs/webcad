import { describe, expect, it } from 'vitest';
import { matchesKeyword, parsePointInput, resolvePointInput } from './commandInput';

describe('parsePointInput', () => {
    it('reads absolute cartesian coordinates, with an optional #', () => {
        expect(parsePointInput('100,-25.5')).toEqual({ kind: 'absolute', point: { x: 100, y: -25.5 } });
        expect(parsePointInput('#.5,+3.')).toEqual({ kind: 'absolute', point: { x: 0.5, y: 3 } });
        expect(parsePointInput(' 1 , 2 ')).toEqual({ kind: 'absolute', point: { x: 1, y: 2 } });
    });

    it('reads relative cartesian coordinates; @ alone is the reference point', () => {
        expect(parsePointInput('@10,-20')).toEqual({ kind: 'relative', offset: { x: 10, y: -20 } });
        expect(parsePointInput('@')).toEqual({ kind: 'relative', offset: { x: 0, y: 0 } });
    });

    it('reads polar coordinates in degrees, counter-clockwise from +X', () => {
        const relative = parsePointInput('@100<90');
        expect(relative?.kind).toBe('relative');
        if (relative?.kind === 'relative') {
            expect(relative.offset.x).toBeCloseTo(0);
            expect(relative.offset.y).toBeCloseTo(100);
        }
        const absolute = parsePointInput('10<-45');
        expect(absolute?.kind).toBe('absolute');
        if (absolute?.kind === 'absolute') {
            expect(absolute.point.x).toBeCloseTo(Math.SQRT1_2 * 10);
            expect(absolute.point.y).toBeCloseTo(-Math.SQRT1_2 * 10);
        }
    });

    it('reads a plain number as a distance', () => {
        expect(parsePointInput('250')).toEqual({ kind: 'distance', distance: 250 });
        expect(parsePointInput('-12.5')).toEqual({ kind: 'distance', distance: -12.5 });
    });

    it('rejects anything else', () => {
        for (const text of ['', '#', '@5', '#5', '1,2,3', '1;2', '1,', ',2', '1..2,3', '10<', 'abc', '1,2@', '@@1,2', '1e3']) {
            expect(parsePointInput(text), text).toBeNull();
        }
    });
});

describe('resolvePointInput', () => {
    const reference = { x: 100, y: 50 };

    it('takes absolute points as they are and offsets relative ones from the reference', () => {
        expect(resolvePointInput({ kind: 'absolute', point: { x: 1, y: 2 } }, reference, null)).toEqual({ x: 1, y: 2 });
        expect(resolvePointInput({ kind: 'relative', offset: { x: 10, y: -5 } }, reference, null)).toEqual({ x: 110, y: 45 });
    });

    it('goes the distance from the reference towards the cursor', () => {
        expect(resolvePointInput({ kind: 'distance', distance: 30 }, reference, { x: 100, y: 1000 })).toEqual({ x: 100, y: 80 });
        expect(resolvePointInput({ kind: 'distance', distance: -10 }, reference, { x: 200, y: 50 })).toEqual({ x: 90, y: 50 });
    });

    it('has no point for a distance without a direction', () => {
        expect(resolvePointInput({ kind: 'distance', distance: 30 }, reference, null)).toBeNull();
        expect(resolvePointInput({ kind: 'distance', distance: 30 }, reference, reference)).toBeNull();
    });
});

describe('matchesKeyword', () => {
    it('matches a start of the keyword in any case', () => {
        expect(matchesKeyword('v', 'Verschiebung')).toBe(true);
        expect(matchesKeyword('VERSCH', 'Verschiebung')).toBe(true);
        expect(matchesKeyword('Verschiebung', 'Verschiebung')).toBe(true);
    });

    it('does not match empty or other text', () => {
        expect(matchesKeyword('', 'Verschiebung')).toBe(false);
        expect(matchesKeyword('x', 'Verschiebung')).toBe(false);
        expect(matchesKeyword('Verschiebungen', 'Verschiebung')).toBe(false);
    });

    it('takes a keyword with a capital inside from that capital on, or whole', () => {
        expect(matchesKeyword('l', 'sehnenLänge')).toBe(true);
        expect(matchesKeyword('LÄNGE', 'sehnenLänge')).toBe(true);
        expect(matchesKeyword('sehnenlänge', 'sehnenLänge')).toBe(true);
        expect(matchesKeyword('s', 'sehnenLänge')).toBe(false);
        expect(matchesKeyword('sehnen', 'sehnenLänge')).toBe(false);
    });
});

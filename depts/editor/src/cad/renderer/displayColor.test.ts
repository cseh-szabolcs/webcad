import { describe, expect, it } from 'vitest';
import { displayFillColor, displayStrokeColor } from './displayColor';

/** Lightness (HSL) of a #rrggbb colour, 0–1. */
const lightness = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

describe('displayStrokeColor', () => {
    it('keeps every colour on a light background', () => {
        expect(displayStrokeColor('#1f2937', 'light')).toBe('#1f2937');
    });

    it('turns black into white on a dark background', () => {
        expect(displayStrokeColor('#000000', 'dark')).toBe('#ffffff');
        expect(displayStrokeColor('#000', 'dark')).toBe('#ffffff');
    });

    it('mirrors the lightness of dark tones', () => {
        // Wall colour of the sample plan: near black becomes near white
        expect(displayStrokeColor('#1f2937', 'dark')).toBe('#c8d2e0');
        expect(lightness(displayStrokeColor('#1f2937', 'dark'))).toBeCloseTo(1 - lightness('#1f2937'), 2);
    });

    it('lifts mid tones to the minimum lightness, keeping the hue', () => {
        // Furniture stroke #2563eb would mirror to about 0.47
        const blue = displayStrokeColor('#2563eb', 'dark');
        expect(lightness(blue)).toBeCloseTo(0.6, 2);
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(blue.slice(i, i + 2), 16));
        expect(b).toBeGreaterThan(Math.max(r, g));
    });

    it('keeps light strokes visible instead of turning them dark', () => {
        expect(lightness(displayStrokeColor('#ffffff', 'dark'))).toBeCloseTo(0.6, 2);
        expect(lightness(displayStrokeColor('#dbeafe', 'dark'))).toBeCloseTo(0.6, 2);
    });

    it('keeps an alpha channel', () => {
        expect(displayStrokeColor('#00000080', 'dark')).toBe('#ffffff80');
    });

    it('returns other notations unchanged', () => {
        expect(displayStrokeColor('red', 'dark')).toBe('red');
        expect(displayStrokeColor('rgb(0, 0, 0)', 'dark')).toBe('rgb(0, 0, 0)');
    });
});

describe('displayFillColor', () => {
    /** Canvas background in dark mode (--canvas-bg). */
    const BACKGROUND = '#212830';
    /** Chroma (colourfulness) of a #rrggbb colour, 0–1. */
    const chroma = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        return Math.max(r, g, b) - Math.min(r, g, b);
    };

    it('keeps every fill on a light background', () => {
        expect(displayFillColor('#dbeafe', 'light')).toBe('#dbeafe');
    });

    it('keeps a pale tint as far above the dark background as it lies below white', () => {
        // Furniture fill #dbeafe: about 0.07 below white
        const fill = displayFillColor('#dbeafe', 'dark');
        expect(fill).toBe('#29384d');
        expect(lightness(fill) - lightness(BACKGROUND)).toBeCloseTo(1 - lightness('#dbeafe'), 2);
    });

    it('keeps the chroma, so a pale tint stays a subtle tint of the same hue', () => {
        const fill = displayFillColor('#dbeafe', 'dark');
        expect(chroma(fill)).toBeCloseTo(chroma('#dbeafe'), 1);
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
        expect(b).toBeGreaterThan(Math.max(r, g));
    });

    it('turns a white fill into the background colour, as it is on white', () => {
        expect(lightness(displayFillColor('#ffffff', 'dark'))).toBeCloseTo(lightness(BACKGROUND), 2);
    });

    it('never makes a fill darker than the background', () => {
        for (const color of ['#000000', '#2563eb', '#16a34a', '#fde68a']) {
            expect(lightness(displayFillColor(color, 'dark'))).toBeGreaterThanOrEqual(lightness(BACKGROUND) - 0.01);
        }
    });
});
